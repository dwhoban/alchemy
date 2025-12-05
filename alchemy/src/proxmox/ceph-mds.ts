import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for creating or managing a Ceph MDS (Metadata Server)
 */
export interface CephMDSProps extends ProxmoxApiOptions {
  /**
   * Node name where the MDS will be created
   */
  node: string;

  /**
   * MDS name/ID
   * @default node name
   */
  name?: string;

  /**
   * Whether to make this MDS a hot-standby
   * @default false
   */
  hotstandby?: boolean;

  /**
   * Whether to delete the MDS when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after CephMDS creation/update
 */
export interface CephMDS {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * MDS name/ID
   */
  name: string;

  /**
   * MDS state (up, standby, etc.)
   */
  state?: string;

  /**
   * Whether the MDS is a hot-standby
   */
  hotstandby?: boolean;

  /**
   * Address the MDS is listening on
   */
  addr?: string;

  /**
   * Host information
   */
  host?: string;
}

/**
 * Type guard to check if a resource is a CephMDS
 */
export function isCephMDS(resource: unknown): resource is CephMDS {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::CephMDS"
  );
}

/**
 * Creates and manages a Proxmox Ceph MDS (Metadata Server).
 *
 * MDS is required for CephFS filesystems. Multiple MDS daemons can be
 * created for high availability.
 *
 * @example
 * ## Create an MDS
 *
 * Create a Ceph metadata server:
 *
 * ```ts
 * import { CephMDS } from "alchemy/proxmox";
 *
 * const mds = await CephMDS("mds-primary", {
 *   node: "pve",
 *   name: "mds0",
 * });
 * ```
 *
 * @example
 * ## Create a hot-standby MDS
 *
 * Create a standby MDS for failover:
 *
 * ```ts
 * import { CephMDS } from "alchemy/proxmox";
 *
 * const standbymds = await CephMDS("mds-standby", {
 *   node: "pve2",
 *   name: "mds1",
 *   hotstandby: true,
 * });
 * ```
 */
export const CephMDS = Resource(
  "proxmox::CephMDS",
  async function (
    this: Context<CephMDS>,
    id: string,
    props: CephMDSProps,
  ): Promise<CephMDS> {
    const client = await createProxmoxClient(props);
    const { node } = props;
    const name = props.name ?? node;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.name) {
          try {
            await client.nodes
              .$(node)
              .ceph.mds.$(this.output.name)
              .$delete();
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
        const createParams: Record<string, unknown> = {
          name,
        };

        if (props.hotstandby) createParams.hotstandby = 1;

        await client.nodes
          .$(node)
          .ceph.mds.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["ceph"]["mds"]["$post"]
            >[0],
          );

        await waitForTask(client, node);

        return fetchMDSInfo(client, id, node, name);
      }

      case "update": {
        // MDS doesn't support update, just return current state
        return fetchMDSInfo(client, id, node, name);
      }
    }
  },
);

/**
 * Fetch Ceph MDS information
 * @internal
 */
async function fetchMDSInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
  name: string,
): Promise<CephMDS> {
  try {
    const mdsList = await client.nodes.$(node).ceph.mds.$get();
    const mdsArray = mdsList as Array<Record<string, unknown>>;
    const mdsInfo = mdsArray.find((m) => m.name === name);

    return {
      id,
      node,
      name,
      state: mdsInfo?.state as string | undefined,
      hotstandby: mdsInfo?.standby_replay as boolean | undefined,
      addr: mdsInfo?.addr as string | undefined,
      host: mdsInfo?.host as string | undefined,
    };
  } catch {
    return {
      id,
      node,
      name,
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
