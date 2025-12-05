import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * ACL propagation type
 */
export type ACLPropagate = boolean;

/**
 * Properties for creating or updating a Proxmox ACL
 */
export interface ACLProps extends ProxmoxApiOptions {
  /**
   * Access control path (e.g., '/', '/vms/100', '/storage/local')
   */
  path: string;

  /**
   * Role to assign
   */
  roles: string | string[];

  /**
   * Users to apply the ACL to (comma-separated or array)
   * Either users or groups must be specified
   */
  users?: string | string[];

  /**
   * Groups to apply the ACL to (comma-separated or array)
   * Either users or groups must be specified
   */
  groups?: string | string[];

  /**
   * Whether permissions propagate to child objects
   * @default true
   */
  propagate?: boolean;

  /**
   * Whether to delete the ACL when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after ACL creation/update
 */
export interface ACL {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Access control path
   */
  path: string;

  /**
   * Roles assigned
   */
  roles: string[];

  /**
   * Users the ACL applies to
   */
  users: string[];

  /**
   * Groups the ACL applies to
   */
  groups: string[];

  /**
   * Whether permissions propagate
   */
  propagate: boolean;
}

/**
 * Type guard to check if a resource is an ACL
 */
export function isACL(resource: unknown): resource is ACL {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::ACL"
  );
}

/**
 * Creates and manages a Proxmox Access Control List (ACL) entry.
 *
 * @example
 * ## Grant admin access to a user
 *
 * Give a user full admin access:
 *
 * ```ts
 * import { ACL } from "alchemy/proxmox";
 *
 * const acl = await ACL("admin-access", {
 *   path: "/",
 *   roles: "Administrator",
 *   users: "admin@pve",
 * });
 * ```
 *
 * @example
 * ## Grant VM access to a group
 *
 * Give a group access to specific VMs:
 *
 * ```ts
 * import { ACL } from "alchemy/proxmox";
 *
 * const acl = await ACL("dev-vm-access", {
 *   path: "/vms/100",
 *   roles: ["PVEVMUser", "PVEVMAdmin"],
 *   groups: "developers",
 *   propagate: false,
 * });
 * ```
 *
 * @example
 * ## Grant storage access
 *
 * Give users access to storage:
 *
 * ```ts
 * import { ACL } from "alchemy/proxmox";
 *
 * const acl = await ACL("storage-access", {
 *   path: "/storage/local",
 *   roles: "PVEDatastoreUser",
 *   users: ["user1@pve", "user2@pve"],
 * });
 * ```
 */
export const ACL = Resource(
  "proxmox::ACL",
  async function (
    this: Context<ACL>,
    id: string,
    props: ACLProps,
  ): Promise<ACL> {
    const client = await createProxmoxClient(props);
    const path = props.path;

    // Parse roles, users, and groups
    const roles = Array.isArray(props.roles) ? props.roles : [props.roles];
    const users = props.users
      ? Array.isArray(props.users)
        ? props.users
        : props.users.split(",")
      : [];
    const groups = props.groups
      ? Array.isArray(props.groups)
        ? props.groups
        : props.groups.split(",")
      : [];
    const propagate = props.propagate !== false;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false) {
          // Remove ACL by setting delete flag
          for (const role of roles) {
            for (const user of users) {
              try {
                await client.access.acl.$put({
                  path,
                  roles: role,
                  users: user.trim(),
                  delete: 1,
                } as Parameters<typeof client.access.acl.$put>[0]);
              } catch {
                // ACL might already be removed
              }
            }
            for (const group of groups) {
              try {
                await client.access.acl.$put({
                  path,
                  roles: role,
                  groups: group.trim(),
                  delete: 1,
                } as Parameters<typeof client.access.acl.$put>[0]);
              } catch {
                // ACL might already be removed
              }
            }
          }
        }
        return this.destroy();
      }

      case "create":
      case "update": {
        // Set ACL for each role/user/group combination
        for (const role of roles) {
          if (users.length > 0) {
            await client.access.acl.$put({
              path,
              roles: role,
              users: users.join(","),
              propagate: propagate ? 1 : 0,
            } as Parameters<typeof client.access.acl.$put>[0]);
          }
          if (groups.length > 0) {
            await client.access.acl.$put({
              path,
              roles: role,
              groups: groups.join(","),
              propagate: propagate ? 1 : 0,
            } as Parameters<typeof client.access.acl.$put>[0]);
          }
        }

        return {
          id,
          path,
          roles,
          users: users.map((u) => u.trim()),
          groups: groups.map((g) => g.trim()),
          propagate,
        };
      }
    }
  },
);
