import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for configuring Cluster Options (Datacenter settings)
 */
export interface ClusterOptionsProps extends ProxmoxApiOptions {
  /**
   * Default bandwidth limit for clone operations (KiB/s)
   */
  bwlimit?: string;

  /**
   * Console mode for VMs and containers
   * @default "default"
   */
  console?: "applet" | "vv" | "html5" | "xtermjs" | "default";

  /**
   * Migration bandwidth limit (KiB/s)
   */
  migration?: string;

  /**
   * Migration network CIDR
   */
  migration_unsecure?: boolean;

  /**
   * HTTP proxy for external connections
   */
  http_proxy?: string;

  /**
   * Keyboard layout
   */
  keyboard?: string;

  /**
   * Default language
   */
  language?: string;

  /**
   * Maximum number of workers
   */
  max_workers?: number;

  /**
   * Email address for notifications
   */
  email_from?: string;

  /**
   * HA shutdown policy
   */
  ha_shutdown_policy?: "freeze" | "failover" | "migrate" | "conditional";

  /**
   * User tag access mode
   */
  user_tag_access?: "free" | "existing" | "list" | "none";

  /**
   * Registered tags (for user_tag_access=list)
   */
  registered_tags?: string;

  /**
   * Whether to delete the options when the resource is destroyed
   * @default false
   */
  delete?: boolean;
}

/**
 * Output returned after ClusterOptions configuration
 */
export interface ClusterOptions {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Bandwidth limit for clone operations
   */
  bwlimit?: string;

  /**
   * Console mode
   */
  console?: string;

  /**
   * Migration settings
   */
  migration?: string;

  /**
   * HTTP proxy
   */
  http_proxy?: string;

  /**
   * Keyboard layout
   */
  keyboard?: string;

  /**
   * Language
   */
  language?: string;

  /**
   * Maximum workers
   */
  max_workers?: number;

  /**
   * Email from address
   */
  email_from?: string;

  /**
   * HA shutdown policy
   */
  ha_shutdown_policy?: string;
}

/**
 * Type guard to check if a resource is ClusterOptions
 */
export function isClusterOptions(resource: unknown): resource is ClusterOptions {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::ClusterOptions"
  );
}

/**
 * Configures Proxmox Cluster/Datacenter-wide options.
 *
 * @example
 * ## Configure basic datacenter options
 *
 * Set basic cluster-wide settings:
 *
 * ```ts
 * import { ClusterOptions } from "alchemy/proxmox";
 *
 * const options = await ClusterOptions("datacenter", {
 *   keyboard: "en-us",
 *   language: "en",
 *   console: "xtermjs",
 * });
 * ```
 *
 * @example
 * ## Configure migration settings
 *
 * Set migration bandwidth and network:
 *
 * ```ts
 * import { ClusterOptions } from "alchemy/proxmox";
 *
 * const options = await ClusterOptions("migration-config", {
 *   migration: "network=10.0.0.0/24,type=secure",
 *   bwlimit: "clone=10240,default=5120",
 * });
 * ```
 *
 * @example
 * ## Configure HA settings
 *
 * Set high availability policies:
 *
 * ```ts
 * import { ClusterOptions } from "alchemy/proxmox";
 *
 * const options = await ClusterOptions("ha-config", {
 *   ha_shutdown_policy: "migrate",
 *   email_from: "proxmox@example.com",
 * });
 * ```
 */
export const ClusterOptions = Resource(
  "proxmox::ClusterOptions",
  async function (
    this: Context<ClusterOptions>,
    id: string,
    props: ClusterOptionsProps,
  ): Promise<ClusterOptions> {
    const client = await createProxmoxClient(props);

    if (this.phase === "delete") {
      // Cluster options typically aren't deleted, just reset
      return this.destroy();
    }

    // Build update params
    const updateParams: Record<string, unknown> = {};

    if (props.bwlimit !== undefined) updateParams.bwlimit = props.bwlimit;
    if (props.console !== undefined) updateParams.console = props.console;
    if (props.migration !== undefined) updateParams.migration = props.migration;
    if (props.http_proxy !== undefined)
      updateParams.http_proxy = props.http_proxy;
    if (props.keyboard !== undefined) updateParams.keyboard = props.keyboard;
    if (props.language !== undefined) updateParams.language = props.language;
    if (props.max_workers !== undefined)
      updateParams.max_workers = props.max_workers;
    if (props.email_from !== undefined)
      updateParams.email_from = props.email_from;
    if (props.ha_shutdown_policy !== undefined)
      updateParams["ha"] = `shutdown_policy=${props.ha_shutdown_policy}`;
    if (props.user_tag_access !== undefined)
      updateParams.user_tag_access = props.user_tag_access;
    if (props.registered_tags !== undefined)
      updateParams.registered_tags = props.registered_tags;

    // Update cluster options
    if (Object.keys(updateParams).length > 0) {
      await client.cluster.options.$put(
        updateParams as Parameters<typeof client.cluster.options.$put>[0],
      );
    }

    // Fetch current options
    const options = await client.cluster.options.$get();
    const optionsObj = options as Record<string, unknown>;

    return {
      id,
      bwlimit: optionsObj.bwlimit as string | undefined,
      console: optionsObj.console as string | undefined,
      migration: optionsObj.migration as string | undefined,
      http_proxy: optionsObj.http_proxy as string | undefined,
      keyboard: optionsObj.keyboard as string | undefined,
      language: optionsObj.language as string | undefined,
      max_workers: optionsObj.max_workers as number | undefined,
      email_from: optionsObj.email_from as string | undefined,
      ha_shutdown_policy: optionsObj.ha as string | undefined,
    };
  },
);
