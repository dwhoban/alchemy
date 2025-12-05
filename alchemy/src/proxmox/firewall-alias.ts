import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating a Firewall Alias
 */
export interface FirewallAliasProps extends ProxmoxApiOptions {
  /**
   * Alias name
   */
  name: string;

  /**
   * IP address or CIDR (e.g., '192.168.1.0/24', '10.0.0.1')
   */
  cidr: string;

  /**
   * Alias comment/description
   */
  comment?: string;

  /**
   * Whether to delete the alias when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after FirewallAlias creation/update
 */
export interface FirewallAlias {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Alias name
   */
  name: string;

  /**
   * IP address or CIDR
   */
  cidr: string;

  /**
   * Alias comment/description
   */
  comment?: string;

  /**
   * Digest for concurrency control
   */
  digest?: string;
}

/**
 * Type guard to check if a resource is a FirewallAlias
 */
export function isFirewallAlias(resource: unknown): resource is FirewallAlias {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::FirewallAlias"
  );
}

/**
 * Creates and manages a Proxmox Firewall Alias.
 *
 * @example
 * ## Create a network alias
 *
 * Create an alias for a network:
 *
 * ```ts
 * import { FirewallAlias } from "alchemy/proxmox";
 *
 * const alias = await FirewallAlias("internal-net", {
 *   name: "internal_network",
 *   cidr: "192.168.1.0/24",
 *   comment: "Internal network range",
 * });
 * ```
 *
 * @example
 * ## Create a host alias
 *
 * Create an alias for a single host:
 *
 * ```ts
 * import { FirewallAlias } from "alchemy/proxmox";
 *
 * const alias = await FirewallAlias("db-server", {
 *   name: "db_server",
 *   cidr: "192.168.1.100",
 *   comment: "Database server",
 * });
 * ```
 */
export const FirewallAlias = Resource(
  "proxmox::FirewallAlias",
  async function (
    this: Context<FirewallAlias>,
    id: string,
    props: FirewallAliasProps,
  ): Promise<FirewallAlias> {
    const client = await createProxmoxClient(props);
    const name = props.name;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.name) {
          try {
            await client.cluster.firewall.aliases
              .$(this.output.name)
              .$delete();
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
          cidr: props.cidr,
        };

        if (props.comment) createParams.comment = props.comment;

        await client.cluster.firewall.aliases.$post(
          createParams as Parameters<
            typeof client.cluster.firewall.aliases.$post
          >[0],
        );

        return fetchAliasInfo(client, id, name, props);
      }

      case "update": {
        const updateParams: Record<string, unknown> = {
          cidr: props.cidr,
        };

        if (props.comment) updateParams.comment = props.comment;

        await client.cluster.firewall.aliases
          .$(name)
          .$put(
            updateParams as Parameters<
              (typeof client.cluster.firewall.aliases.$get)[0]["$put"]
            >[0],
          );

        return fetchAliasInfo(client, id, name, props);
      }
    }
  },
);

/**
 * Fetch alias information from Proxmox
 * @internal
 */
async function fetchAliasInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  name: string,
  props: FirewallAliasProps,
): Promise<FirewallAlias> {
  const aliases = await client.cluster.firewall.aliases.$get();
  const aliasInfo = (aliases as Array<Record<string, unknown>>).find(
    (a) => a.name === name,
  );

  return {
    id,
    name,
    cidr: (aliasInfo?.cidr as string) ?? props.cidr,
    comment: (aliasInfo?.comment as string) ?? props.comment,
    digest: aliasInfo?.digest as string | undefined,
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
