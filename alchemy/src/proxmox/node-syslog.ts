import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for querying syslog
 */
export interface NodeSyslogProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * Start at this line
   */
  start?: number;

  /**
   * Number of lines to return
   * @default 50
   */
  limit?: number;

  /**
   * Display since this UNIX epoch
   */
  since?: number;

  /**
   * Display until this UNIX epoch
   */
  until?: number;

  /**
   * Service to filter by
   */
  service?: string;
}

/**
 * Syslog entry
 */
export interface SyslogEntry {
  /**
   * Line number
   */
  n: number;

  /**
   * Log line content
   */
  t: string;
}

/**
 * Output returned after NodeSyslog query
 */
export interface NodeSyslog {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Syslog entries
   */
  entries: SyslogEntry[];

  /**
   * Total lines available
   */
  total?: number;
}

/**
 * Type guard to check if a resource is a NodeSyslog
 */
export function isNodeSyslog(resource: unknown): resource is NodeSyslog {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::NodeSyslog"
  );
}

/**
 * Queries Proxmox node syslog entries.
 *
 * @example
 * ## Get recent syslog
 *
 * Query recent syslog entries:
 *
 * ```ts
 * import { NodeSyslog } from "alchemy/proxmox";
 *
 * const syslog = await NodeSyslog("pve-logs", {
 *   node: "pve",
 *   limit: 100,
 * });
 * for (const entry of syslog.entries) {
 *   console.log(entry.t);
 * }
 * ```
 *
 * @example
 * ## Get service-specific logs
 *
 * Query logs for a specific service:
 *
 * ```ts
 * import { NodeSyslog } from "alchemy/proxmox";
 *
 * const syslog = await NodeSyslog("pve-daemon-logs", {
 *   node: "pve",
 *   service: "pvedaemon",
 *   limit: 50,
 * });
 * ```
 *
 * @example
 * ## Get logs since timestamp
 *
 * Query logs since a specific time:
 *
 * ```ts
 * import { NodeSyslog } from "alchemy/proxmox";
 *
 * const syslog = await NodeSyslog("recent-logs", {
 *   node: "pve",
 *   since: Math.floor(Date.now() / 1000) - 3600, // Last hour
 * });
 * ```
 */
export const NodeSyslog = Resource(
  "proxmox::NodeSyslog",
  async function (
    this: Context<NodeSyslog>,
    id: string,
    props: NodeSyslogProps,
  ): Promise<NodeSyslog> {
    const client = await createProxmoxClient(props);
    const { node } = props;

    // This is a read-only resource
    if (this.phase === "delete") {
      return this.destroy();
    }

    // Build query parameters
    const params: Record<string, unknown> = {};
    if (props.start) params.start = props.start;
    if (props.limit) params.limit = props.limit;
    if (props.since) params.since = props.since;
    if (props.until) params.until = props.until;
    if (props.service) params.service = props.service;

    const syslog = await client.nodes
      .$(node)
      .syslog.$get(
        params as Parameters<(typeof client.nodes.$get)[0]["syslog"]["$get"]>[0],
      );
    const entries = syslog as Array<Record<string, unknown>>;

    return {
      id,
      node,
      entries: entries.map((e) => ({
        n: e.n as number,
        t: e.t as string,
      })),
      total: entries.length,
    };
  },
);
