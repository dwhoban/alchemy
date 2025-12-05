import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating a Proxmox Group
 */
export interface GroupProps extends ProxmoxApiOptions {
  /**
   * Group ID/name
   */
  groupid: string;

  /**
   * Group comment/description
   */
  comment?: string;

  /**
   * Users to add to the group (comma-separated or array of userids)
   */
  members?: string | string[];

  /**
   * Whether to delete the group when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after Group creation/update
 */
export interface Group {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Group ID/name
   */
  groupid: string;

  /**
   * Group comment/description
   */
  comment?: string;

  /**
   * Users in the group
   */
  members: string[];
}

/**
 * Type guard to check if a resource is a Group
 */
export function isGroup(resource: unknown): resource is Group {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::Group"
  );
}

/**
 * Creates and manages a Proxmox Group for access control.
 *
 * @example
 * ## Create a basic group
 *
 * Create a group with minimal configuration:
 *
 * ```ts
 * import { Group } from "alchemy/proxmox";
 *
 * const group = await Group("admins", {
 *   groupid: "admins",
 *   comment: "Administrator group",
 * });
 * ```
 *
 * @example
 * ## Create a group with members
 *
 * Create a group and assign users:
 *
 * ```ts
 * import { Group } from "alchemy/proxmox";
 *
 * const group = await Group("developers", {
 *   groupid: "developers",
 *   comment: "Development team",
 *   members: ["user1@pve", "user2@pve"],
 * });
 * ```
 */
export const Group = Resource(
  "proxmox::Group",
  async function (
    this: Context<Group>,
    id: string,
    props: GroupProps,
  ): Promise<Group> {
    const client = await createProxmoxClient(props);
    const groupid = props.groupid;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.groupid) {
          try {
            await client.access.groups.$(this.output.groupid).$delete();
          } catch (error: unknown) {
            // Ignore 404 errors (group already deleted)
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create": {
        // Build group configuration
        const createParams: Record<string, unknown> = {
          groupid,
        };

        if (props.comment) createParams.comment = props.comment;

        // Create the group
        await client.access.groups.$post(
          createParams as Parameters<typeof client.access.groups.$post>[0],
        );

        // Add members if specified
        if (props.members) {
          const members = Array.isArray(props.members)
            ? props.members
            : props.members.split(",");

          for (const userid of members) {
            try {
              // Get current user groups and add this group
              const userInfo = await client.access.users.$(userid.trim()).$get();
              const currentGroups = (userInfo.groups as string) ?? "";
              const groupList = currentGroups
                ? currentGroups.split(",")
                : [];
              if (!groupList.includes(groupid)) {
                groupList.push(groupid);
              }
              await client.access.users
                .$(userid.trim())
                .$put({ groups: groupList.join(",") } as Parameters<
                  (typeof client.access.users.$get)[0]["$put"]
                >[0]);
            } catch {
              // User might not exist
            }
          }
        }

        return fetchGroupInfo(client, id, groupid);
      }

      case "update": {
        // Update group comment
        if (props.comment) {
          await client.access.groups
            .$(groupid)
            .$put({ comment: props.comment } as Parameters<
              (typeof client.access.groups.$get)[0]["$put"]
            >[0]);
        }

        // Update members if specified
        if (props.members) {
          const members = Array.isArray(props.members)
            ? props.members
            : props.members.split(",");

          for (const userid of members) {
            try {
              const userInfo = await client.access.users.$(userid.trim()).$get();
              const currentGroups = (userInfo.groups as string) ?? "";
              const groupList = currentGroups
                ? currentGroups.split(",")
                : [];
              if (!groupList.includes(groupid)) {
                groupList.push(groupid);
              }
              await client.access.users
                .$(userid.trim())
                .$put({ groups: groupList.join(",") } as Parameters<
                  (typeof client.access.users.$get)[0]["$put"]
                >[0]);
            } catch {
              // User might not exist
            }
          }
        }

        return fetchGroupInfo(client, id, groupid);
      }
    }
  },
);

/**
 * Fetch group information from Proxmox
 * @internal
 */
async function fetchGroupInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  groupid: string,
): Promise<Group> {
  const groupInfo = await client.access.groups.$(groupid).$get();

  // Parse members from response
  const membersStr = (groupInfo.members as string) ?? "";
  const members = membersStr ? membersStr.split(",") : [];

  return {
    id,
    groupid,
    comment: groupInfo.comment as string | undefined,
    members,
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
