import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for cloning a Container
 */
export interface ContainerCloneProps extends ProxmoxApiOptions {
  /**
   * Source node name
   */
  node: string;

  /**
   * Source container ID to clone from
   */
  vmid: number;

  /**
   * Target container ID for the clone
   */
  newid: number;

  /**
   * Hostname for the cloned container
   */
  hostname?: string;

  /**
   * Description for the cloned container
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
   * @default true (full clone)
   */
  full?: boolean;

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
   * Whether to delete the cloned container when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after Container Clone operation
 */
export interface ContainerClone {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Source node name
   */
  node: string;

  /**
   * Source container ID
   */
  sourceVmid: number;

  /**
   * Cloned container ID
   */
  vmid: number;

  /**
   * Cloned container hostname
   */
  hostname?: string;

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
 * Type guard to check if a resource is a ContainerClone
 */
export function isContainerClone(
  resource: unknown,
): resource is ContainerClone {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::ContainerClone"
  );
}

/**
 * Creates a clone of a Proxmox Container (LXC).
 *
 * @example
 * ## Create a full clone
 *
 * Create a full independent clone of a container:
 *
 * ```ts
 * import { ContainerClone } from "alchemy/proxmox";
 *
 * const clone = await ContainerClone("app-clone", {
 *   node: "pve",
 *   vmid: 200,
 *   newid: 201,
 *   hostname: "app-clone",
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
 * import { ContainerClone } from "alchemy/proxmox";
 *
 * const clone = await ContainerClone("dev-ct", {
 *   node: "pve",
 *   vmid: 200,
 *   newid: 202,
 *   hostname: "dev-ct",
 *   full: false, // Linked clone
 *   snapname: "base-snapshot",
 * });
 * ```
 *
 * @example
 * ## Clone to another node
 *
 * Clone a container to a different node:
 *
 * ```ts
 * import { ContainerClone } from "alchemy/proxmox";
 *
 * const clone = await ContainerClone("remote-clone", {
 *   node: "pve1",
 *   vmid: 200,
 *   newid: 200,
 *   target: "pve2",
 *   storage: "local-lvm",
 *   full: true,
 * });
 * ```
 */
export const ContainerClone = Resource(
  "proxmox::ContainerClone",
  async function (
    this: Context<ContainerClone>,
    id: string,
    props: ContainerCloneProps,
  ): Promise<ContainerClone> {
    const client = await createProxmoxClient(props);
    const { node, vmid, newid } = props;
    const targetNode = props.target ?? node;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.vmid) {
          try {
            // Delete the cloned container
            await client.nodes
              .$(this.output.targetNode)
              .lxc.$(this.output.vmid)
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

        if (props.hostname) cloneParams.hostname = props.hostname;
        if (props.description) cloneParams.description = props.description;
        if (props.target) cloneParams.target = props.target;
        if (props.storage) cloneParams.storage = props.storage;
        if (props.full !== undefined) cloneParams.full = props.full ? 1 : 0;
        if (props.pool) cloneParams.pool = props.pool;
        if (props.snapname) cloneParams.snapname = props.snapname;
        if (props.bwlimit) cloneParams.bwlimit = props.bwlimit;

        // Start clone operation
        const taskId = await client.nodes
          .$(node)
          .lxc.$(vmid)
          .clone.$post(
            cloneParams as Parameters<
              (typeof client.nodes.$get)[0]["lxc"]["$get"][0]["clone"]["$post"]
            >[0],
          );

        // Wait for clone completion
        await waitForTask(client, targetNode, 600000); // 10 minute timeout for clones

        return {
          id,
          node,
          sourceVmid: vmid,
          vmid: newid,
          hostname: props.hostname,
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
