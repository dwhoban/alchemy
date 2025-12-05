import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Storage type for Proxmox storage pools
 */
export type StorageType =
  | "dir"
  | "lvm"
  | "lvmthin"
  | "nfs"
  | "cifs"
  | "glusterfs"
  | "iscsi"
  | "iscsidirect"
  | "rbd"
  | "cephfs"
  | "zfspool"
  | "btrfs"
  | "pbs";

/**
 * Content types that can be stored on a storage pool
 */
export type StorageContent =
  | "images"
  | "rootdir"
  | "vztmpl"
  | "backup"
  | "iso"
  | "snippets";

/**
 * Properties for creating or updating a Proxmox Storage pool
 */
export interface StorageProps extends ProxmoxApiOptions {
  /**
   * Storage pool identifier
   * @default ${app}-${stage}-${id}
   */
  storage?: string;

  /**
   * Storage type
   */
  type: StorageType;

  /**
   * Path for directory-based storage (type: 'dir')
   */
  path?: string;

  /**
   * Volume group name (type: 'lvm', 'lvmthin')
   */
  vgname?: string;

  /**
   * Thin pool name (type: 'lvmthin')
   */
  thinpool?: string;

  /**
   * NFS/CIFS server address
   */
  server?: string;

  /**
   * NFS export path or CIFS share
   */
  export?: string;

  /**
   * ZFS pool name (type: 'zfspool')
   */
  pool?: string;

  /**
   * Content types to allow on this storage
   */
  content?: StorageContent[];

  /**
   * Nodes where this storage is available (comma-separated or array)
   * If not specified, storage is available on all nodes
   */
  nodes?: string | string[];

  /**
   * Enable/disable the storage
   * @default true
   */
  disable?: boolean;

  /**
   * Mark storage as shared (available on multiple nodes)
   * @default false
   */
  shared?: boolean;

  /**
   * Additional storage configuration options
   */
  additionalConfig?: Record<string, string | number | boolean>;

  /**
   * Whether to delete the storage when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after Storage creation/update
 */
export interface Storage {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * The storage pool identifier
   */
  storage: string;

  /**
   * Storage type
   */
  type: StorageType;

  /**
   * Path for directory-based storage
   */
  path?: string;

  /**
   * Content types available
   */
  content: string[];

  /**
   * Nodes where storage is available
   */
  nodes?: string[];

  /**
   * Whether storage is enabled
   */
  enabled: boolean;

  /**
   * Whether storage is shared
   */
  shared: boolean;

  /**
   * Total space in bytes
   */
  total: number;

  /**
   * Used space in bytes
   */
  used: number;

  /**
   * Available space in bytes
   */
  available: number;

  /**
   * Whether storage is active
   */
  active: boolean;
}

/**
 * Type guard to check if a resource is a Storage
 */
export function isStorage(resource: unknown): resource is Storage {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::Storage"
  );
}

/**
 * Creates and manages a Proxmox Storage pool.
 *
 * @example
 * ## Create a directory storage
 *
 * Create a simple directory-based storage pool:
 *
 * ```ts
 * import { Storage } from "alchemy/proxmox";
 *
 * const storage = await Storage("backup-storage", {
 *   storage: "backup",
 *   type: "dir",
 *   path: "/mnt/backup",
 *   content: ["backup", "iso", "vztmpl"],
 * });
 * ```
 *
 * @example
 * ## Create an NFS storage
 *
 * Create an NFS-mounted storage pool:
 *
 * ```ts
 * import { Storage } from "alchemy/proxmox";
 *
 * const storage = await Storage("nfs-storage", {
 *   storage: "nfs-share",
 *   type: "nfs",
 *   server: "192.168.1.10",
 *   export: "/export/proxmox",
 *   content: ["images", "rootdir", "backup"],
 *   shared: true,
 * });
 * ```
 *
 * @example
 * ## Create an LVM thin storage
 *
 * Create an LVM thin-provisioned storage pool:
 *
 * ```ts
 * import { Storage } from "alchemy/proxmox";
 *
 * const storage = await Storage("thin-storage", {
 *   storage: "thin-pool",
 *   type: "lvmthin",
 *   vgname: "pve",
 *   thinpool: "data",
 *   content: ["images", "rootdir"],
 * });
 * ```
 *
 * @example
 * ## Create a ZFS storage
 *
 * Create a ZFS pool storage:
 *
 * ```ts
 * import { Storage } from "alchemy/proxmox";
 *
 * const storage = await Storage("zfs-storage", {
 *   storage: "zfs-pool",
 *   type: "zfspool",
 *   pool: "rpool/data",
 *   content: ["images", "rootdir"],
 * });
 * ```
 */
