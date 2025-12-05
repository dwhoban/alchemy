import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * SDN Zone type
 */
export type SDNZoneType =
  | "simple"
  | "vlan"
  | "qinq"
  | "vxlan"
  | "evpn";

/**
 * Properties for creating or updating an SDN Zone
 */
export interface SDNZoneProps extends ProxmoxApiOptions {
  /**
   * Zone ID
   */
  zone: string;

  /**
   * Zone type
   */
  type: SDNZoneType;

  /**
   * Bridge name for the zone
   */
  bridge?: string;

  /**
   * MTU size
   */
  mtu?: number;

  /**
   * Nodes where zone is available (comma-separated)
   */
  nodes?: string;

  /**
   * VLAN protocol (for vlan/qinq types)
   */
  vlanProtocol?: "802.1q" | "802.1ad";

  /**
   * IPAM (IP Address Management) to use
   */
  ipam?: string;

  /**
   * DNS domain for this zone
   */
  dns?: string;

  /**
   * DNS zone for reverse lookups
   */
  reversedns?: string;

  /**
   * DNS server
   */
  dnszone?: string;

  /**
   * Peers for VXLAN zones
   */
  peers?: string;

  /**
   * VRF for EVPN
   */
  vrf?: string;

  /**
   * Controller for this zone
   */
  controller?: string;

  /**
   * Disable automatic MAC learning
   * @default false
   */
  disableArpNdSuppression?: boolean;

  /**
   * Whether to delete the zone when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after SDNZone creation/update
 */
export interface SDNZone {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Zone ID
   */
  zone: string;

  /**
   * Zone type
   */
  type: SDNZoneType;

  /**
   * Bridge name
   */
  bridge?: string;

  /**
   * MTU size
   */
  mtu?: number;

  /**
   * Available nodes
   */
  nodes?: string;

  /**
   * VLAN protocol
   */
  vlanProtocol?: string;

  /**
   * IPAM being used
   */
  ipam?: string;

  /**
   * DNS domain
   */
  dns?: string;

  /**
   * Pending changes exist
   */
  pending: boolean;

  /**
   * Zone state
   */
  state?: string;
}

/**
 * Type guard to check if a resource is an SDNZone
 */
export function isSDNZone(resource: unknown): resource is SDNZone {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::SDNZone"
  );
}

/**
 * Creates and manages a Proxmox SDN (Software Defined Networking) Zone.
 *
 * @example
 * ## Create a simple zone
 *
 * Create a simple bridged zone:
 *
 * ```ts
 * import { SDNZone } from "alchemy/proxmox";
 *
 * const zone = await SDNZone("internal", {
 *   zone: "internal",
 *   type: "simple",
 *   bridge: "vmbr1",
 *   mtu: 1500,
 * });
 * ```
 *
 * @example
 * ## Create a VLAN zone
 *
 * Create a zone with VLAN support:
 *
 * ```ts
 * import { SDNZone } from "alchemy/proxmox";
 *
 * const zone = await SDNZone("production", {
 *   zone: "production",
 *   type: "vlan",
 *   bridge: "vmbr0",
 *   vlanProtocol: "802.1q",
 * });
 * ```
 *
 * @example
 * ## Create a VXLAN zone
 *
 * Create an overlay network zone:
 *
 * ```ts
 * import { SDNZone } from "alchemy/proxmox";
 *
 * const zone = await SDNZone("overlay", {
 *   zone: "overlay",
 *   type: "vxlan",
 *   peers: "10.0.0.1,10.0.0.2,10.0.0.3",
 *   mtu: 1450,
 * });
 * ```
 */
export const SDNZone = Resource(
  "proxmox::SDNZone",
  async function (
    this: Context<SDNZone>,
    id: string,
    props: SDNZoneProps,
  ): Promise<SDNZone> {
    const client = await createProxmoxClient(props);
    const zone = props.zone;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.zone) {
          try {
            await client.cluster.sdn.zones.$(this.output.zone).$delete();
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
        const createParams = buildSDNZoneParams(props);

        await client.cluster.sdn.zones.$post(
          createParams as Parameters<typeof client.cluster.sdn.zones.$post>[0],
        );

        // Apply SDN changes
        await client.cluster.sdn.$put();

        return fetchSDNZoneInfo(client, id, zone);
      }

      case "update": {
        const updateParams = buildSDNZoneParams(props);
        delete (updateParams as Record<string, unknown>).zone;
        delete (updateParams as Record<string, unknown>).type;

        await client.cluster.sdn.zones
          .$(zone)
          .$put(
            updateParams as Parameters<
              (typeof client.cluster.sdn.zones.$get)[0]["$put"]
            >[0],
          );

        // Apply SDN changes
        await client.cluster.sdn.$put();

        return fetchSDNZoneInfo(client, id, zone);
      }
    }
  },
);

/**
 * Build SDN zone parameters
 * @internal
 */
function buildSDNZoneParams(props: SDNZoneProps): Record<string, unknown> {
  const params: Record<string, unknown> = {
    zone: props.zone,
    type: props.type,
  };

  if (props.bridge) params.bridge = props.bridge;
  if (props.mtu) params.mtu = props.mtu;
  if (props.nodes) params.nodes = props.nodes;
  if (props.vlanProtocol) params["vlan-protocol"] = props.vlanProtocol;
  if (props.ipam) params.ipam = props.ipam;
  if (props.dns) params.dns = props.dns;
  if (props.reversedns) params.reversedns = props.reversedns;
  if (props.dnszone) params.dnszone = props.dnszone;
  if (props.peers) params.peers = props.peers;
  if (props.vrf) params.vrf = props.vrf;
  if (props.controller) params.controller = props.controller;
  if (props.disableArpNdSuppression !== undefined)
    params["disable-arp-nd-suppression"] = props.disableArpNdSuppression ? 1 : 0;

  return params;
}

/**
 * Fetch SDN zone information from Proxmox
 * @internal
 */
async function fetchSDNZoneInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  zone: string,
): Promise<SDNZone> {
  const zoneInfo = await client.cluster.sdn.zones.$(zone).$get();

  return {
    id,
    zone,
    type: (zoneInfo.type as SDNZoneType) ?? "simple",
    bridge: zoneInfo.bridge as string | undefined,
    mtu: zoneInfo.mtu as number | undefined,
    nodes: zoneInfo.nodes as string | undefined,
    vlanProtocol: zoneInfo["vlan-protocol"] as string | undefined,
    ipam: zoneInfo.ipam as string | undefined,
    dns: zoneInfo.dns as string | undefined,
    pending: Boolean(zoneInfo.pending),
    state: zoneInfo.state as string | undefined,
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
