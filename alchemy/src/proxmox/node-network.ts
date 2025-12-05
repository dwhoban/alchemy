import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Network interface type
 */
export type NetworkType =
  | "bridge"
  | "bond"
  | "eth"
  | "alias"
  | "vlan"
  | "OVSBridge"
  | "OVSBond"
  | "OVSPort"
  | "OVSIntPort";

/**
 * Bond mode for bonded interfaces
 */
export type BondMode =
  | "balance-rr"
  | "active-backup"
  | "balance-xor"
  | "broadcast"
  | "802.3ad"
  | "balance-tlb"
  | "balance-alb";

/**
 * Properties for creating or updating a Proxmox Node Network interface
 */
export interface NodeNetworkProps extends ProxmoxApiOptions {
  /**
   * Proxmox node name
   */
  node: string;

  /**
   * Interface name (e.g., 'vmbr0', 'eth0', 'bond0')
   */
  iface: string;

  /**
   * Interface type
   */
  type: NetworkType;

  /**
   * IPv4 address (CIDR notation or 'dhcp')
   */
  address?: string;

  /**
   * IPv4 netmask (e.g., '255.255.255.0')
   */
  netmask?: string;

  /**
   * IPv4 gateway
   */
  gateway?: string;

  /**
   * IPv6 address (CIDR notation or 'dhcp', 'auto')
   */
  address6?: string;

  /**
   * IPv6 gateway
   */
  gateway6?: string;

  /**
   * CIDR notation (alternative to address/netmask)
   */
  cidr?: string;

  /**
   * Bridge ports (for bridge type)
   */
  bridgePorts?: string;

  /**
   * Enable bridge VLAN awareness
   * @default false
   */
  bridgeVlanAware?: boolean;

  /**
   * Bond slaves (for bond type)
   */
  bondSlaves?: string;

  /**
   * Bond mode (for bond type)
   */
  bondMode?: BondMode;

  /**
   * VLAN ID (for vlan type)
   */
  vlanId?: number;

  /**
   * VLAN raw device (for vlan type)
   */
  vlanRawDevice?: string;

  /**
   * MTU size
   */
  mtu?: number;

  /**
   * Interface comments
   */
  comments?: string;

  /**
   * Start interface on boot
   * @default true
   */
  autostart?: boolean;

  /**
   * Apply changes immediately (requires reboot otherwise)
   * @default false
   */
  apply?: boolean;

  /**
   * Whether to delete the interface when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after NodeNetwork creation/update
 */
export interface NodeNetwork {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Interface name
   */
  iface: string;

  /**
   * Interface type
   */
  type: NetworkType;

  /**
   * IPv4 address
   */
  address?: string;

  /**
   * IPv4 netmask
   */
  netmask?: string;

  /**
   * IPv4 gateway
   */
  gateway?: string;

  /**
   * IPv6 address
   */
  address6?: string;

  /**
   * IPv6 gateway
   */
  gateway6?: string;

  /**
   * CIDR notation
   */
  cidr?: string;

  /**
   * Whether interface is active
   */
  active: boolean;

  /**
   * Whether interface autostarts
   */
  autostart: boolean;

  /**
   * Bridge ports
   */
  bridgePorts?: string;

  /**
   * Whether bridge is VLAN aware
   */
  bridgeVlanAware?: boolean;

  /**
   * Bond slaves
   */
  bondSlaves?: string;

  /**
   * Bond mode
   */
  bondMode?: string;

  /**
   * MTU size
   */
  mtu?: number;

  /**
   * Interface comments
   */
  comments?: string;

  /**
   * Whether changes exist that require reboot
   */
  pendingChanges: boolean;
}

/**
 * Type guard to check if a resource is a NodeNetwork
 */
export function isNodeNetwork(resource: unknown): resource is NodeNetwork {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::NodeNetwork"
  );
}

/**
 * Creates and manages a Proxmox Node Network interface.
 *
 * @example
 * ## Create a bridge interface
 *
 * Create a network bridge for VMs:
 *
 * ```ts
 * import { NodeNetwork } from "alchemy/proxmox";
 *
 * const bridge = await NodeNetwork("vmbr1", {
 *   node: "pve",
 *   iface: "vmbr1",
 *   type: "bridge",
 *   address: "192.168.100.1",
 *   netmask: "255.255.255.0",
 *   bridgePorts: "eth1",
 *   comments: "Internal network bridge",
 * });
 * ```
 *
 * @example
 * ## Create a VLAN-aware bridge
 *
 * Create a bridge with VLAN support:
 *
 * ```ts
 * import { NodeNetwork } from "alchemy/proxmox";
 *
 * const bridge = await NodeNetwork("vmbr0-vlan", {
 *   node: "pve",
 *   iface: "vmbr0",
 *   type: "bridge",
 *   bridgePorts: "eth0",
 *   bridgeVlanAware: true,
 *   autostart: true,
 * });
 * ```
 *
 * @example
 * ## Create a bond interface
 *
 * Create a bonded interface for redundancy:
 *
 * ```ts
 * import { NodeNetwork } from "alchemy/proxmox";
 *
 * const bond = await NodeNetwork("bond0", {
 *   node: "pve",
 *   iface: "bond0",
 *   type: "bond",
 *   bondSlaves: "eth0 eth1",
 *   bondMode: "802.3ad",
 *   mtu: 9000,
 * });
 * ```
 *
 * @example
 * ## Create a VLAN interface
 *
 * Create a VLAN interface:
 *
 * ```ts
 * import { NodeNetwork } from "alchemy/proxmox";
 *
 * const vlan = await NodeNetwork("vlan100", {
 *   node: "pve",
 *   iface: "eth0.100",
 *   type: "vlan",
 *   vlanId: 100,
 *   vlanRawDevice: "eth0",
 *   address: "10.100.0.1",
 *   netmask: "255.255.255.0",
 * });
 * ```
 */
