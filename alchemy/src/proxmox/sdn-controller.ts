import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating an SDN Controller
 */
export interface SDNControllerProps extends ProxmoxApiOptions {
  /**
   * Controller ID (unique identifier)
   */
  controller: string;

  /**
   * Controller type (evpn, faucet, bgp)
   */
  type: "evpn" | "faucet" | "bgp";

  /**
   * Autonomous system number (for BGP)
   */
  asn?: number;

  /**
   * BGP peers (comma-separated)
   */
  peers?: string;

  /**
   * BGP router ID
   */
  bgpMultipathAsPathRelax?: boolean;

  /**
   * eBGP multihop (for external BGP peers)
   */
  ebgpMultihop?: number;

  /**
   * Node name (for local controllers)
   */
  node?: string;

  /**
   * Whether to delete the controller when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after SDNController creation/update
 */
export interface SDNController {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Controller ID
   */
  controller: string;

  /**
   * Controller type
   */
  type: string;

  /**
   * Autonomous system number
   */
  asn?: number;

  /**
   * BGP peers
   */
  peers?: string;

  /**
   * Node name
   */
  node?: string;
}

/**
 * Type guard to check if a resource is an SDNController
 */
export function isSDNController(resource: unknown): resource is SDNController {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::SDNController"
  );
}

/**
 * Creates and manages a Proxmox SDN Controller.
 *
 * @example
 * ## Create an EVPN controller
 *
 * Create an EVPN controller for VXLAN overlay:
 *
 * ```ts
 * import { SDNController } from "alchemy/proxmox";
 *
 * const controller = await SDNController("evpn", {
 *   controller: "evpn",
 *   type: "evpn",
 *   asn: 65000,
 *   peers: "10.0.0.1,10.0.0.2",
 * });
 * ```
 *
 * @example
 * ## Create a BGP controller
 *
 * Create a BGP controller for external routing:
 *
 * ```ts
 * import { SDNController } from "alchemy/proxmox";
 *
 * const controller = await SDNController("bgp", {
 *   controller: "bgp",
 *   type: "bgp",
 *   asn: 65001,
 *   node: "pve1",
 * });
 * ```
 */
export const SDNController = Resource(
  "proxmox::SDNController",
  async function (
    this: Context<SDNController>,
    id: string,
    props: SDNControllerProps,
  ): Promise<SDNController> {
    const client = await createProxmoxClient(props);
    const controller = props.controller;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.controller) {
          try {
            await client.cluster.sdn.controllers
              .$(this.output.controller)
              .$delete();
          } catch (error: unknown) {
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create": {
        const createParams: Record<string, unknown> = {
          controller,
          type: props.type,
        };

        if (props.asn) createParams.asn = props.asn;
        if (props.peers) createParams.peers = props.peers;
        if (props.bgpMultipathAsPathRelax !== undefined)
          createParams["bgp-multipath-as-path-relax"] =
            props.bgpMultipathAsPathRelax ? 1 : 0;
        if (props.ebgpMultihop) createParams["ebgp-multihop"] = props.ebgpMultihop;
        if (props.node) createParams.node = props.node;

        await client.cluster.sdn.controllers.$post(
          createParams as Parameters<
            typeof client.cluster.sdn.controllers.$post
          >[0],
        );

        return fetchControllerInfo(client, id, controller, props);
      }

      case "update": {
        const updateParams: Record<string, unknown> = {};

        if (props.asn) updateParams.asn = props.asn;
        if (props.peers) updateParams.peers = props.peers;
        if (props.bgpMultipathAsPathRelax !== undefined)
          updateParams["bgp-multipath-as-path-relax"] =
            props.bgpMultipathAsPathRelax ? 1 : 0;
        if (props.ebgpMultihop) updateParams["ebgp-multihop"] = props.ebgpMultihop;
        if (props.node) updateParams.node = props.node;

        await client.cluster.sdn.controllers
          .$(controller)
          .$put(
            updateParams as Parameters<
              (typeof client.cluster.sdn.controllers.$get)[0]["$put"]
            >[0],
          );

        return fetchControllerInfo(client, id, controller, props);
      }
    }
  },
);

/**
 * Fetch SDN controller information from Proxmox
 * @internal
 */
async function fetchControllerInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  controller: string,
  props: SDNControllerProps,
): Promise<SDNController> {
  const controllers = await client.cluster.sdn.controllers.$get();
  const controllerInfo = (controllers as Array<Record<string, unknown>>).find(
    (c) => c.controller === controller,
  );

  return {
    id,
    controller,
    type: (controllerInfo?.type as string) ?? props.type,
    asn: (controllerInfo?.asn as number) ?? props.asn,
    peers: (controllerInfo?.peers as string) ?? props.peers,
    node: (controllerInfo?.node as string) ?? props.node,
  };
}

/**
 * Check if an error is a 404 not found error
 * @internal
 */
function isNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("404") || error.message.includes("not found");
  }
  return false;
}
