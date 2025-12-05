import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating a Firewall Security Group
 */
export interface FirewallGroupProps extends ProxmoxApiOptions {
  /**
   * Security group name
   */
  group: string;

  /**
   * Group comment/description
   */
  comment?: string;

  /**
   * Whether to delete the group when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after FirewallGroup creation/update
 */
export interface FirewallGroup {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Security group name
   */
  group: string;

  /**
   * Group comment/description
   */
  comment?: string;

  /**
   * Digest for concurrency control
   */
  digest?: string;
}

/**
 * Type guard to check if a resource is a FirewallGroup
 */
export function isFirewallGroup(resource: unknown): resource is FirewallGroup {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::FirewallGroup"
  );
}

/**
 * Creates and manages a Proxmox Firewall Security Group.
 *
 * @example
 * ## Create a security group
 *
 * Create a reusable security group:
 *
 * ```ts
 * import { FirewallGroup } from "alchemy/proxmox";
 *
 * const group = await FirewallGroup("web-servers", {
 *   group: "web-servers",
 *   comment: "Rules for web servers",
 * });
 * ```
 *
 * @example
 * ## Create a database security group
 *
 * Create a group for database servers:
 *
 * ```ts
 * import { FirewallGroup } from "alchemy/proxmox";
 *
 * const group = await FirewallGroup("db-servers", {
 *   group: "db-servers",
 *   comment: "Rules for database servers",
 * });
 * ```
 */
export const FirewallGroup = Resource(
  "proxmox::FirewallGroup",
  async function (
    this: Context<FirewallGroup>,
    id: string,
    props: FirewallGroupProps,
  ): Promise<FirewallGroup> {
    const client = await createProxmoxClient(props);
    const group = props.group;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.group) {
          try {
            await client.cluster.firewall.groups.$(this.output.group).$delete();
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
          group,
        };

        if (props.comment) createParams.comment = props.comment;

        await client.cluster.firewall.groups.$post(
          createParams as Parameters<
            typeof client.cluster.firewall.groups.$post
          >[0],
        );

        return fetchFirewallGroupInfo(client, id, group, props);
      }

      case "update": {
        // Groups can't be updated directly, only their rules
        // Return current state
        return fetchFirewallGroupInfo(client, id, group, props);
      }
    }
  },
);

/**
 * Fetch firewall group information from Proxmox
 * @internal
 */
async function fetchFirewallGroupInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  group: string,
  props: FirewallGroupProps,
): Promise<FirewallGroup> {
  const groups = await client.cluster.firewall.groups.$get();
  const groupInfo = (groups as Array<Record<string, unknown>>).find(
    (g) => g.group === group,
  );

  return {
    id,
    group,
    comment: (groupInfo?.comment as string) ?? props.comment,
    digest: groupInfo?.digest as string | undefined,
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
