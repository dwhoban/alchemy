import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for querying a Node
 */
export interface NodeProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * Whether to adopt an existing node (read-only resource)
   * @default true
   */
  adopt?: boolean;
}

/**
 * Output returned after Node query
 */
export interface Node {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Node status (online, offline)
   */
  status: string;

  /**
   * CPU usage (0-1 fraction)
   */
  cpu?: number;

  /**
   * Max CPU cores
   */
  maxcpu?: number;

  /**
   * Memory usage in bytes
   */
  mem?: number;

  /**
   * Max memory in bytes
   */
  maxmem?: number;

  /**
   * Disk usage in bytes
   */
  disk?: number;

  /**
   * Max disk in bytes
   */
  maxdisk?: number;

  /**
   * Uptime in seconds
   */
  uptime?: number;

  /**
   * PVE version
   */
  pveversion?: string;

  /**
   * Kernel version
   */
  kversion?: string;

  /**
   * Load average
   */
  loadavg?: string[];

  /**
   * Number of running VMs
   */
  runningqemu?: number;

  /**
   * Number of running containers
   */
  runninglxc?: number;
}

/**
 * Type guard to check if a resource is a Node
 */
export function isNode(resource: unknown): resource is Node {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::Node"
  );
}

/**
 * Queries Proxmox Node information.
 *
 * @example
 * ## Get node status
 *
 * Query a node's status and resources:
 *
 * ```ts
 * import { Node } from "alchemy/proxmox";
 *
 * const node = await Node("pve", {
 *   node: "pve",
 * });
 * console.log(`CPU: ${(node.cpu! * 100).toFixed(1)}%`);
 * console.log(`Memory: ${node.mem! / 1024 / 1024 / 1024}GB`);
 * ```
 *
 * @example
 * ## Monitor node health
 *
 * Check node health metrics:
 *
 * ```ts
 * import { Node } from "alchemy/proxmox";
 *
 * const node = await Node("health", {
 *   node: "pve",
 * });
 * console.log(`Status: ${node.status}`);
 * console.log(`Uptime: ${node.uptime! / 3600} hours`);
 * console.log(`Running VMs: ${node.runningqemu}`);
 * ```
 */
export const Node = Resource(
  "proxmox::Node",
  async function (
    this: Context<Node>,
    id: string,
    props: NodeProps,
  ): Promise<Node> {
    const client = await createProxmoxClient(props);
    const node = props.node;

    // This is a read-only resource
    if (this.phase === "delete") {
      return this.destroy();
    }

    // Fetch node status
    const status = await client.nodes.$(node).status.$get();
    const statusObj = status as Record<string, unknown>;

    // Get node info from cluster resources for additional data
    let runningqemu = 0;
    let runninglxc = 0;

    try {
      const resources = await client.cluster.resources.$get({ type: "vm" });
      const resourcesArray = resources as Array<Record<string, unknown>>;
      for (const res of resourcesArray) {
        if (res.node === node && res.status === "running") {
          if (res.type === "qemu") runningqemu++;
          if (res.type === "lxc") runninglxc++;
        }
      }
    } catch {
      // Ignore errors fetching resources
    }

    return {
      id,
      node,
      status: (statusObj.status as string) ?? "unknown",
      cpu: statusObj.cpu as number | undefined,
      maxcpu: statusObj.cpuinfo
        ? (statusObj.cpuinfo as Record<string, unknown>).cpus as number
        : undefined,
      mem: statusObj.memory
        ? (statusObj.memory as Record<string, unknown>).used as number
        : undefined,
      maxmem: statusObj.memory
        ? (statusObj.memory as Record<string, unknown>).total as number
        : undefined,
      disk: statusObj.rootfs
        ? (statusObj.rootfs as Record<string, unknown>).used as number
        : undefined,
      maxdisk: statusObj.rootfs
        ? (statusObj.rootfs as Record<string, unknown>).total as number
        : undefined,
      uptime: statusObj.uptime as number | undefined,
      pveversion: statusObj.pveversion as string | undefined,
      kversion: statusObj.kversion as string | undefined,
      loadavg: statusObj.loadavg as string[] | undefined,
      runningqemu,
      runninglxc,
    };
  },
);
