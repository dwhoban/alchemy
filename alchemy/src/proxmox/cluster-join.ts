import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for joining a node to a cluster
 */
export interface ClusterJoinProps extends ProxmoxApiOptions {
  /**
   * Node name (the node to join to the cluster)
   */
  node: string;

  /**
   * Cluster join information from an existing node
   */
  joinInfo?: string;

  /**
   * IP address of an existing cluster node
   */
  hostname: string;

  /**
   * Password for the cluster node
   */
  password: string;

  /**
   * Fingerprint of the cluster certificate
   */
  fingerprint?: string;

  /**
   * Force join even if issues are detected
   * @default false
   */
  force?: boolean;

  /**
   * Node ID to use
   */
  nodeid?: number;

  /**
   * Number of votes for this node
   * @default 1
   */
  votes?: number;

  /**
   * Ring addresses for cluster communication
   */
  ring0Addr?: string;
  ring1Addr?: string;

  /**
   * Link addresses for Corosync
   */
  link0?: string;
  link1?: string;
}

/**
 * Output returned after ClusterJoin
 */
export interface ClusterJoin {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name that joined
   */
  node: string;

  /**
   * Cluster name
   */
  clusterName?: string;

  /**
   * Node ID assigned
   */
  nodeid?: number;

  /**
   * Whether the join was successful
   */
  joined: boolean;

  /**
   * Task ID for the join operation
   */
  taskId?: string;
}

/**
 * Type guard to check if a resource is a ClusterJoin
 */
export function isClusterJoin(resource: unknown): resource is ClusterJoin {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::ClusterJoin"
  );
}

/**
 * Joins a Proxmox node to an existing cluster.
 *
 * @example
 * ## Join a node to cluster
 *
 * Join a new node to an existing cluster:
 *
 * ```ts
 * import { ClusterJoin } from "alchemy/proxmox";
 *
 * const join = await ClusterJoin("join-pve2", {
 *   node: "pve2",
 *   hostname: "192.168.1.100",
 *   password: alchemy.secret.env.CLUSTER_PASSWORD,
 *   fingerprint: "AB:CD:EF:...",
 * });
 * ```
 *
 * @example
 * ## Join with specific node ID
 *
 * Join with a specific node ID:
 *
 * ```ts
 * import { ClusterJoin } from "alchemy/proxmox";
 *
 * const join = await ClusterJoin("join-pve3", {
 *   node: "pve3",
 *   hostname: "pve1.local",
 *   password: alchemy.secret.env.CLUSTER_PASSWORD,
 *   nodeid: 3,
 *   link0: "10.0.0.3",
 * });
 * ```
 *
 * @example
 * ## Force join
 *
 * Force join even if warnings exist:
 *
 * ```ts
 * import { ClusterJoin } from "alchemy/proxmox";
 *
 * const join = await ClusterJoin("force-join", {
 *   node: "pve4",
 *   hostname: "192.168.1.100",
 *   password: alchemy.secret.env.CLUSTER_PASSWORD,
 *   force: true,
 * });
 * ```
 */
export const ClusterJoin = Resource(
  "proxmox::ClusterJoin",
  async function (
    this: Context<ClusterJoin>,
    id: string,
    props: ClusterJoinProps,
  ): Promise<ClusterJoin> {
    const client = await createProxmoxClient(props);
    const { node, hostname, password } = props;

    // This is a one-time operation, can't be deleted
    if (this.phase === "delete") {
      return this.destroy();
    }

    // If already joined, just return status
    if (this.phase === "update" && this.output?.joined) {
      return {
        ...this.output,
        id,
      };
    }

    // Build join parameters
    const joinParams: Record<string, unknown> = {
      hostname,
      password,
    };

    if (props.fingerprint) joinParams.fingerprint = props.fingerprint;
    if (props.force) joinParams.force = 1;
    if (props.nodeid) joinParams.nodeid = props.nodeid;
    if (props.votes) joinParams.votes = props.votes;
    if (props.ring0Addr) joinParams.ring0_addr = props.ring0Addr;
    if (props.ring1Addr) joinParams.ring1_addr = props.ring1Addr;
    if (props.link0) joinParams.link0 = props.link0;
    if (props.link1) joinParams.link1 = props.link1;

    // Execute join
    const result = await client.cluster.config.join.$post(
      joinParams as Parameters<typeof client.cluster.config.join.$post>[0],
    );

    // Wait for the join task
    const taskId = result as string;
    if (taskId) {
      await waitForTask(client, node, taskId);
    }

    // Get cluster status
    let clusterName: string | undefined;
    try {
      const status = await client.cluster.status.$get();
      const statusArray = status as Array<Record<string, unknown>>;
      const clusterInfo = statusArray.find((s) => s.type === "cluster");
      if (clusterInfo) {
        clusterName = clusterInfo.name as string;
      }
    } catch {
      // Cluster status might not be available immediately
    }

    return {
      id,
      node,
      clusterName,
      nodeid: props.nodeid,
      joined: true,
      taskId: taskId || undefined,
    };
  },
);

/**
 * Wait for a task to complete
 * @internal
 */
async function waitForTask(
  client: ProxmoxClient,
  node: string,
  taskId: string,
  timeoutMs = 300000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const taskStatus = await client.nodes.$(node).tasks.$(taskId).status.$get();
      const statusObj = taskStatus as Record<string, unknown>;
      
      if (statusObj.status === "stopped") {
        if (statusObj.exitstatus !== "OK") {
          throw new Error(`Task failed: ${statusObj.exitstatus}`);
        }
        return;
      }
    } catch {
      // Task might not be accessible yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  
  throw new Error("Task timeout waiting for cluster join");
}
