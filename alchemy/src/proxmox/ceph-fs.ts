import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for creating or managing a CephFS filesystem
 */
export interface CephFSProps extends ProxmoxApiOptions {
  /**
   * Node name (any node with Ceph installed)
   */
  node: string;

  /**
   * Filesystem name
   */
  name: string;

  /**
   * Number of placement groups for the metadata pool
   * @default 64
   */
  pg_num?: number;

  /**
   * Add storage definition for this CephFS
   * @default false
   */
  add_storage?: boolean;

  /**
   * Whether to delete the filesystem when the resource is destroyed
   * @default false
   */
  delete?: boolean;
}

/**
 * Output returned after CephFS creation/update
 */
export interface CephFS {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Filesystem name
   */
  name: string;

  /**
   * Metadata pool name
   */
  metadata_pool?: string;

  /**
   * Data pool name
   */
  data_pool?: string;

  /**
   * Filesystem state
   */
  state?: string;
}

/**
 * Type guard to check if a resource is a CephFS
 */
export function isCephFS(resource: unknown): resource is CephFS {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::CephFS"
  );
}

/**
 * Creates and manages a Proxmox CephFS filesystem.
 *
 * CephFS provides a POSIX-compliant filesystem on top of Ceph storage.
 * Requires at least one MDS (Metadata Server) to be running.
 *
 * @example
 * ## Create a CephFS filesystem
 *
 * Create a basic CephFS:
 *
 * ```ts
 * import { CephFS } from "alchemy/proxmox";
 *
 * const fs = await CephFS("shared-fs", {
 *   node: "pve",
 *   name: "cephfs",
 * });
 * ```
 *
 * @example
 * ## Create CephFS with storage
 *
 * Create CephFS and add it as storage:
 *
 * ```ts
 * import { CephFS } from "alchemy/proxmox";
 *
 * const fs = await CephFS("vm-share", {
 *   node: "pve",
 *   name: "vm-share",
 *   add_storage: true,
 * });
 * ```
 *
 * @example
 * ## Create CephFS with custom PG count
 *
 * Create CephFS with specific placement groups:
 *
 * ```ts
 * import { CephFS } from "alchemy/proxmox";
 *
 * const fs = await CephFS("data-fs", {
 *   node: "pve",
 *   name: "data-fs",
 *   pg_num: 128,
 * });
 * ```
 */
export const CephFS = Resource(
  "proxmox::CephFS",
  async function (
    this: Context<CephFS>,
    id: string,
    props: CephFSProps,
  ): Promise<CephFS> {
    const client = await createProxmoxClient(props);
    const { node, name } = props;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.name) {
          try {
            await client.nodes
              .$(node)
              .ceph.fs.$(this.output.name)
              .$delete();
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

        if (props.pg_num) createParams.pg_num = props.pg_num;
        if (props.add_storage) createParams.add_storage = 1;

        await client.nodes
          .$(node)
          .ceph.fs.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["ceph"]["fs"]["$post"]
            >[0],
          );

        await waitForTask(client, node);

        return fetchFSInfo(client, id, node, name);
      }

      case "update": {
        // CephFS doesn't support updates, return current state
        return fetchFSInfo(client, id, node, name);
      }
    }
  },
);

/**
 * Fetch CephFS information
 * @internal
 */
async function fetchFSInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
  name: string,
): Promise<CephFS> {
  try {
    const fsList = await client.nodes.$(node).ceph.fs.$get();
    const fsArray = fsList as Array<Record<string, unknown>>;
    const fsInfo = fsArray.find((f) => f.name === name);

    return {
      id,
      node,
      name,
      metadata_pool: fsInfo?.metadata_pool as string | undefined,
      data_pool: fsInfo?.data_pool as string | undefined,
      state: fsInfo?.state as string | undefined,
    };
  } catch {
    return {
      id,
      node,
      name,
    };
  }
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
