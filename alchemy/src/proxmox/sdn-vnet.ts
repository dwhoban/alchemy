import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating an SDN VNet
 */
export interface SDNVNetProps extends ProxmoxApiOptions {
  /**
   * VNet ID
   */
  vnet: string;

  /**
   * Zone this VNet belongs to
   */
  zone: string;

  /**
   * VLAN tag (for VLAN zones)
   */
  tag?: number;

  /**
   * VNet alias/description
   */
  alias?: string;

  /**
   * VXLAN VNI (for VXLAN zones)
   */
  vlanaware?: boolean;

  /**
   * Whether to delete the VNet when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after SDNVNet creation/update
 */
export interface SDNVNet {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * VNet ID
   */
  vnet: string;

  /**
   * Zone this VNet belongs to
   */
  zone: string;

  /**
   * VLAN tag
   */
  tag?: number;

  /**
   * VNet alias/description
   */
  alias?: string;

  /**
   * Whether VLAN aware
   */
  vlanaware: boolean;

  /**
   * Pending changes exist
   */
  pending: boolean;

  /**
   * VNet state
   */
  state?: string;

  /**
   * Resource type
   */
  type: "vnet";
}

/**
 * Type guard to check if a resource is an SDNVNet
 */
export function isSDNVNet(resource: unknown): resource is SDNVNet {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::SDNVNet"
  );
}

/**
 * Creates and manages a Proxmox SDN VNet (Virtual Network).
 *
 * @example
 * ## Create a VNet in a zone
 *
 * Create a virtual network:
 *
 * ```ts
 * import { SDNVNet, SDNZone } from "alchemy/proxmox";
 *
 * const zone = await SDNZone("internal", {
 *   zone: "internal",
 *   type: "simple",
 *   bridge: "vmbr1",
 * });
 *
 * const vnet = await SDNVNet("app-network", {
 *   vnet: "app-network",
 *   zone: zone.zone,
 *   alias: "Application network",
 * });
 * ```
 *
 * @example
 * ## Create a VNet with VLAN tag
 *
 * Create a VNet with specific VLAN:
 *
 * ```ts
 * import { SDNVNet } from "alchemy/proxmox";
 *
 * const vnet = await SDNVNet("vlan100", {
 *   vnet: "vlan100",
 *   zone: "production",
 *   tag: 100,
 *   alias: "Production VLAN 100",
 * });
 * ```
 */
export const SDNVNet = Resource(
  "proxmox::SDNVNet",
  async function (
    this: Context<SDNVNet>,
    id: string,
    props: SDNVNetProps,
  ): Promise<SDNVNet> {
    const client = await createProxmoxClient(props);
    const vnet = props.vnet;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.vnet) {
          try {
            await client.cluster.sdn.vnets.$(this.output.vnet).$delete();
            // Apply SDN changes
            await client.cluster.sdn.$put();
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
          vnet,
          zone: props.zone,
        };

        if (props.tag !== undefined) createParams.tag = props.tag;
        if (props.alias) createParams.alias = props.alias;
        if (props.vlanaware !== undefined)
          createParams.vlanaware = props.vlanaware ? 1 : 0;

        await client.cluster.sdn.vnets.$post(
          createParams as Parameters<typeof client.cluster.sdn.vnets.$post>[0],
        );

        // Apply SDN changes
        await client.cluster.sdn.$put();

        return fetchSDNVNetInfo(client, id, vnet);
      }

      case "update": {
        const updateParams: Record<string, unknown> = {};

        if (props.zone) updateParams.zone = props.zone;
        if (props.tag !== undefined) updateParams.tag = props.tag;
        if (props.alias) updateParams.alias = props.alias;
        if (props.vlanaware !== undefined)
          updateParams.vlanaware = props.vlanaware ? 1 : 0;

        await client.cluster.sdn.vnets
          .$(vnet)
          .$put(
            updateParams as Parameters<
              (typeof client.cluster.sdn.vnets.$get)[0]["$put"]
            >[0],
          );

        // Apply SDN changes
        await client.cluster.sdn.$put();

        return fetchSDNVNetInfo(client, id, vnet);
      }
    }
  },
);

/**
 * Fetch SDN VNet information from Proxmox
 * @internal
 */
async function fetchSDNVNetInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  vnet: string,
): Promise<SDNVNet> {
  const vnetInfo = await client.cluster.sdn.vnets.$(vnet).$get();

  return {
    id,
    vnet,
    zone: (vnetInfo.zone as string) ?? "",
    tag: vnetInfo.tag as number | undefined,
    alias: vnetInfo.alias as string | undefined,
    vlanaware: Boolean(vnetInfo.vlanaware),
    pending: Boolean(vnetInfo.pending),
    state: vnetInfo.state as string | undefined,
    type: "vnet",
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
