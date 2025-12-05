import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating an ACME Plugin
 */
export interface ACMEPluginProps extends ProxmoxApiOptions {
  /**
   * Plugin ID (unique identifier)
   */
  pluginId: string;

  /**
   * Plugin type (dns or standalone)
   */
  type: "dns" | "standalone";

  /**
   * DNS API plugin to use (for dns type)
   */
  api?: string;

  /**
   * DNS API credentials/data
   */
  data?: string;

  /**
   * Enable/disable plugin
   * @default true
   */
  disable?: boolean;

  /**
   * Number of validation attempts
   * @default 1
   */
  validationdelay?: number;

  /**
   * Whether to delete the plugin when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after ACMEPlugin creation/update
 */
export interface ACMEPlugin {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Plugin ID
   */
  pluginId: string;

  /**
   * Plugin type
   */
  type: string;

  /**
   * DNS API used
   */
  api?: string;

  /**
   * Whether plugin is disabled
   */
  disable: boolean;

  /**
   * Validation delay
   */
  validationdelay?: number;

  /**
   * Digest for concurrency control
   */
  digest?: string;
}

/**
 * Type guard to check if a resource is an ACMEPlugin
 */
export function isACMEPlugin(resource: unknown): resource is ACMEPlugin {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::ACMEPlugin"
  );
}

/**
 * Creates and manages a Proxmox ACME DNS Plugin.
 *
 * @example
 * ## Create a Cloudflare DNS plugin
 *
 * Create a DNS challenge plugin for Cloudflare:
 *
 * ```ts
 * import { ACMEPlugin } from "alchemy/proxmox";
 *
 * const plugin = await ACMEPlugin("cloudflare", {
 *   pluginId: "cloudflare",
 *   type: "dns",
 *   api: "cf",
 *   data: "CF_Token=your-api-token",
 * });
 * ```
 *
 * @example
 * ## Create a standalone plugin
 *
 * Create a standalone HTTP challenge plugin:
 *
 * ```ts
 * import { ACMEPlugin } from "alchemy/proxmox";
 *
 * const plugin = await ACMEPlugin("standalone", {
 *   pluginId: "standalone",
 *   type: "standalone",
 * });
 * ```
 *
 * @example
 * ## Create a Route53 DNS plugin
 *
 * Create a DNS challenge plugin for AWS Route53:
 *
 * ```ts
 * import { ACMEPlugin } from "alchemy/proxmox";
 *
 * const plugin = await ACMEPlugin("aws-route53", {
 *   pluginId: "route53",
 *   type: "dns",
 *   api: "aws",
 *   data: "AWS_ACCESS_KEY_ID=...\nAWS_SECRET_ACCESS_KEY=...",
 * });
 * ```
 */
export const ACMEPlugin = Resource(
  "proxmox::ACMEPlugin",
  async function (
    this: Context<ACMEPlugin>,
    id: string,
    props: ACMEPluginProps,
  ): Promise<ACMEPlugin> {
    const client = await createProxmoxClient(props);
    const pluginId = props.pluginId;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.pluginId) {
          try {
            await client.cluster.acme.plugins.$(this.output.pluginId).$delete();
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
          id: pluginId,
          type: props.type,
        };

        if (props.api) createParams.api = props.api;
        if (props.data) createParams.data = props.data;
        if (props.disable !== undefined)
          createParams.disable = props.disable ? 1 : 0;
        if (props.validationdelay)
          createParams.validationdelay = props.validationdelay;

        await client.cluster.acme.plugins.$post(
          createParams as Parameters<
            typeof client.cluster.acme.plugins.$post
          >[0],
        );

        return fetchPluginInfo(client, id, pluginId, props);
      }

      case "update": {
        const updateParams: Record<string, unknown> = {};

        if (props.api) updateParams.api = props.api;
        if (props.data) updateParams.data = props.data;
        if (props.disable !== undefined)
          updateParams.disable = props.disable ? 1 : 0;
        if (props.validationdelay)
          updateParams.validationdelay = props.validationdelay;

        await client.cluster.acme.plugins
          .$(pluginId)
          .$put(
            updateParams as Parameters<
              (typeof client.cluster.acme.plugins.$get)[0]["$put"]
            >[0],
          );

        return fetchPluginInfo(client, id, pluginId, props);
      }
    }
  },
);

/**
 * Fetch ACME plugin information from Proxmox
 * @internal
 */
async function fetchPluginInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  pluginId: string,
  props: ACMEPluginProps,
): Promise<ACMEPlugin> {
  const plugins = await client.cluster.acme.plugins.$get();
  const pluginInfo = (plugins as Array<Record<string, unknown>>).find(
    (p) => p.plugin === pluginId,
  );

  return {
    id,
    pluginId,
    type: (pluginInfo?.type as string) ?? props.type,
    api: (pluginInfo?.api as string) ?? props.api,
    disable: Boolean(pluginInfo?.disable ?? props.disable),
    validationdelay:
      (pluginInfo?.validationdelay as number) ?? props.validationdelay,
    digest: pluginInfo?.digest as string | undefined,
  };
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
