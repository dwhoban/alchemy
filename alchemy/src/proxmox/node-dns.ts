import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for configuring Node DNS settings
 */
export interface NodeDNSProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * Search domain
   */
  search: string;

  /**
   * Primary DNS server
   */
  dns1?: string;

  /**
   * Secondary DNS server
   */
  dns2?: string;

  /**
   * Tertiary DNS server
   */
  dns3?: string;
}

/**
 * Output returned after NodeDNS configuration
 */
export interface NodeDNS {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Search domain
   */
  search: string;

  /**
   * Primary DNS server
   */
  dns1?: string;

  /**
   * Secondary DNS server
   */
  dns2?: string;

  /**
   * Tertiary DNS server
   */
  dns3?: string;
}

/**
 * Type guard to check if a resource is NodeDNS
 */
export function isNodeDNS(resource: unknown): resource is NodeDNS {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::NodeDNS"
  );
}

/**
 * Configures Proxmox Node DNS settings.
 *
 * @example
 * ## Configure DNS servers
 *
 * Set DNS servers for a node:
 *
 * ```ts
 * import { NodeDNS } from "alchemy/proxmox";
 *
 * const dns = await NodeDNS("node-dns", {
 *   node: "pve",
 *   search: "example.com",
 *   dns1: "8.8.8.8",
 *   dns2: "8.8.4.4",
 * });
 * ```
 *
 * @example
 * ## Configure with local DNS
 *
 * Set local DNS server:
 *
 * ```ts
 * import { NodeDNS } from "alchemy/proxmox";
 *
 * const dns = await NodeDNS("local-dns", {
 *   node: "pve",
 *   search: "local.lan",
 *   dns1: "192.168.1.1",
 * });
 * ```
 */
export const NodeDNS = Resource(
  "proxmox::NodeDNS",
  async function (
    this: Context<NodeDNS>,
    id: string,
    props: NodeDNSProps,
  ): Promise<NodeDNS> {
    const client = await createProxmoxClient(props);
    const { node } = props;

    if (this.phase === "delete") {
      // DNS settings are not deleted, just left as-is
      return this.destroy();
    }

    // Update DNS settings
    const updateParams: Record<string, unknown> = {
      search: props.search,
    };

    if (props.dns1) updateParams.dns1 = props.dns1;
    if (props.dns2) updateParams.dns2 = props.dns2;
    if (props.dns3) updateParams.dns3 = props.dns3;

    await client.nodes
      .$(node)
      .dns.$put(
        updateParams as Parameters<(typeof client.nodes.$get)[0]["dns"]["$put"]>[0],
      );

    // Fetch current DNS settings
    const dns = await client.nodes.$(node).dns.$get();
    const dnsObj = dns as Record<string, unknown>;

    return {
      id,
      node,
      search: (dnsObj.search as string) ?? props.search,
      dns1: (dnsObj.dns1 as string) ?? props.dns1,
      dns2: (dnsObj.dns2 as string) ?? props.dns2,
      dns3: (dnsObj.dns3 as string) ?? props.dns3,
    };
  },
);
