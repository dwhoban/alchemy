import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating an SDN Subnet
 */
export interface SDNSubnetProps extends ProxmoxApiOptions {
  /**
   * Subnet ID (CIDR format, e.g., '10.0.0.0-24')
   * Note: Use '-' instead of '/' in the ID
   */
  subnet: string;

  /**
   * VNet this subnet belongs to
   */
  vnet: string;

  /**
   * Gateway IP address
   */
  gateway?: string;

  /**
   * Enable SNAT (Source NAT)
   * @default false
   */
  snat?: boolean;

  /**
   * DNS nameserver
   */
  dnszoneprefix?: string;

  /**
   * DHCP range start-end (e.g., 'start-address=10.0.0.10,end-address=10.0.0.100')
   */
  dhcpRange?: string;

  /**
   * Subnet type (currently only 'subnet' is supported)
   */
  type?: string;

  /**
   * Whether to delete the subnet when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after SDNSubnet creation/update
 */
export interface SDNSubnet {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Subnet ID (CIDR format with - instead of /)
   */
  subnet: string;

  /**
   * VNet this subnet belongs to
   */
  vnet: string;

  /**
   * Gateway IP address
   */
  gateway?: string;

  /**
   * Whether SNAT is enabled
   */
  snat: boolean;

  /**
   * DNS zone prefix
   */
  dnszoneprefix?: string;

  /**
   * DHCP range
   */
  dhcpRange?: string;

  /**
   * CIDR in standard format
   */
  cidr: string;

  /**
   * Network address
   */
  network: string;

  /**
   * Subnet mask bits
   */
  mask: number;

  /**
   * Resource type
   */
  type: "subnet";
}

/**
 * Type guard to check if a resource is an SDNSubnet
 */
export function isSDNSubnet(resource: unknown): resource is SDNSubnet {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::SDNSubnet"
  );
}

/**
 * Creates and manages a Proxmox SDN Subnet.
 *
 * @example
 * ## Create a subnet with gateway
 *
 * Create a subnet for a VNet:
 *
 * ```ts
 * import { SDNSubnet, SDNVNet } from "alchemy/proxmox";
 *
 * const vnet = await SDNVNet("app-network", {
 *   vnet: "app-network",
 *   zone: "internal",
 * });
 *
 * const subnet = await SDNSubnet("app-subnet", {
 *   subnet: "10.0.1.0-24",  // Use - instead of /
 *   vnet: vnet.vnet,
 *   gateway: "10.0.1.1",
 * });
 * ```
 *
 * @example
 * ## Create a subnet with DHCP
 *
 * Create a subnet with DHCP range:
 *
 * ```ts
 * import { SDNSubnet } from "alchemy/proxmox";
 *
 * const subnet = await SDNSubnet("dhcp-subnet", {
 *   subnet: "192.168.100.0-24",
 *   vnet: "app-network",
 *   gateway: "192.168.100.1",
 *   dhcpRange: "start-address=192.168.100.10,end-address=192.168.100.200",
 * });
 * ```
 *
 * @example
 * ## Create a subnet with SNAT
 *
 * Create a subnet with source NAT enabled:
 *
 * ```ts
 * import { SDNSubnet } from "alchemy/proxmox";
 *
 * const subnet = await SDNSubnet("nat-subnet", {
 *   subnet: "10.100.0.0-16",
 *   vnet: "private-network",
 *   gateway: "10.100.0.1",
 *   snat: true,
 * });
 * ```
 */
export const SDNSubnet = Resource(
  "proxmox::SDNSubnet",
  async function (
    this: Context<SDNSubnet>,
    id: string,
    props: SDNSubnetProps,
  ): Promise<SDNSubnet> {
    const client = await createProxmoxClient(props);
    const subnet = props.subnet;
    const vnet = props.vnet;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.subnet) {
          try {
            await client.cluster.sdn.vnets
              .$(vnet)
              .subnets.$(this.output.subnet)
              .$delete();
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
          subnet,
          type: props.type ?? "subnet",
        };

        if (props.gateway) createParams.gateway = props.gateway;
        if (props.snat !== undefined) createParams.snat = props.snat ? 1 : 0;
        if (props.dnszoneprefix) createParams.dnszoneprefix = props.dnszoneprefix;
        if (props.dhcpRange) createParams["dhcp-range"] = props.dhcpRange;

        await client.cluster.sdn.vnets
          .$(vnet)
          .subnets.$post(
            createParams as Parameters<
              (typeof client.cluster.sdn.vnets.$get)[0]["subnets"]["$post"]
            >[0],
          );

        // Apply SDN changes
        await client.cluster.sdn.$put();

        return fetchSDNSubnetInfo(client, id, vnet, subnet);
      }

      case "update": {
        const updateParams: Record<string, unknown> = {};

        if (props.gateway) updateParams.gateway = props.gateway;
        if (props.snat !== undefined) updateParams.snat = props.snat ? 1 : 0;
        if (props.dnszoneprefix) updateParams.dnszoneprefix = props.dnszoneprefix;
        if (props.dhcpRange) updateParams["dhcp-range"] = props.dhcpRange;

        await client.cluster.sdn.vnets
          .$(vnet)
          .subnets.$(subnet)
          .$put(
            updateParams as Parameters<
              (typeof client.cluster.sdn.vnets.$get)[0]["subnets"]["$get"][0]["$put"]
            >[0],
          );

        // Apply SDN changes
        await client.cluster.sdn.$put();

        return fetchSDNSubnetInfo(client, id, vnet, subnet);
      }
    }
  },
);

/**
 * Fetch SDN subnet information from Proxmox
 * @internal
 */
async function fetchSDNSubnetInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  vnet: string,
  subnet: string,
): Promise<SDNSubnet> {
  const subnetInfo = await client.cluster.sdn.vnets
    .$(vnet)
    .subnets.$(subnet)
    .$get();

  // Parse subnet to get network and mask
  const [network, maskStr] = subnet.replace("-", "/").split("/");
  const mask = Number.parseInt(maskStr, 10);
  const cidr = `${network}/${mask}`;

  return {
    id,
    subnet,
    vnet,
    gateway: subnetInfo.gateway as string | undefined,
    snat: Boolean(subnetInfo.snat),
    dnszoneprefix: subnetInfo.dnszoneprefix as string | undefined,
    dhcpRange: subnetInfo["dhcp-range"] as string | undefined,
    cidr,
    network,
    mask,
    type: "subnet",
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
