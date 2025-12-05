import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * ZFS RAID level
 */
export type ZFSRaidLevel =
  | "single"
  | "mirror"
  | "raid10"
  | "raidz"
  | "raidz2"
  | "raidz3"
  | "draid"
  | "draid2"
  | "draid3";

/**
 * Properties for creating a ZFS pool
 */
export interface DiskZFSProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * Pool name
   */
  name: string;

  /**
   * Devices to use (comma-separated)
   */
  devices: string;

  /**
   * RAID level
   * @default "single"
   */
  raidlevel?: ZFSRaidLevel;

  /**
   * Enable compression
   * @default "on"
   */
  compression?: "on" | "off" | "lz4" | "lzjb" | "gzip" | "zle" | "zstd";

  /**
   * ashift value (2^ashift = sector size)
   * @default 12 (4K sectors)
   */
  ashift?: number;

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
 * Output returned after DiskZFS creation
 */
export interface DiskZFS {
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
   * Devices used
   */
  devices: string;

  /**
   * RAID level
   */
  raidlevel: string;

  /**
   * Pool size in bytes
   */
  size?: number;

  /**
   * Allocated space in bytes
   */
  alloc?: number;

  /**
   * Free space in bytes
   */
  free?: number;

  /**
   * Pool health status
   */
  health?: string;

  /**
   * Fragmentation percentage
   */
  frag?: number;

  /**
   * Deduplication ratio
   */
  dedup?: number;
}

/**
 * Type guard to check if a resource is a DiskZFS
 */
export function isDiskZFS(resource: unknown): resource is DiskZFS {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::DiskZFS"
  );
}

/**
 * Creates ZFS storage pool on Proxmox node disks.
 *
 * @example
 * ## Create single disk ZFS pool
 *
 * Create a simple ZFS pool on one disk:
 *
 * ```ts
 * import { DiskZFS } from "alchemy/proxmox";
 *
 * const zfs = await DiskZFS("data-pool", {
 *   node: "pve",
 *   name: "data-pool",
 *   devices: "/dev/sdb",
 *   raidlevel: "single",
 * });
 * ```
 *
 * @example
 * ## Create mirrored ZFS pool
 *
 * Create a mirrored ZFS pool:
 *
 * ```ts
 * import { DiskZFS } from "alchemy/proxmox";
 *
 * const zfs = await DiskZFS("mirror-pool", {
 *   node: "pve",
 *   name: "mirror-pool",
 *   devices: "/dev/sdb,/dev/sdc",
 *   raidlevel: "mirror",
 *   compression: "lz4",
 * });
 * ```
 *
 * @example
 * ## Create RAIDZ pool
 *
 * Create a RAIDZ pool for redundancy:
 *
 * ```ts
 * import { DiskZFS } from "alchemy/proxmox";
 *
 * const zfs = await DiskZFS("raidz-pool", {
 *   node: "pve",
 *   name: "raidz-pool",
 *   devices: "/dev/sdb,/dev/sdc,/dev/sdd",
 *   raidlevel: "raidz",
 *   compression: "zstd",
 *   ashift: 12,
 * });
 * ```
 */
export const DiskZFS = Resource(
  "proxmox::DiskZFS",
  async function (
    this: Context<DiskZFS>,
    id: string,
    props: DiskZFSProps,
  ): Promise<DiskZFS> {
    const client = await createProxmoxClient(props);
    const { node, name, devices } = props;
    const raidlevel = props.raidlevel ?? "single";

    switch (this.phase) {
      case "delete": {
        // ZFS pool deletion is destructive, not typically automated
        return this.destroy();
      }

      case "create": {
        const createParams: Record<string, unknown> = {
          name,
          devices,
          raidlevel,
        };

        if (props.compression) createParams.compression = props.compression;
        if (props.ashift) createParams.ashift = props.ashift;
        if (props.add_storage !== false) createParams.add_storage = 1;

        await client.nodes
          .$(node)
          .disks.zfs.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["disks"]["zfs"]["$post"]
            >[0],
          );

        await waitForTask(client, node);

        return fetchZFSInfo(client, id, node, name, devices, raidlevel);
      }

      case "update": {
        // ZFS pool doesn't support updates via this endpoint
        return fetchZFSInfo(client, id, node, name, devices, raidlevel);
      }
    }
  },
);

/**
 * Fetch ZFS pool info
 * @internal
 */
async function fetchZFSInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
  name: string,
  devices: string,
  raidlevel: string,
): Promise<DiskZFS> {
  try {
    const pools = await client.nodes.$(node).disks.zfs.$get();
    const poolsArray = pools as Array<Record<string, unknown>>;
    const poolInfo = poolsArray.find((p) => p.name === name);

    return {
      id,
      node,
      name,
      devices,
      raidlevel,
      size: poolInfo?.size as number | undefined,
      alloc: poolInfo?.alloc as number | undefined,
      free: poolInfo?.free as number | undefined,
      health: poolInfo?.health as string | undefined,
      frag: poolInfo?.frag as number | undefined,
      dedup: poolInfo?.dedup as number | undefined,
    };
  } catch {
    return {
      id,
      node,
      name,
      devices,
      raidlevel,
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