export const NodeNetwork = Resource(
  "proxmox::NodeNetwork",
  async function (
    this: Context<NodeNetwork>,
    id: string,
    props: NodeNetworkProps,
  ): Promise<NodeNetwork> {
    const client = await createProxmoxClient(props);
    const node = props.node;
    const iface = props.iface;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.iface) {
          try {
            await client.nodes.$(node).network.$(this.output.iface).$delete();

            // Apply changes if requested
            if (props.apply) {
              await client.nodes.$(node).network.$put();
            }
          } catch (error: unknown) {
            // Ignore 404 errors (interface already deleted)
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create": {
        // Build interface configuration
        const createParams: Record<string, unknown> = {
          iface,
          type: props.type,
        };

        addNetworkParams(createParams, props);

        // Create the interface
        await client.nodes
          .$(node)
          .network.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["network"]["$post"]
            >[0],
          );

        // Apply changes if requested
        if (props.apply) {
          await client.nodes.$(node).network.$put();
        }

        return fetchNetworkInfo(client, id, node, iface);
      }

      case "update": {
        // Build update configuration
        const updateParams: Record<string, unknown> = {
          type: props.type,
        };

        addNetworkParams(updateParams, props);

        // Update existing interface
        await client.nodes
          .$(node)
          .network.$(iface)
          .$put(
            updateParams as Parameters<
              (typeof client.nodes.$get)[0]["network"]["$get"][0]["$put"]
            >[0],
          );

        // Apply changes if requested
        if (props.apply) {
          await client.nodes.$(node).network.$put();
        }

        return fetchNetworkInfo(client, id, node, iface);
      }
    }
  },
);

/**
 * Add network parameters to request object
 * @internal
 */
function addNetworkParams(
  params: Record<string, unknown>,
  props: NodeNetworkProps,
): void {
  if (props.address) params.address = props.address;
  if (props.netmask) params.netmask = props.netmask;
  if (props.gateway) params.gateway = props.gateway;
  if (props.address6) params.address6 = props.address6;
  if (props.gateway6) params.gateway6 = props.gateway6;
  if (props.cidr) params.cidr = props.cidr;
  if (props.bridgePorts) params.bridge_ports = props.bridgePorts;
  if (props.bridgeVlanAware !== undefined)
    params.bridge_vlan_aware = props.bridgeVlanAware ? 1 : 0;
  if (props.bondSlaves) params.slaves = props.bondSlaves;
  if (props.bondMode) params.bond_mode = props.bondMode;
  if (props.vlanId) params["vlan-id"] = props.vlanId;
  if (props.vlanRawDevice) params["vlan-raw-device"] = props.vlanRawDevice;
  if (props.mtu) params.mtu = props.mtu;
  if (props.comments) params.comments = props.comments;
  if (props.autostart !== undefined)
    params.autostart = props.autostart ? 1 : 0;
}

/**
 * Fetch network interface information from Proxmox
 * @internal
 */
async function fetchNetworkInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
  iface: string,
): Promise<NodeNetwork> {
  const ifaceInfo = await client.nodes.$(node).network.$(iface).$get();

  return {
    id,
    node,
    iface,
    type: ifaceInfo.type as NetworkType,
    address: ifaceInfo.address as string | undefined,
    netmask: ifaceInfo.netmask as string | undefined,
    gateway: ifaceInfo.gateway as string | undefined,
    address6: ifaceInfo.address6 as string | undefined,
    gateway6: ifaceInfo.gateway6 as string | undefined,
    cidr: ifaceInfo.cidr as string | undefined,
    active: Boolean(ifaceInfo.active),
    autostart: Boolean(ifaceInfo.autostart),
    bridgePorts: ifaceInfo.bridge_ports as string | undefined,
    bridgeVlanAware: Boolean(ifaceInfo.bridge_vlan_aware),
    bondSlaves: ifaceInfo.slaves as string | undefined,
    bondMode: ifaceInfo.bond_mode as string | undefined,
    mtu: ifaceInfo.mtu as number | undefined,
    comments: ifaceInfo.comments as string | undefined,
    pendingChanges: Boolean(ifaceInfo.pending),
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
