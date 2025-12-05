import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for migrating a Container
 */
export interface ContainerMigrateProps extends ProxmoxApiOptions {
  /**
   * Source node name
   */
  node: string;

  /**
   * Container ID to migrate
   */
  vmid: number;

  /**
   * Target node for migration
   */
  target: string;

  /**
   * Allow migration while container is running
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
   * Restart container after migration
   * @default true
   */
  restart?: boolean;

  /**
   * Bandwidth limit for migration (MiB/s)
   */
  bwlimit?: number;

  /**
   * Timeout for container shutdown (seconds)
   */
  timeout?: number;

  /**
   * Whether to rollback on delete
   * @default false
   */
  delete?: boolean;
}

/**
 * Output returned after Container Migration
 */
export interface ContainerMigrate {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Original source node
   */
  sourceNode: string;

  /**
   * Container ID
   */
  vmid: number;

  /**
   * Current node (after migration)
   */
  node: string;

  /**
   * Whether this was an online migration
   */
  online: boolean;

  /**
   * Task ID for the migration operation
   */
  taskId?: string;
}

/**
 * Type guard to check if a resource is a ContainerMigrate
 */
export function isContainerMigrate(
  resource: unknown,
): resource is ContainerMigrate {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::ContainerMigrate"
  );
}

/**
 * Migrates a Proxmox Container to another node.
 *
 * @example
 * ## Migrate a running container
 *
 * Migrate a container with minimal downtime:
 *
 * ```ts
 * import { ContainerMigrate } from "alchemy/proxmox";
 *
 * const migration = await ContainerMigrate("move-app", {
 *   node: "pve1",
 *   vmid: 200,
 *   target: "pve2",
 *   online: true,
 *   restart: true,
 * });
 * ```
 *
 * @example
 * ## Offline migration with storage
 *
 * Migrate a container with its storage:
 *
 * ```ts
 * import { ContainerMigrate } from "alchemy/proxmox";
 *
 * const migration = await ContainerMigrate("relocate-ct", {
 *   node: "pve1",
 *   vmid: 200,
 *   target: "pve2",
 *   online: false,
 *   targetstorage: "local-lvm",
 * });
 * ```
 */
export const ContainerMigrate = Resource(
  "proxmox::ContainerMigrate",
  async function (
    this: Context<ContainerMigrate>,
    id: string,
    props: ContainerMigrateProps,
  ): Promise<ContainerMigrate> {
    const client = await createProxmoxClient(props);
    const { node, vmid, target } = props;

    switch (this.phase) {
      case "delete": {
        // Migration back is not automatic
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
        if (props.restart !== undefined)
          migrateParams.restart = props.restart ? 1 : 0;
        if (props.bwlimit) migrateParams.bwlimit = props.bwlimit;
        if (props.timeout) migrateParams.timeout = props.timeout;

        // Start migration
        const taskId = await client.nodes
          .$(node)
          .lxc.$(vmid)
          .migrate.$post(
            migrateParams as Parameters<
              (typeof client.nodes.$get)[0]["lxc"]["$get"][0]["migrate"]["$post"]
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
