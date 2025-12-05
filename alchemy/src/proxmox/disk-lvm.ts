import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for creating an LVM volume
 */
export interface DiskLVMProps extends ProxmoxApiOptions {
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
 * Output returned after DiskLVM creation
 */
export interface DiskLVM {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Storage name (VG name)
   */
  name: string;

  /**
   * Block device
   */
  device: string;

  /**
   * Volume group size in bytes
   */
  size?: number;

  /**
   * Volume group free space in bytes
   */
  free?: number;

  /**
   * Logical volumes count
   */
  lvcount?: number;
}

/**
 * Type guard to check if a resource is a DiskLVM
 */
export function isDiskLVM(resource: unknown): resource is DiskLVM {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::DiskLVM"
  );
}

/**
 * Creates LVM storage on a Proxmox node disk.
 *
 * @example
 * ## Create LVM storage
 *
 * Create LVM volume group on a disk:
 *
 * ```ts
 * import { DiskLVM } from "alchemy/proxmox";
 *
 * const lvm = await DiskLVM("vm-storage", {
 *   node: "pve",
 *   name: "vm-storage",
 *   device: "/dev/sdb",
 * });
 * ```
 *
 * @example
 * ## Create LVM without auto-adding storage
 *
 * Create LVM but don't add to Proxmox storage:
 *
 * ```ts
 * import { DiskLVM } from "alchemy/proxmox";
 *
 * const lvm = await DiskLVM("data-vg", {
 *   node: "pve",
 *   name: "data-vg",
 *   device: "/dev/nvme1n1",
 *   add_storage: false,
 * });
 * ```
 */
export const DiskLVM = Resource(
  "proxmox::DiskLVM",
  async function (
    this: Context<DiskLVM>,
    id: string,
    props: DiskLVMProps,
  ): Promise<DiskLVM> {
    const client = await createProxmoxClient(props);
    const { node, name, device } = props;

    switch (this.phase) {
      case "delete": {
        // LVM deletion is destructive, not typically automated
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
          .disks.lvm.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["disks"]["lvm"]["$post"]
            >[0],
          );

        await waitForTask(client, node);

        return fetchLVMInfo(client, id, node, name, device);
      }

      case "update": {
        // LVM doesn't support updates
        return fetchLVMInfo(client, id, node, name, device);
      }
    }
  },
);

/**
 * Fetch LVM info
 * @internal
 */
async function fetchLVMInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
  name: string,
  device: string,
): Promise<DiskLVM> {
  try {
    const lvms = await client.nodes.$(node).disks.lvm.$get();
    const lvmsArray = lvms as Array<Record<string, unknown>>;
    const lvmInfo = lvmsArray.find((l) => l.vg === name);

    return {
      id,
      node,
      name,
      device,
      size: lvmInfo?.size as number | undefined,
      free: lvmInfo?.free as number | undefined,
      lvcount: lvmInfo?.lvcount as number | undefined,
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
