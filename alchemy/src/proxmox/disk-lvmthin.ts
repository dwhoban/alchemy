import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for creating an LVM-thin volume
 */
export interface DiskLVMThinProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * Storage name
   */
  name: string;

  /**
   * Block device path (e.g., /dev/sdb)
   */
  device: string;

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
 * Output returned after DiskLVMThin creation
 */
export interface DiskLVMThin {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Storage name (LV name)
   */
  name: string;

  /**
   * Block device
   */
  device: string;

  /**
   * Volume group name
   */
  vg?: string;

  /**
   * Thin pool name
   */
  lv?: string;

  /**
   * Total size in bytes
   */
  size?: number;

  /**
   * Used size in bytes
   */
  used?: number;

  /**
   * Metadata size in bytes
   */
  metadata_size?: number;

  /**
   * Metadata used percentage
   */
  metadata_used?: number;
}

/**
 * Type guard to check if a resource is a DiskLVMThin
 */
export function isDiskLVMThin(resource: unknown): resource is DiskLVMThin {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::DiskLVMThin"
  );
}

/**
 * Creates LVM-thin storage on a Proxmox node disk.
 *
 * LVM-thin provides thin provisioning, allowing overcommitment of storage space.
 *
 * @example
 * ## Create LVM-thin storage
 *
 * Create thin-provisioned LVM on a disk:
 *
 * ```ts
 * import { DiskLVMThin } from "alchemy/proxmox";
 *
 * const lvmthin = await DiskLVMThin("vm-storage", {
 *   node: "pve",
 *   name: "vm-storage",
 *   device: "/dev/sdb",
 * });
 * ```
 *
 * @example
 * ## Create LVM-thin without auto-adding storage
 *
 * Create LVM-thin but don't add to Proxmox storage:
 *
 * ```ts
 * import { DiskLVMThin } from "alchemy/proxmox";
 *
 * const lvmthin = await DiskLVMThin("thin-data", {
 *   node: "pve",
 *   name: "thin-data",
 *   device: "/dev/nvme1n1",
 *   add_storage: false,
 * });
 * ```
 */
export const DiskLVMThin = Resource(
  "proxmox::DiskLVMThin",
  async function (
    this: Context<DiskLVMThin>,
    id: string,
    props: DiskLVMThinProps,
  ): Promise<DiskLVMThin> {
    const client = await createProxmoxClient(props);
    const { node, name, device } = props;

    switch (this.phase) {
      case "delete": {
        // LVM-thin deletion is destructive, not typically automated
        return this.destroy();
      }

      case "create": {
        const createParams: Record<string, unknown> = {
          name,
          device,
        };

        if (props.add_storage !== false) {
          createParams.add_storage = 1;
        }

        await client.nodes
          .$(node)
          .disks.lvmthin.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["disks"]["lvmthin"]["$post"]
            >[0],
          );

        await waitForTask(client, node);

        return fetchLVMThinInfo(client, id, node, name, device);
      }

      case "update": {
        // LVM-thin doesn't support updates
        return fetchLVMThinInfo(client, id, node, name, device);
      }
    }
  },
);

/**
 * Fetch LVM-thin info
 * @internal
 */
async function fetchLVMThinInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
  name: string,
  device: string,
): Promise<DiskLVMThin> {
  try {
    const lvmthins = await client.nodes.$(node).disks.lvmthin.$get();
    const lvmthinsArray = lvmthins as Array<Record<string, unknown>>;
    const thinInfo = lvmthinsArray.find((l) => l.lv === name);

    return {
      id,
      node,
      name,
      device,
      vg: thinInfo?.vg as string | undefined,
      lv: thinInfo?.lv as string | undefined,
      size: thinInfo?.size as number | undefined,
      used: thinInfo?.used as number | undefined,
      metadata_size: thinInfo?.metadata_size as number | undefined,
      metadata_used: thinInfo?.metadata_used as number | undefined,
    };
  } catch {
    return {
      id,
      node,
      name,
      device,
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
