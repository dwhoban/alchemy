import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for creating a Ceph Manager
 */
export interface CephMgrProps extends ProxmoxApiOptions {
  /**
   * Node name where to create the manager
   */
  node: string;

  /**
   * Manager ID (usually same as node name)
   */
  mgrid?: string;

  /**
   * Whether to delete the manager when the resource is destroyed
   * @default false
   */
  delete?: boolean;
}

/**
 * Output returned after CephMgr creation
 */
export interface CephMgr {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Manager ID
   */
  mgrid: string;

  /**
   * Manager name
   */
  name?: string;

  /**
   * Manager state (active, standby)
   */
  state?: string;

  /**
   * Manager address
   */
  addr?: string;

  /**
   * Manager host
   */
  host?: string;
}

/**
 * Type guard to check if a resource is a CephMgr
 */
export function isCephMgr(resource: unknown): resource is CephMgr {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::CephMgr"
  );
}

/**
 * Creates and manages a Proxmox Ceph Manager daemon.
 *
 * @example
 * ## Create a manager
 *
 * Create a Ceph manager on a node:
 *
 * ```ts
 * import { CephMgr } from "alchemy/proxmox";
 *
 * const mgr = await CephMgr("mgr-pve1", {
 *   node: "pve1",
 * });
 * ```
 *
 * @example
 * ## Create manager with custom ID
 *
 * Create a manager with specific ID:
 *
 * ```ts
 * import { CephMgr } from "alchemy/proxmox";
 *
 * const mgr = await CephMgr("custom-mgr", {
 *   node: "pve1",
 *   mgrid: "mgr-a",
 * });
 * ```
 */
export const CephMgr = Resource(
  "proxmox::CephMgr",
  async function (
    this: Context<CephMgr>,
    id: string,
    props: CephMgrProps,
  ): Promise<CephMgr> {
    const client = await createProxmoxClient(props);
    const { node } = props;
    const mgrid = props.mgrid ?? node;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.mgrid) {
          try {
            await client.nodes
              .$(node)
              .ceph.mgr.$(this.output.mgrid)
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

      case "create":
      case "update": {
        // If updating and manager exists, just return current state
        if (this.output?.mgrid) {
          return fetchMgrInfo(client, id, node, this.output.mgrid);
        }

        // Create new manager
        const createParams: Record<string, unknown> = {};

        if (props.mgrid) createParams.id = props.mgrid;

        await client.nodes
          .$(node)
          .ceph.mgr.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["ceph"]["mgr"]["$post"]
            >[0],
          );

        // Wait for manager creation
        await waitForTask(client, node);

        return fetchMgrInfo(client, id, node, mgrid);
      }
    }
  },
);

/**
 * Fetch manager information
 * @internal
 */
async function fetchMgrInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
  mgrid: string,
): Promise<CephMgr> {
  const mgrs = await client.nodes.$(node).ceph.mgr.$get();
  const mgrsArray = mgrs as Array<Record<string, unknown>>;
  const mgrInfo = mgrsArray.find((m) => m.name === mgrid);

  return {
    id,
    node,
    mgrid,
    name: mgrInfo?.name as string | undefined,
    state: mgrInfo?.state as string | undefined,
    addr: mgrInfo?.addr as string | undefined,
    host: mgrInfo?.host as string | undefined,
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
