import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for creating a Ceph OSD
 */
export interface CephOSDProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * Block device for OSD (e.g., '/dev/sdb')
   */
  dev: string;

  /**
   * DB device for BlueStore (optional SSD)
   */
  db_dev?: string;

  /**
   * DB device size in GiB
   */
  db_dev_size?: number;

  /**
   * WAL device for BlueStore (optional SSD)
   */
  wal_dev?: string;

  /**
   * WAL device size in GiB
   */
  wal_dev_size?: number;

  /**
   * Enable encryption
   * @default false
   */
  encrypted?: boolean;

  /**
   * CRUSH device class (ssd, hdd, nvme)
   */
  crush_device_class?: string;

  /**
   * Whether to delete/destroy the OSD when the resource is destroyed
   * @default false
   */
  delete?: boolean;
}

/**
 * Output returned after CephOSD creation
 */
export interface CephOSD {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * OSD ID
   */
  osdid: number;

  /**
   * Block device
   */
  dev: string;

  /**
   * OSD status (up, down)
   */
  status?: string;

  /**
   * CRUSH device class
   */
  crush_device_class?: string;

  /**
   * Bytes used
   */
  bytes_used?: number;

  /**
   * Total bytes
   */
  total_bytes?: number;
}

/**
 * Type guard to check if a resource is a CephOSD
 */
export function isCephOSD(resource: unknown): resource is CephOSD {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::CephOSD"
  );
}

/**
 * Creates and manages a Proxmox Ceph OSD (Object Storage Daemon).
 *
 * @example
 * ## Create a basic OSD
 *
 * Create an OSD on a disk:
 *
 * ```ts
 * import { CephOSD } from "alchemy/proxmox";
 *
 * const osd = await CephOSD("osd-sdb", {
 *   node: "pve",
 *   dev: "/dev/sdb",
 * });
 * ```
 *
 * @example
 * ## Create OSD with separate DB device
 *
 * Create an OSD with SSD for metadata:
 *
 * ```ts
 * import { CephOSD } from "alchemy/proxmox";
 *
 * const osd = await CephOSD("osd-with-ssd", {
 *   node: "pve",
 *   dev: "/dev/sdb",
 *   db_dev: "/dev/nvme0n1",
 *   db_dev_size: 30,
 * });
 * ```
 *
 * @example
 * ## Create encrypted OSD
 *
 * Create an encrypted OSD:
 *
 * ```ts
 * import { CephOSD } from "alchemy/proxmox";
 *
 * const osd = await CephOSD("encrypted-osd", {
 *   node: "pve",
 *   dev: "/dev/sdc",
 *   encrypted: true,
 *   crush_device_class: "hdd",
 * });
 * ```
 */
export const CephOSD = Resource(
  "proxmox::CephOSD",
  async function (
    this: Context<CephOSD>,
    id: string,
    props: CephOSDProps,
  ): Promise<CephOSD> {
    const client = await createProxmoxClient(props);
    const { node, dev } = props;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.osdid !== undefined) {
          try {
            // First mark OSD out
            await client.nodes
              .$(node)
              .ceph.osd.$(this.output.osdid)
              .out.$post();
            await waitForTask(client, node);

            // Then destroy OSD
            await client.nodes
              .$(node)
              .ceph.osd.$(this.output.osdid)
              .$delete({ cleanup: 1 } as Parameters<
                (typeof client.nodes.$get)[0]["ceph"]["osd"]["$get"][0]["$delete"]
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

      case "create":
      case "update": {
        // If updating and OSD exists, just return current state
        if (this.output?.osdid !== undefined) {
          return fetchOSDInfo(client, id, node, this.output.osdid, dev);
        }

        // Create new OSD
        const createParams: Record<string, unknown> = {
          dev,
        };

        if (props.db_dev) createParams.db_dev = props.db_dev;
        if (props.db_dev_size) createParams.db_dev_size = props.db_dev_size;
        if (props.wal_dev) createParams.wal_dev = props.wal_dev;
        if (props.wal_dev_size) createParams.wal_dev_size = props.wal_dev_size;
        if (props.encrypted) createParams.encrypted = 1;
        if (props.crush_device_class)
          createParams.crush_device_class = props.crush_device_class;

        const result = await client.nodes
          .$(node)
          .ceph.osd.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["ceph"]["osd"]["$post"]
            >[0],
          );

        // Wait for OSD creation
        await waitForTask(client, node, 600000);

        // Parse OSD ID from result or find by device
        let osdid = typeof result === "number" ? result : 0;
        if (osdid === 0) {
          // Find OSD by device
          const osds = await client.nodes.$(node).ceph.osd.$get();
          const osdsArray = osds as Array<Record<string, unknown>>;
          const osdInfo = osdsArray.find((o) => o.device === dev);
          if (osdInfo) {
            osdid = osdInfo.id as number;
          }
        }

        return fetchOSDInfo(client, id, node, osdid, dev);
      }
    }
  },
);

/**
 * Fetch OSD information
 * @internal
 */
async function fetchOSDInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
  osdid: number,
  dev: string,
): Promise<CephOSD> {
  const osds = await client.nodes.$(node).ceph.osd.$get();
  const osdsArray = osds as Array<Record<string, unknown>>;
  const osdInfo = osdsArray.find((o) => o.id === osdid);

  return {
    id,
    node,
    osdid,
    dev,
    status: osdInfo?.status as string | undefined,
    crush_device_class: osdInfo?.crush_device_class as string | undefined,
    bytes_used: osdInfo?.bytes_used as number | undefined,
    total_bytes: osdInfo?.total_bytes as number | undefined,
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
