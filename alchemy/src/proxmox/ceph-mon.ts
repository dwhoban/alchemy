import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for creating a Ceph Monitor
 */
export interface CephMonProps extends ProxmoxApiOptions {
  /**
   * Node name where to create the monitor
   */
  node: string;

  /**
   * Monitor ID (usually same as node name)
   */
  monid?: string;

  /**
   * IP address for monitor (defaults to node's IP)
   */
  monAddress?: string;

  /**
   * Whether to delete the monitor when the resource is destroyed
   * @default false
   */
  delete?: boolean;
}

/**
 * Output returned after CephMon creation
 */
export interface CephMon {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Monitor ID
   */
  monid: string;

  /**
   * Monitor name
   */
  name?: string;

  /**
   * Monitor address
   */
  addr?: string;

  /**
   * Monitor host
   */
  host?: string;
}

/**
 * Type guard to check if a resource is a CephMon
 */
export function isCephMon(resource: unknown): resource is CephMon {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::CephMon"
  );
}

/**
 * Creates and manages a Proxmox Ceph Monitor daemon.
 *
 * @example
 * ## Create a monitor
 *
 * Create a Ceph monitor on a node:
 *
 * ```ts
 * import { CephMon } from "alchemy/proxmox";
 *
 * const mon = await CephMon("mon-pve1", {
 *   node: "pve1",
 * });
 * ```
 *
 * @example
 * ## Create monitor with custom ID
 *
 * Create a monitor with specific ID:
 *
 * ```ts
 * import { CephMon } from "alchemy/proxmox";
 *
 * const mon = await CephMon("custom-mon", {
 *   node: "pve1",
 *   monid: "mon-a",
 * });
 * ```
 */
export const CephMon = Resource(
  "proxmox::CephMon",
  async function (
    this: Context<CephMon>,
    id: string,
    props: CephMonProps,
  ): Promise<CephMon> {
    const client = await createProxmoxClient(props);
    const { node } = props;
    const monid = props.monid ?? node;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.monid) {
          try {
            await client.nodes
              .$(node)
              .ceph.mon.$(this.output.monid)
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
        // If updating and monitor exists, just return current state
        if (this.output?.monid) {
          return fetchMonInfo(client, id, node, this.output.monid);
        }

        // Create new monitor
        const createParams: Record<string, unknown> = {};

        if (props.monid) createParams["mon-id"] = props.monid;
        if (props.monAddress) createParams["mon-address"] = props.monAddress;

        await client.nodes
          .$(node)
          .ceph.mon.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["ceph"]["mon"]["$post"]
            >[0],
          );

        // Wait for monitor creation
        await waitForTask(client, node);

        return fetchMonInfo(client, id, node, monid);
      }
    }
  },
);

/**
 * Fetch monitor information
 * @internal
 */
async function fetchMonInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
  monid: string,
): Promise<CephMon> {
  const mons = await client.nodes.$(node).ceph.mon.$get();
  const monsArray = mons as Array<Record<string, unknown>>;
  const monInfo = monsArray.find((m) => m.name === monid);

  return {
    id,
    node,
    monid,
    name: monInfo?.name as string | undefined,
    addr: monInfo?.addr as string | undefined,
    host: monInfo?.host as string | undefined,
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
