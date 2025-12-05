import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for managing node time settings
 */
export interface NodeTimeProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * Timezone (e.g., "America/New_York", "Europe/London", "UTC")
   */
  timezone: string;
}

/**
 * Output returned after NodeTime update
 */
export interface NodeTime {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Current timezone
   */
  timezone: string;

  /**
   * Current local time
   */
  localtime?: number;

  /**
   * Current UTC time
   */
  time?: number;
}

/**
 * Type guard to check if a resource is a NodeTime
 */
export function isNodeTime(resource: unknown): resource is NodeTime {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::NodeTime"
  );
}

/**
 * Manages a Proxmox node's timezone settings.
 *
 * @example
 * ## Set timezone
 *
 * Configure the node timezone:
 *
 * ```ts
 * import { NodeTime } from "alchemy/proxmox";
 *
 * const time = await NodeTime("pve-time", {
 *   node: "pve",
 *   timezone: "America/New_York",
 * });
 * ```
 *
 * @example
 * ## Set UTC timezone
 *
 * Configure UTC timezone for servers:
 *
 * ```ts
 * import { NodeTime } from "alchemy/proxmox";
 *
 * const time = await NodeTime("server-time", {
 *   node: "pve",
 *   timezone: "UTC",
 * });
 * ```
 */
export const NodeTime = Resource(
  "proxmox::NodeTime",
  async function (
    this: Context<NodeTime>,
    id: string,
    props: NodeTimeProps,
  ): Promise<NodeTime> {
    const client = await createProxmoxClient(props);
    const { node, timezone } = props;

    // This is a configuration resource, delete just means stop managing
    if (this.phase === "delete") {
      return this.destroy();
    }

    // Update timezone
    await client.nodes
      .$(node)
      .time.$put({
        timezone,
      } as Parameters<(typeof client.nodes.$get)[0]["time"]["$put"]>[0]);

    // Fetch updated time info
    const timeInfo = await client.nodes.$(node).time.$get();
    const timeObj = timeInfo as Record<string, unknown>;

    return {
      id,
      node,
      timezone: (timeObj.timezone as string) ?? timezone,
      localtime: timeObj.localtime as number | undefined,
      time: timeObj.time as number | undefined,
    };
  },
);
