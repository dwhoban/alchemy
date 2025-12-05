import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for cloning a Virtual Machine
 */
export interface VMCloneProps extends ProxmoxApiOptions {
  /**
   * Source node name
   */
  node: string;

  /**
   * Source VM ID to clone from
   */
  vmid: number;

  /**
   * Target VM ID for the clone
   */
  newid: number;

  /**
   * Name for the cloned VM
   */
  name?: string;

  /**
   * Description for the cloned VM
   */
  description?: string;

  /**
   * Target node for the clone (for cross-node cloning)
   */
  target?: string;

  /**
   * Target storage for the clone
   */
  storage?: string;

  /**
   * Clone type: full or linked
   * @default "full"
   */
  full?: boolean;

  /**
   * Format for disk images (raw, qcow2, vmdk)
   */
  format?: "raw" | "qcow2" | "vmdk";

  /**
   * Resource pool for the clone
   */
  pool?: string;

  /**
   * Snapshot name to clone from (instead of current state)
   */
  snapname?: string;

  /**
   * Bandwidth limit for clone operation (KiB/s)
   */
  bwlimit?: number;

  /**
   * Whether to delete the cloned VM when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after VM Clone operation
 */
export interface VMClone {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Source node name
   */
  node: string;

  /**
   * Source VM ID
   */
  sourceVmid: number;

  /**
   * Cloned VM ID
   */
  vmid: number;

  /**
   * Cloned VM name
   */
  name?: string;

  /**
   * Target node where clone was created
   */
  targetNode: string;

  /**
   * Clone type (full or linked)
   */
  cloneType: "full" | "linked";

  /**
   * Task ID for the clone operation
   */
  taskId?: string;
}

/**
 * Type guard to check if a resource is a VMClone
 */
export function isVMClone(resource: unknown): resource is VMClone {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::VMClone"
  );
}

/**
 * Creates a clone of a Proxmox Virtual Machine.
 *
 * @example
 * ## Create a full clone
 *
 * Create a full independent clone of a VM:
 *
 * ```ts
 * import { VMClone } from "alchemy/proxmox";
 *
 * const clone = await VMClone("web-server-clone", {
 *   node: "pve",
 *   vmid: 100,
 *   newid: 101,
 *   name: "web-server-clone",
 *   full: true,
 * });
 * ```
 *
 * @example
 * ## Create a linked clone
 *
 * Create a linked clone (shares base image):
 *
 * ```ts
 * import { VMClone } from "alchemy/proxmox";
 *
 * const clone = await VMClone("dev-vm", {
 *   node: "pve",
 *   vmid: 100,
 *   newid: 102,
 *   name: "dev-vm",
 *   full: false, // Linked clone
 *   snapname: "base-snapshot",
 * });
 * ```
 *
 * @example
 * ## Clone to another node
 *
 * Clone a VM to a different node:
 *
 * ```ts
 * import { VMClone } from "alchemy/proxmox";
 *
 * const clone = await VMClone("remote-clone", {
 *   node: "pve1",
 *   vmid: 100,
 *   newid: 100,
 *   target: "pve2",
 *   storage: "local-lvm",
 *   full: true,
 * });
 * ```
 */
export const VMClone = Resource(
  "proxmox::VMClone",
  async function (
    this: Context<VMClone>,
    id: string,
    props: VMCloneProps,
  ): Promise<VMClone> {
    const client = await createProxmoxClient(props);
    const { node, vmid, newid } = props;
    const targetNode = props.target ?? node;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.vmid) {
          try {
            // Delete the cloned VM
            await client.nodes
              .$(this.output.targetNode)
              .qemu.$(this.output.vmid)
              .$delete();

            // Wait for deletion
            await waitForTask(client, this.output.targetNode);
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
        // Build clone parameters
        const cloneParams: Record<string, unknown> = {
          newid,
        };

        if (props.name) cloneParams.name = props.name;
        if (props.description) cloneParams.description = props.description;
        if (props.target) cloneParams.target = props.target;
        if (props.storage) cloneParams.storage = props.storage;
        if (props.full !== undefined) cloneParams.full = props.full ? 1 : 0;
        if (props.format) cloneParams.format = props.format;
        if (props.pool) cloneParams.pool = props.pool;
        if (props.snapname) cloneParams.snapname = props.snapname;
        if (props.bwlimit) cloneParams.bwlimit = props.bwlimit;

        // Start clone operation
        const taskId = await client.nodes
          .$(node)
          .qemu.$(vmid)
          .clone.$post(
            cloneParams as Parameters<
              (typeof client.nodes.$get)[0]["qemu"]["$get"][0]["clone"]["$post"]
            >[0],
          );

        // Wait for clone completion
        await waitForTask(client, targetNode, 600000); // 10 minute timeout for clones

        return {
          id,
          node,
          sourceVmid: vmid,
          vmid: newid,
          name: props.name,
          targetNode,
          cloneType: props.full === false ? "linked" : "full",
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
