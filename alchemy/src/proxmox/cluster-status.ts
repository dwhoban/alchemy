import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for querying Cluster Status
 */
export interface ClusterStatusProps extends ProxmoxApiOptions {
  /**
   * Whether to adopt an existing cluster status (read-only resource)
   * @default true
   */
  adopt?: boolean;
}

/**
 * Node information within the cluster
 */
export interface ClusterNodeInfo {
  /**
   * Node name
   */
  name: string;

  /**
   * Node ID
   */
  nodeid?: number;

  /**
   * Node IP address
   */
  ip?: string;

  /**
   * Node status (online, offline)
   */
  online?: boolean;

  /**
   * Node level (e.g., 'c' for cluster node)
   */
  level?: string;

  /**
   * Whether this is the local node
   */
  local?: boolean;
}

/**
 * Output returned after ClusterStatus query
 */
export interface ClusterStatus {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Cluster name
   */
  name?: string;

  /**
   * Cluster version
   */
  version?: number;

  /**
   * Number of nodes in the cluster
   */
  nodes: number;

  /**
   * Number of quorate nodes
   */
  quorate?: boolean;

  /**
   * List of cluster nodes
   */
  nodeList: ClusterNodeInfo[];
}

/**
 * Type guard to check if a resource is a ClusterStatus
 */
export function isClusterStatus(resource: unknown): resource is ClusterStatus {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::ClusterStatus"
  );
}

/**
 * Queries Proxmox Cluster Status information.
 *
 * @example
 * ## Get cluster status
 *
 * Query cluster status information:
 *
 * ```ts
 * import { ClusterStatus } from "alchemy/proxmox";
 *
 * const status = await ClusterStatus("my-cluster", {});
 * console.log(`Cluster: ${status.name}, Nodes: ${status.nodes}`);
 * ```
 *
 * @example
 * ## Check cluster health
 *
 * Monitor cluster quorum and node status:
 *
 * ```ts
 * import { ClusterStatus } from "alchemy/proxmox";
 *
 * const status = await ClusterStatus("health-check", {});
 * if (status.quorate) {
 *   console.log("Cluster is quorate");
 * }
 * for (const node of status.nodeList) {
 *   console.log(`Node ${node.name}: ${node.online ? "online" : "offline"}`);
 * }
 * ```
 */
export const ClusterStatus = Resource(
  "proxmox::ClusterStatus",
  async function (
    this: Context<ClusterStatus>,
    id: string,
    props: ClusterStatusProps,
  ): Promise<ClusterStatus> {
    const client = await createProxmoxClient(props);

    // This is a read-only resource
    if (this.phase === "delete") {
      return this.destroy();
    }

    // Fetch cluster status
    const statusList = await client.cluster.status.$get();
    const statusArray = statusList as Array<Record<string, unknown>>;

    // Parse cluster info
    const clusterInfo = statusArray.find((s) => s.type === "cluster") as
      | Record<string, unknown>
      | undefined;
    const nodeInfos = statusArray.filter((s) => s.type === "node") as Array<
      Record<string, unknown>
    >;

    const nodeList: ClusterNodeInfo[] = nodeInfos.map((n) => ({
      name: n.name as string,
      nodeid: n.nodeid as number | undefined,
      ip: n.ip as string | undefined,
      online: n.online === 1,
      level: n.level as string | undefined,
      local: n.local === 1,
    }));

    return {
      id,
      name: clusterInfo?.name as string | undefined,
      version: clusterInfo?.version as number | undefined,
      nodes: clusterInfo?.nodes as number ?? nodeList.length,
      quorate: clusterInfo?.quorate === 1,
      nodeList,
    };
  },
);
