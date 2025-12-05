import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for creating or updating a Ceph Pool
 */
export interface CephPoolProps extends ProxmoxApiOptions {
  /**
   * Node name (any node with Ceph installed)
   */
  node: string;

  /**
   * Pool name
   */
  name: string;

  /**
   * Pool type
   * @default "replicated"
   */
  poolType?: "replicated" | "erasure";

  /**
   * Number of placement groups
   * @default 128
   */
  pg_num?: number;

  /**
   * Number of replicas (for replicated pools)
   * @default 3
   */
  size?: number;

  /**
   * Minimum number of replicas for I/O
   * @default 2
   */
  min_size?: number;

  /**
   * CRUSH rule name
   */
  crush_rule?: string;

  /**
   * Erasure coding profile (for erasure pools)
   */
  erasureProfile?: string;

  /**
   * Application tag (rbd, cephfs, rgw)
   * @default "rbd"
   */
  application?: "rbd" | "cephfs" | "rgw";

  /**
   * Add storage definition for this pool
   * @default false
   */
  add_storages?: boolean;

  /**
   * Whether to delete the pool when the resource is destroyed
   * @default false
   */
  delete?: boolean;
}

/**
 * Output returned after CephPool creation/update
 */
export interface CephPool {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Pool name
   */
  name: string;

  /**
   * Pool type
   */
  poolType: string;

  /**
   * Number of placement groups
   */
  pg_num: number;

  /**
   * Number of replicas
   */
  size: number;

  /**
   * Minimum replicas for I/O
   */
  min_size: number;

  /**
   * CRUSH rule
   */
  crush_rule?: string;

  /**
   * Bytes used
   */
  bytes_used?: number;

  /**
   * Percent used
   */
  percent_used?: number;
}

/**
 * Type guard to check if a resource is a CephPool
 */
export function isCephPool(resource: unknown): resource is CephPool {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::CephPool"
  );
}

/**
 * Creates and manages a Proxmox Ceph Pool.
 *
 * @example
 * ## Create a replicated pool
 *
 * Create a standard replicated Ceph pool:
 *
 * ```ts
 * import { CephPool } from "alchemy/proxmox";
 *
 * const pool = await CephPool("vm-pool", {
 *   node: "pve",
 *   name: "vm-pool",
 *   size: 3,
 *   min_size: 2,
 *   pg_num: 128,
 *   application: "rbd",
 * });
 * ```
 *
 * @example
 * ## Create a pool with storage
 *
 * Create a pool and add it as storage:
 *
 * ```ts
 * import { CephPool } from "alchemy/proxmox";
 *
 * const pool = await CephPool("data-pool", {
 *   node: "pve",
 *   name: "data-pool",
 *   add_storages: true,
 * });
 * ```
 *
 * @example
 * ## Create a high-performance pool
 *
 * Create a pool with fewer PGs for small clusters:
 *
 * ```ts
 * import { CephPool } from "alchemy/proxmox";
 *
 * const pool = await CephPool("fast-pool", {
 *   node: "pve",
 *   name: "fast-pool",
 *   pg_num: 64,
 *   size: 2,
 *   min_size: 1,
 * });
 * ```
 */
export const CephPool = Resource(
  "proxmox::CephPool",
  async function (
    this: Context<CephPool>,
    id: string,
    props: CephPoolProps,
  ): Promise<CephPool> {
    const client = await createProxmoxClient(props);
    const { node, name } = props;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.name) {
          try {
            await client.nodes
              .$(node)
              .ceph.pool.$(this.output.name)
              .$delete({ force: 1 } as Parameters<
                (typeof client.nodes.$get)[0]["ceph"]["pool"]["$get"][0]["$delete"]
              >[0]);
            await waitForTask(client, node);
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
          name,
        };

        if (props.poolType) createParams.pool_type = props.poolType;
        if (props.pg_num) createParams.pg_num = props.pg_num;
        if (props.size) createParams.size = props.size;
        if (props.min_size) createParams.min_size = props.min_size;
        if (props.crush_rule) createParams.crush_rule = props.crush_rule;
        if (props.erasureProfile)
          createParams["erasure-coding"] = props.erasureProfile;
        if (props.application) createParams.application = props.application;
        if (props.add_storages) createParams.add_storages = 1;

        await client.nodes
          .$(node)
          .ceph.pool.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["ceph"]["pool"]["$post"]
            >[0],
          );

        await waitForTask(client, node);

        return fetchPoolInfo(client, id, node, name, props);
      }

      case "update": {
        const updateParams: Record<string, unknown> = {};

        if (props.pg_num) updateParams.pg_num = props.pg_num;
        if (props.size) updateParams.size = props.size;
        if (props.min_size) updateParams.min_size = props.min_size;
        if (props.crush_rule) updateParams.crush_rule = props.crush_rule;
        if (props.application) updateParams.application = props.application;

        if (Object.keys(updateParams).length > 0) {
          await client.nodes
            .$(node)
            .ceph.pool.$(name)
            .$put(
              updateParams as Parameters<
                (typeof client.nodes.$get)[0]["ceph"]["pool"]["$get"][0]["$put"]
              >[0],
            );
        }

        return fetchPoolInfo(client, id, node, name, props);
      }
    }
  },
);

/**
 * Fetch Ceph pool information
 * @internal
 */
async function fetchPoolInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
  name: string,
  props: CephPoolProps,
): Promise<CephPool> {
  const pools = await client.nodes.$(node).ceph.pool.$get();
  const poolsArray = pools as Array<Record<string, unknown>>;
  const poolInfo = poolsArray.find((p) => p.pool_name === name || p.name === name);

  return {
    id,
    node,
    name,
    poolType: (poolInfo?.pool_type as string) ?? props.poolType ?? "replicated",
    pg_num: (poolInfo?.pg_num as number) ?? props.pg_num ?? 128,
    size: (poolInfo?.size as number) ?? props.size ?? 3,
    min_size: (poolInfo?.min_size as number) ?? props.min_size ?? 2,
    crush_rule: poolInfo?.crush_rule as string | undefined,
    bytes_used: poolInfo?.bytes_used as number | undefined,
    percent_used: poolInfo?.percent_used as number | undefined,
  };
}

/**
 * Wait for any running task to complete
 * @internal
 */
async function waitForTask(
  client: ProxmoxClient,
  node: string,
  timeoutMs = 300000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const tasks = await client.nodes.$(node).tasks.$get({ running: 1 });
      if (!tasks || (tasks as Array<unknown>).length === 0) {
        return;
      }
    } catch {
      // Tasks endpoint might fail, continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
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
