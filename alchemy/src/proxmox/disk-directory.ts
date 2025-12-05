import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for creating a disk directory
 */
export interface DiskDirectoryProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * Storage name
   */
  name: string;

  /**
   * Block device path (e.g., /dev/sdb1)
   */
  device: string;

  /**
   * Filesystem type
   * @default "ext4"
   */
  filesystem?: "ext4" | "xfs";

  /**
   * Add storage to Proxmox configuration
   * @default true
   */
  add_storage?: boolean;

  /**
   * Whether to delete when destroyed
   * @default false
   */
  delete?: boolean;
}

/**
 * Output returned after DiskDirectory creation
 */
export interface DiskDirectory {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Storage name
   */
  name: string;

  /**
   * Block device
   */
  device: string;

  /**
   * Filesystem type
   */
  filesystem: string;

  /**
   * Mount path
   */
  path?: string;

  /**
   * Device UUID
   */
  uuid?: string;
}

/**
 * Type guard to check if a resource is a DiskDirectory
 */
export function isDiskDirectory(resource: unknown): resource is DiskDirectory {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::DiskDirectory"
  );
}

/**
 * Creates directory-based storage on a Proxmox node disk.
 *
 * @example
 * ## Create directory storage
 *
 * Create ext4 directory storage on a disk:
 *
 * ```ts
 * import { DiskDirectory } from "alchemy/proxmox";
 *
 * const dir = await DiskDirectory("backup-storage", {
 *   node: "pve",
 *   name: "backup-storage",
 *   device: "/dev/sdb1",
 *   filesystem: "ext4",
 * });
 * ```
 *
 * @example
 * ## Create XFS storage
 *
 * Create XFS directory storage:
 *
 * ```ts
 * import { DiskDirectory } from "alchemy/proxmox";
 *
 * const dir = await DiskDirectory("data-storage", {
 *   node: "pve",
 *   name: "data",
 *   device: "/dev/nvme0n1p1",
 *   filesystem: "xfs",
 * });
 * ```
 */
export const DiskDirectory = Resource(
  "proxmox::DiskDirectory",
  async function (
    this: Context<DiskDirectory>,
    id: string,
    props: DiskDirectoryProps,
  ): Promise<DiskDirectory> {
    const client = await createProxmoxClient(props);
    const { node, name, device } = props;
    const filesystem = props.filesystem ?? "ext4";

    switch (this.phase) {
      case "delete": {
        // Directory storage deletion is not typically automated
        // User should manually unmount and clean up
        return this.destroy();
      }

      case "create": {
        const createParams: Record<string, unknown> = {
          name,
          device,
          filesystem,
        };

        if (props.add_storage !== false) {
          createParams.add_storage = 1;
        }

        await client.nodes
          .$(node)
          .disks.directory.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["disks"]["directory"]["$post"]
            >[0],
          );

        await waitForTask(client, node);

        return fetchDirectoryInfo(client, id, node, name, device, filesystem);
      }

      case "update": {
        // Directory storage doesn't support updates
        return fetchDirectoryInfo(client, id, node, name, device, filesystem);
      }
    }
  },
);

/**
 * Fetch directory storage info
 * @internal
 */
async function fetchDirectoryInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
  name: string,
  device: string,
  filesystem: string,
): Promise<DiskDirectory> {
  try {
    const dirs = await client.nodes.$(node).disks.directory.$get();
    const dirsArray = dirs as Array<Record<string, unknown>>;
    const dirInfo = dirsArray.find(
      (d) => d.path === `/mnt/datastore/${name}` || d.device === device,
    );

    return {
      id,
      node,
      name,
      device,
      filesystem,
      path: dirInfo?.path as string | undefined,
      uuid: dirInfo?.uuid as string | undefined,
    };
  } catch {
    return {
      id,
      node,
      name,
      device,
      filesystem,
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
