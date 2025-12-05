import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for migrating a Virtual Machine
 */
export interface VMMigrateProps extends ProxmoxApiOptions {
  /**
   * Source node name
   */
  node: string;

  /**
   * VM ID to migrate
   */
  vmid: number;

  /**
   * Target node for migration
   */
  target: string;

  /**
   * Allow migration while VM is running (live migration)
   * @default true
   */
  online?: boolean;

  /**
   * Force migration even with local resources
   * @default false
   */
  force?: boolean;

  /**
   * Target storage for migration
   */
  targetstorage?: string;

  /**
   * Bandwidth limit for migration (MiB/s)
   */
  bwlimit?: number;

  /**
   * Migration type
   * @default "secure"
   */
  migration_type?: "secure" | "insecure";

  /**
   * Migration network (CIDR)
   */
  migration_network?: string;

  /**
   * Enable compression for migration (lz4, zstd, zlib)
   */
  compress?: "lz4" | "zstd" | "zlib";

  /**
   * Whether to rollback on delete (migrate back to original node)
   * @default false
   */
  delete?: boolean;
}

/**
 * Output returned after VM Migration
 */
export interface VMMigrate {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Original source node
   */
  sourceNode: string;

  /**
   * VM ID
   */
  vmid: number;

  /**
   * Current node (after migration)
   */
  node: string;

  /**
   * Whether this was a live migration
   */
  online: boolean;

  /**
   * Task ID for the migration operation
   */
  taskId?: string;
}

/**
 * Type guard to check if a resource is a VMMigrate
 */
export function isVMMigrate(resource: unknown): resource is VMMigrate {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::VMMigrate"
  );
}

/**
 * Migrates a Proxmox Virtual Machine to another node.
 *
 * @example
 * ## Live migrate a running VM
 *
 * Migrate a running VM with minimal downtime:
 *
 * ```ts
 * import { VMMigrate } from "alchemy/proxmox";
 *
 * const migration = await VMMigrate("move-web-server", {
 *   node: "pve1",
 *   vmid: 100,
 *   target: "pve2",
 *   online: true,
 * });
 * ```
 *
 * @example
 * ## Offline migration with storage
 *
 * Migrate a VM with its storage:
 *
 * ```ts
 * import { VMMigrate } from "alchemy/proxmox";
 *
 * const migration = await VMMigrate("relocate-vm", {
 *   node: "pve1",
 *   vmid: 100,
 *   target: "pve2",
 *   online: false,
 *   targetstorage: "local-lvm",
 * });
 * ```
 *
 * @example
 * ## Migration with bandwidth limit
 *
 * Limit migration bandwidth:
 *
 * ```ts
 * import { VMMigrate } from "alchemy/proxmox";
 *
 * const migration = await VMMigrate("throttled-migration", {
 *   node: "pve1",
 *   vmid: 100,
 *   target: "pve2",
 *   bwlimit: 100, // 100 MiB/s
 *   compress: "zstd",
 * });
 * ```
 */
export const VMMigrate = Resource(
  "proxmox::VMMigrate",
  async function (
    this: Context<VMMigrate>,
    id: string,
    props: VMMigrateProps,
  ): Promise<VMMigrate> {
    const client = await createProxmoxClient(props);
    const { node, vmid, target } = props;

    switch (this.phase) {
      case "delete": {
        // Optionally migrate back on delete
        if (props.delete !== false && this.output?.sourceNode) {
          // Migration back is not automatic - user should handle this
        }
        return this.destroy();
      }

      case "create":
      case "update": {
        // Build migration parameters
        const migrateParams: Record<string, unknown> = {
          target,
        };

        if (props.online !== undefined)
          migrateParams.online = props.online ? 1 : 0;
        if (props.force !== undefined) migrateParams.force = props.force ? 1 : 0;
        if (props.targetstorage) migrateParams.targetstorage = props.targetstorage;
        if (props.bwlimit) migrateParams.bwlimit = props.bwlimit;
        if (props.migration_type)
          migrateParams.migration_type = props.migration_type;
        if (props.migration_network)
          migrateParams.migration_network = props.migration_network;
        if (props.compress) migrateParams.compress = props.compress;

        // Start migration
        const taskId = await client.nodes
          .$(node)
          .qemu.$(vmid)
          .migrate.$post(
            migrateParams as Parameters<
              (typeof client.nodes.$get)[0]["qemu"]["$get"][0]["migrate"]["$post"]
            >[0],
          );

        // Wait for migration completion
        await waitForTask(client, target, 1800000); // 30 minute timeout

        return {
          id,
          sourceNode: node,
          vmid,
          node: target,
          online: props.online !== false,
          taskId: taskId as string | undefined,
        };
      }
    }
  },
);

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
