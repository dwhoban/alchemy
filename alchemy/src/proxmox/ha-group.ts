import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating an HA Group
 */
export interface HAGroupProps extends ProxmoxApiOptions {
  /**
   * HA group ID
   */
  group: string;

  /**
   * Nodes in this group with optional priority (format: 'node1:100,node2:50')
   * Higher priority nodes are preferred
   */
  nodes: string;

  /**
   * Group comment/description
   */
  comment?: string;

  /**
   * Restrict resources to run only on nodes in this group
   * @default false
   */
  restricted?: boolean;

  /**
   * Disable failover if no node is available (nofailback)
   * @default false
   */
  nofailback?: boolean;

  /**
   * Whether to delete the group when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after HAGroup creation/update
 */
export interface HAGroup {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * HA group ID
   */
  group: string;

  /**
   * Nodes in this group with priorities
   */
  nodes: string;

  /**
   * Group comment/description
   */
  comment?: string;

  /**
   * Whether resources are restricted to this group
   */
  restricted: boolean;

  /**
   * Whether failback is disabled
   */
  nofailback: boolean;

  /**
   * Resource type identifier
   */
  type: "group";
}

/**
 * Type guard to check if a resource is an HAGroup
 */
export function isHAGroup(resource: unknown): resource is HAGroup {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::HAGroup"
  );
}

/**
 * Creates and manages a Proxmox HA (High Availability) Group.
 *
 * @example
 * ## Create a basic HA group
 *
 * Create an HA group with multiple nodes:
 *
 * ```ts
 * import { HAGroup } from "alchemy/proxmox";
 *
 * const haGroup = await HAGroup("production", {
 *   group: "production",
 *   nodes: "pve1:100,pve2:50,pve3:50",
 *   comment: "Production HA group",
 * });
 * ```
 *
 * @example
 * ## Create a restricted HA group
 *
 * Create a group that restricts resources to specific nodes:
 *
 * ```ts
 * import { HAGroup } from "alchemy/proxmox";
 *
 * const haGroup = await HAGroup("gpu-nodes", {
 *   group: "gpu-nodes",
 *   nodes: "gpu1,gpu2",
 *   restricted: true,
 *   comment: "GPU-enabled nodes only",
 * });
 * ```
 */
export const HAGroup = Resource(
  "proxmox::HAGroup",
  async function (
    this: Context<HAGroup>,
    id: string,
    props: HAGroupProps,
  ): Promise<HAGroup> {
    const client = await createProxmoxClient(props);
    const group = props.group;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.group) {
          try {
            await client.cluster.ha.groups.$(this.output.group).$delete();
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
          nodes: props.nodes,
        };

        if (props.comment) createParams.comment = props.comment;
        if (props.restricted !== undefined)
          createParams.restricted = props.restricted ? 1 : 0;
        if (props.nofailback !== undefined)
          createParams.nofailback = props.nofailback ? 1 : 0;

        await client.cluster.ha.groups.$post(
          createParams as Parameters<
            typeof client.cluster.ha.groups.$post
          >[0],
        );

        return fetchHAGroupInfo(client, id, group);
      }

      case "update": {
        const updateParams: Record<string, unknown> = {
          nodes: props.nodes,
        };

        if (props.comment) updateParams.comment = props.comment;
        if (props.restricted !== undefined)
          updateParams.restricted = props.restricted ? 1 : 0;
        if (props.nofailback !== undefined)
          updateParams.nofailback = props.nofailback ? 1 : 0;

        await client.cluster.ha.groups
          .$(group)
          .$put(
            updateParams as Parameters<
              (typeof client.cluster.ha.groups.$get)[0]["$put"]
            >[0],
          );

        return fetchHAGroupInfo(client, id, group);
      }
    }
  },
);

/**
 * Fetch HA group information from Proxmox
 * @internal
 */
async function fetchHAGroupInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  group: string,
): Promise<HAGroup> {
  const groupInfo = await client.cluster.ha.groups.$(group).$get();

  return {
    id,
    group,
    nodes: (groupInfo.nodes as string) ?? "",
    comment: groupInfo.comment as string | undefined,
    restricted: Boolean(groupInfo.restricted),
    nofailback: Boolean(groupInfo.nofailback),
    type: "group",
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
