import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Cluster resource type
 */
export type ClusterResourceType =
  | "vm"
  | "storage"
  | "node"
  | "sdn";

/**
 * Properties for querying cluster resources
 */
export interface ClusterResourcesProps extends ProxmoxApiOptions {
  /**
   * Filter by resource type
   */
  type?: ClusterResourceType;
}

/**
 * VM/Container resource info
 */
export interface VMResource {
  /**
   * Resource ID
   */
  id: string;

  /**
   * Resource type (qemu, lxc)
   */
  type: "qemu" | "lxc";

  /**
   * VM ID
   */
  vmid: number;

  /**
   * VM name
   */
  name?: string;

  /**
   * Node hosting the VM
   */
  node: string;

  /**
   * VM status
   */
  status: string;

  /**
   * Template flag
   */
  template?: boolean;

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
   * CPU usage
   */
  cpu?: number;

  /**
   * Max CPU cores
   */
  maxcpu?: number;

  /**
   * Uptime in seconds
   */
  uptime?: number;

  /**
   * Pool membership
   */
  pool?: string;

  /**
   * HA state
   */
  hastate?: string;
}

/**
 * Storage resource info
 */
export interface StorageResource {
  /**
   * Resource ID
   */
  id: string;

  /**
   * Resource type
   */
  type: "storage";

  /**
   * Storage name
   */
  storage: string;

  /**
   * Node the storage is on
   */
  node: string;

  /**
   * Storage status
   */
  status: string;

  /**
   * Total size in bytes
   */
  maxdisk?: number;

  /**
   * Used size in bytes
   */
  disk?: number;

  /**
   * Shared storage flag
   */
  shared?: boolean;

  /**
   * Storage content types
   */
  content?: string;
}

/**
 * Node resource info
 */
export interface NodeResource {
  /**
   * Resource ID
   */
  id: string;

  /**
   * Resource type
   */
  type: "node";

  /**
   * Node name
   */
  node: string;

  /**
   * Node status
   */
  status: string;

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
   * CPU usage
   */
  cpu?: number;

  /**
   * Max CPU cores
   */
  maxcpu?: number;

  /**
   * Uptime in seconds
   */
  uptime?: number;
}

/**
 * Output returned after ClusterResources query
 */
export interface ClusterResources {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Filter type used
   */
  type?: ClusterResourceType;

  /**
   * All resources (when type not specified)
   */
  resources: Array<VMResource | StorageResource | NodeResource>;

  /**
   * VM resources
   */
  vms?: VMResource[];

  /**
   * Storage resources
   */
  storages?: StorageResource[];

  /**
   * Node resources
   */
  nodes?: NodeResource[];

  /**
   * Total VMs count
   */
  totalVMs: number;

  /**
   * Running VMs count
   */
  runningVMs: number;

  /**
   * Total containers count
   */
  totalContainers: number;

  /**
   * Running containers count
   */
  runningContainers: number;
}

/**
 * Type guard to check if a resource is a ClusterResources
 */
export function isClusterResources(
  resource: unknown,
): resource is ClusterResources {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::ClusterResources"
  );
}

/**
 * Queries Proxmox cluster resources summary.
 *
 * @example
 * ## Get all cluster resources
 *
 * Query all resources in the cluster:
 *
 * ```ts
 * import { ClusterResources } from "alchemy/proxmox";
 *
 * const resources = await ClusterResources("all", {});
 * console.log(`Total VMs: ${resources.totalVMs}`);
 * console.log(`Running: ${resources.runningVMs}`);
 * ```
 *
 * @example
 * ## Get only VMs
 *
 * Query only virtual machines:
 *
 * ```ts
 * import { ClusterResources } from "alchemy/proxmox";
 *
 * const resources = await ClusterResources("vms-only", {
 *   type: "vm",
 * });
 * for (const vm of resources.vms ?? []) {
 *   console.log(`${vm.name}: ${vm.status}`);
 * }
 * ```
 *
 * @example
 * ## Get storage summary
 *
 * Query storage resources:
 *
 * ```ts
 * import { ClusterResources } from "alchemy/proxmox";
 *
 * const resources = await ClusterResources("storage", {
 *   type: "storage",
 * });
 * for (const storage of resources.storages ?? []) {
 *   const used = (storage.disk ?? 0) / (storage.maxdisk ?? 1) * 100;
 *   console.log(`${storage.storage}: ${used.toFixed(1)}% used`);
 * }
 * ```
 */
export const ClusterResources = Resource(
  "proxmox::ClusterResources",
  async function (
    this: Context<ClusterResources>,
    id: string,
    props: ClusterResourcesProps,
  ): Promise<ClusterResources> {
    const client = await createProxmoxClient(props);

    // This is a read-only resource
    if (this.phase === "delete") {
      return this.destroy();
    }

    // Get cluster resources
    const params: Record<string, unknown> = {};
    if (props.type) params.type = props.type;

    const resources = await client.cluster.resources.$get(
      params as Parameters<typeof client.cluster.resources.$get>[0],
    );
    const resourcesArray = resources as Array<Record<string, unknown>>;

    // Parse and categorize resources
    const vms: VMResource[] = [];
    const storages: StorageResource[] = [];
    const nodes: NodeResource[] = [];

    for (const r of resourcesArray) {
      const rType = r.type as string;

      if (rType === "qemu" || rType === "lxc") {
        vms.push({
          id: r.id as string,
          type: rType,
          vmid: r.vmid as number,
          name: r.name as string | undefined,
          node: r.node as string,
          status: r.status as string,
          template: Boolean(r.template),
          mem: r.mem as number | undefined,
          maxmem: r.maxmem as number | undefined,
          disk: r.disk as number | undefined,
          maxdisk: r.maxdisk as number | undefined,
          cpu: r.cpu as number | undefined,
          maxcpu: r.maxcpu as number | undefined,
          uptime: r.uptime as number | undefined,
          pool: r.pool as string | undefined,
          hastate: r.hastate as string | undefined,
        });
      } else if (rType === "storage") {
        storages.push({
          id: r.id as string,
          type: "storage",
          storage: r.storage as string,
          node: r.node as string,
          status: r.status as string,
          maxdisk: r.maxdisk as number | undefined,
          disk: r.disk as number | undefined,
          shared: Boolean(r.shared),
          content: r.content as string | undefined,
        });
      } else if (rType === "node") {
        nodes.push({
          id: r.id as string,
          type: "node",
          node: r.node as string,
          status: r.status as string,
          mem: r.mem as number | undefined,
          maxmem: r.maxmem as number | undefined,
          disk: r.disk as number | undefined,
          maxdisk: r.maxdisk as number | undefined,
          cpu: r.cpu as number | undefined,
          maxcpu: r.maxcpu as number | undefined,
          uptime: r.uptime as number | undefined,
        });
      }
    }

    // Calculate counts
    const qemuVMs = vms.filter((v) => v.type === "qemu");
    const lxcVMs = vms.filter((v) => v.type === "lxc");

    return {
      id,
      type: props.type,
      resources: [...vms, ...storages, ...nodes],
      vms: props.type === "vm" || !props.type ? vms : undefined,
      storages: props.type === "storage" || !props.type ? storages : undefined,
      nodes: props.type === "node" || !props.type ? nodes : undefined,
      totalVMs: qemuVMs.length,
      runningVMs: qemuVMs.filter((v) => v.status === "running").length,
      totalContainers: lxcVMs.length,
      runningContainers: lxcVMs.filter((v) => v.status === "running").length,
    };
  },
);
