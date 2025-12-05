import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for managing node /etc/hosts entries
 */
export interface NodeHostsProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * Hosts file content
   */
  data: string;

  /**
   * Digest to detect concurrent modifications
   */
  digest?: string;
}

/**
 * Output returned after NodeHosts update
 */
export interface NodeHosts {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Current hosts file content
   */
  data: string;

  /**
   * Content digest
   */
  digest?: string;
}

/**
 * Type guard to check if a resource is a NodeHosts
 */
export function isNodeHosts(resource: unknown): resource is NodeHosts {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::NodeHosts"
  );
}

/**
 * Manages a Proxmox node's /etc/hosts file.
 *
 * @example
 * ## Update hosts file
 *
 * Set the hosts file content:
 *
 * ```ts
 * import { NodeHosts } from "alchemy/proxmox";
 *
 * const hosts = await NodeHosts("pve-hosts", {
 *   node: "pve",
 *   data: `127.0.0.1 localhost
 * 192.168.1.100 pve.local pve
 * 192.168.1.101 pve2.local pve2
 * `,
 * });
 * ```
 *
 * @example
 * ## Add cluster node entries
 *
 * Configure hosts for cluster communication:
 *
 * ```ts
 * import { NodeHosts } from "alchemy/proxmox";
 *
 * const hosts = await NodeHosts("cluster-hosts", {
 *   node: "pve",
 *   data: `127.0.0.1 localhost
 * 10.0.0.1 node1.cluster node1
 * 10.0.0.2 node2.cluster node2
 * 10.0.0.3 node3.cluster node3
 * `,
 * });
 * ```
 */
export const NodeHosts = Resource(
  "proxmox::NodeHosts",
  async function (
    this: Context<NodeHosts>,
    id: string,
    props: NodeHostsProps,
  ): Promise<NodeHosts> {
    const client = await createProxmoxClient(props);
    const { node, data } = props;

    // This is a configuration resource, delete just means stop managing
    if (this.phase === "delete") {
      return this.destroy();
    }

    // Get current hosts file to check digest
    const current = await client.nodes.$(node).hosts.$get();
    const currentObj = current as Record<string, unknown>;

    // Update hosts file
    const updateParams: Record<string, unknown> = {
      data,
    };

    if (props.digest) {
      updateParams.digest = props.digest;
    } else if (currentObj.digest) {
      updateParams.digest = currentObj.digest;
    }

    await client.nodes
      .$(node)
      .hosts.$post(
        updateParams as Parameters<
          (typeof client.nodes.$get)[0]["hosts"]["$post"]
        >[0],
      );

    // Fetch updated content
    const updated = await client.nodes.$(node).hosts.$get();
    const updatedObj = updated as Record<string, unknown>;

    return {
      id,
      node,
      data: updatedObj.data as string,
      digest: updatedObj.digest as string | undefined,
    };
  },
);