export const Storage = Resource(
  "proxmox::Storage",
  async function (
    this: Context<Storage>,
    id: string,
    props: StorageProps,
  ): Promise<Storage> {
    const client = await createProxmoxClient(props);
    const storage =
      props.storage ??
      this.output?.storage ??
      this.scope.createPhysicalName(id);

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.storage) {
          try {
            await client.storage.$(this.output.storage).$delete();
          } catch (error: unknown) {
            // Ignore 404 errors (storage already deleted)
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create": {
        // Build storage configuration
        const configParams: Record<string, unknown> = {
          storage,
          type: props.type,
        };

        // Add type-specific parameters
        if (props.path) configParams.path = props.path;
        if (props.vgname) configParams.vgname = props.vgname;
        if (props.thinpool) configParams.thinpool = props.thinpool;
        if (props.server) configParams.server = props.server;
        if (props.export) configParams.export = props.export;
        if (props.pool) configParams.pool = props.pool;

        // Handle content types
        if (props.content) {
          configParams.content = props.content.join(",");
        }

        // Handle nodes
        if (props.nodes) {
          configParams.nodes = Array.isArray(props.nodes)
            ? props.nodes.join(",")
            : props.nodes;
        }

        // Handle boolean options
        if (props.disable !== undefined)
          configParams.disable = props.disable ? 1 : 0;
        if (props.shared !== undefined)
          configParams.shared = props.shared ? 1 : 0;

        // Merge additional config
        if (props.additionalConfig) {
          Object.assign(configParams, props.additionalConfig);
        }

        // Create the storage
        await client.storage.$post(
          configParams as Parameters<typeof client.storage.$post>[0],
        );

        return fetchStorageInfo(client, id, storage);
      }

      case "update": {
        // Build update configuration
        const updateParams: Record<string, unknown> = {};

        // Handle content types
        if (props.content) {
          updateParams.content = props.content.join(",");
        }

        // Handle nodes
        if (props.nodes) {
          updateParams.nodes = Array.isArray(props.nodes)
            ? props.nodes.join(",")
            : props.nodes;
        }

        // Handle boolean options
        if (props.disable !== undefined)
          updateParams.disable = props.disable ? 1 : 0;
        if (props.shared !== undefined)
          updateParams.shared = props.shared ? 1 : 0;

        // Merge additional config
        if (props.additionalConfig) {
          Object.assign(updateParams, props.additionalConfig);
        }

        // Update existing storage configuration
        await client.storage
          .$(storage)
          .$put(
            updateParams as Parameters<
              (typeof client.storage.$get)[0]["$put"]
            >[0],
          );

        return fetchStorageInfo(client, id, storage);
      }
    }
  },
);

/**
 * Fetch storage information from Proxmox
 * @internal
 */
async function fetchStorageInfo(
  client: ProxmoxClient,
  id: string,
  storage: string,
): Promise<Storage> {
  // Fetch storage status
  const storageList = await client.storage.$get();
  const storageInfo = storageList.find(
    (s: { storage: string }) => s.storage === storage,
  );

  if (!storageInfo) {
    throw new Error(`Storage ${storage} not found after creation/update`);
  }

  // Get storage status from a node (first available)
  let total = 0;
  let used = 0;
  let available = 0;
  let active = false;

  try {
    const nodes = await client.nodes.$get();
    if (nodes.length > 0) {
      const nodeApi = client.nodes.$(nodes[0].node);
      const storageStatus = await nodeApi.storage.$(storage).status.$get();
      total = (storageStatus.total as number) ?? 0;
      used = (storageStatus.used as number) ?? 0;
      available = (storageStatus.avail as number) ?? 0;
      active = (storageStatus.active as number) === 1;
    }
  } catch {
    // Storage might not be active on any node
  }

  // Parse content and nodes from response
  const contentStr = (storageInfo.content as string) ?? "";
  const nodesStr = (storageInfo.nodes as string) ?? "";

  return {
    id,
    storage,
    type: storageInfo.type as StorageType,
    path: storageInfo.path as string | undefined,
    content: contentStr ? contentStr.split(",") : [],
    nodes: nodesStr ? nodesStr.split(",") : undefined,
    enabled: !storageInfo.disable,
    shared: Boolean(storageInfo.shared),
    total,
    used,
    available,
    active,
  };
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
