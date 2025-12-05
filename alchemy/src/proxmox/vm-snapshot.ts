import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for creating a VM Snapshot
 */
export interface VMSnapshotProps extends ProxmoxApiOptions {
  /**
   * Proxmox node name
   */
  node: string;

  /**
   * VM ID to snapshot
   */
  vmid: number;

  /**
   * Snapshot name
   */
  snapname: string;

  /**
   * Snapshot description
   */
  description?: string;

  /**
   * Include RAM state in snapshot (for running VMs)
   * @default false
   */
  vmstate?: boolean;

  /**
   * Whether to delete the snapshot when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after VMSnapshot creation
 */
export interface VMSnapshot {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * VM ID
   */
  vmid: number;

  /**
   * Snapshot name
   */
  snapname: string;

  /**
   * Snapshot description
   */
  description?: string;

  /**
   * Whether RAM state is included
   */
  vmstate: boolean;

  /**
   * Snapshot creation timestamp
   */
  snaptime?: number;

  /**
   * Parent snapshot name
   */
  parent?: string;
}

/**
 * Type guard to check if a resource is a VMSnapshot
 */
export function isVMSnapshot(resource: unknown): resource is VMSnapshot {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::VMSnapshot"
  );
}

/**
 * Creates and manages a Proxmox VM Snapshot.
 *
 * @example
 * ## Create a disk-only snapshot
 *
 * Create a snapshot without RAM state:
 *
 * ```ts
 * import { VMSnapshot } from "alchemy/proxmox";
 *
 * const snapshot = await VMSnapshot("before-upgrade", {
 *   node: "pve",
 *   vmid: 100,
 *   snapname: "before-upgrade",
 *   description: "Snapshot before system upgrade",
 * });
 * ```
 *
 * @example
 * ## Create a snapshot with RAM state
 *
 * Create a full snapshot including memory:
 *
 * ```ts
 * import { VMSnapshot } from "alchemy/proxmox";
 *
 * const snapshot = await VMSnapshot("running-state", {
 *   node: "pve",
 *   vmid: 100,
 *   snapname: "running-state",
 *   vmstate: true,
 *   description: "Full snapshot with RAM state",
 * });
 * ```
 */
export const VMSnapshot = Resource(
  "proxmox::VMSnapshot",
  async function (
    this: Context<VMSnapshot>,
    id: string,
    props: VMSnapshotProps,
  ): Promise<VMSnapshot> {
    const client = await createProxmoxClient(props);
    const { node, vmid, snapname } = props;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.snapname) {
          try {
            await client.nodes
              .$(node)
              .qemu.$(vmid)
              .snapshot.$(this.output.snapname)
              .$delete();

            // Wait for snapshot deletion
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
        // Create the snapshot
        const createParams: Record<string, unknown> = {
          snapname,
        };

        if (props.description) createParams.description = props.description;
        if (props.vmstate !== undefined)
          createParams.vmstate = props.vmstate ? 1 : 0;

        await client.nodes
          .$(node)
          .qemu.$(vmid)
          .snapshot.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["qemu"]["$get"][0]["snapshot"]["$post"]
            >[0],
          );

        // Wait for snapshot creation
        await waitForTask(client, node);

        return fetchSnapshotInfo(client, id, node, vmid, snapname, props);
      }

      case "update": {
        // Update snapshot description
        if (props.description) {
          await client.nodes
            .$(node)
            .qemu.$(vmid)
            .snapshot.$(snapname)
            .config.$put({ description: props.description } as Parameters<
              (typeof client.nodes.$get)[0]["qemu"]["$get"][0]["snapshot"]["$get"][0]["config"]["$put"]
            >[0]);
        }

        return fetchSnapshotInfo(client, id, node, vmid, snapname, props);
      }
    }
  },
);

/**
 * Fetch snapshot information from Proxmox
 * @internal
 */
async function fetchSnapshotInfo(
  client: ProxmoxClient,
  id: string,
  node: string,
  vmid: number,
  snapname: string,
  props: VMSnapshotProps,
): Promise<VMSnapshot> {
  const snapshots = await client.nodes.$(node).qemu.$(vmid).snapshot.$get();
  const snapInfo = (snapshots as Array<Record<string, unknown>>).find(
    (s) => s.name === snapname,
  );

  return {
    id,
    node,
    vmid,
    snapname,
    description: (snapInfo?.description as string) ?? props.description,
    vmstate: Boolean(snapInfo?.vmstate ?? props.vmstate),
    snaptime: snapInfo?.snaptime as number | undefined,
    parent: snapInfo?.parent as string | undefined,
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
