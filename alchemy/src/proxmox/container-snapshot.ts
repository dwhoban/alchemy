import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for creating a Container Snapshot
 */
export interface ContainerSnapshotProps extends ProxmoxApiOptions {
  /**
   * Proxmox node name
   */
  node: string;

  /**
   * Container ID to snapshot
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
   * Whether to delete the snapshot when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after ContainerSnapshot creation
 */
export interface ContainerSnapshot {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Container ID
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
   * Snapshot creation timestamp
   */
  snaptime?: number;

  /**
   * Parent snapshot name
   */
  parent?: string;
}

/**
 * Type guard to check if a resource is a ContainerSnapshot
 */
export function isContainerSnapshot(
  resource: unknown,
): resource is ContainerSnapshot {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::ContainerSnapshot"
  );
}

/**
 * Creates and manages a Proxmox Container Snapshot.
 *
 * @example
 * ## Create a container snapshot
 *
 * Create a snapshot of a container:
 *
 * ```ts
 * import { ContainerSnapshot } from "alchemy/proxmox";
 *
 * const snapshot = await ContainerSnapshot("before-config", {
 *   node: "pve",
 *   vmid: 200,
 *   snapname: "before-config",
 *   description: "Snapshot before configuration changes",
 * });
 * ```
 *
 * @example
 * ## Create a snapshot before deployment
 *
 * Create a backup point before deployment:
 *
 * ```ts
 * import { ContainerSnapshot } from "alchemy/proxmox";
 *
 * const snapshot = await ContainerSnapshot("pre-deploy", {
 *   node: "pve",
 *   vmid: 201,
 *   snapname: "pre-deploy",
 *   description: "Pre-deployment snapshot",
 * });
 * ```
 */
export const ContainerSnapshot = Resource(
  "proxmox::ContainerSnapshot",
  async function (
    this: Context<ContainerSnapshot>,
    id: string,
    props: ContainerSnapshotProps,
  ): Promise<ContainerSnapshot> {
    const client = await createProxmoxClient(props);
    const { node, vmid, snapname } = props;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.snapname) {
          try {
            await client.nodes
              .$(node)
              .lxc.$(vmid)
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

        await client.nodes
          .$(node)
          .lxc.$(vmid)
          .snapshot.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["lxc"]["$get"][0]["snapshot"]["$post"]
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
            .lxc.$(vmid)
            .snapshot.$(snapname)
            .config.$put({ description: props.description } as Parameters<
              (typeof client.nodes.$get)[0]["lxc"]["$get"][0]["snapshot"]["$get"][0]["config"]["$put"]
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
  props: ContainerSnapshotProps,
): Promise<ContainerSnapshot> {
  const snapshots = await client.nodes.$(node).lxc.$(vmid).snapshot.$get();
  const snapInfo = (snapshots as Array<Record<string, unknown>>).find(
    (s) => s.name === snapname,
  );

  return {
    id,
    node,
    vmid,
    snapname,
    description: (snapInfo?.description as string) ?? props.description,
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
