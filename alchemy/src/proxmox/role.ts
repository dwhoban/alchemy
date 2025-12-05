import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Built-in Proxmox role names
 */
export type BuiltinRole =
  | "Administrator"
  | "NoAccess"
  | "PVEAdmin"
  | "PVEAuditor"
  | "PVEDatastoreAdmin"
  | "PVEDatastoreUser"
  | "PVEPoolAdmin"
  | "PVEPoolUser"
  | "PVESysAdmin"
  | "PVETemplateUser"
  | "PVEUserAdmin"
  | "PVEVMAdmin"
  | "PVEVMUser";

/**
 * Proxmox privilege types
 */
export type Privilege =
  | "Datastore.Allocate"
  | "Datastore.AllocateSpace"
  | "Datastore.AllocateTemplate"
  | "Datastore.Audit"
  | "Group.Allocate"
  | "Mapping.Audit"
  | "Mapping.Modify"
  | "Mapping.Use"
  | "Permissions.Modify"
  | "Pool.Allocate"
  | "Pool.Audit"
  | "Realm.Allocate"
  | "Realm.AllocateUser"
  | "SDN.Allocate"
  | "SDN.Audit"
  | "SDN.Use"
  | "Sys.Audit"
  | "Sys.Console"
  | "Sys.Incoming"
  | "Sys.Modify"
  | "Sys.PowerMgmt"
  | "Sys.Syslog"
  | "User.Modify"
  | "VM.Allocate"
  | "VM.Audit"
  | "VM.Backup"
  | "VM.Clone"
  | "VM.Config.CDROM"
  | "VM.Config.CPU"
  | "VM.Config.Cloudinit"
  | "VM.Config.Disk"
  | "VM.Config.HWType"
  | "VM.Config.Memory"
  | "VM.Config.Network"
  | "VM.Config.Options"
  | "VM.Console"
  | "VM.Migrate"
  | "VM.Monitor"
  | "VM.PowerMgmt"
  | "VM.Snapshot"
  | "VM.Snapshot.Rollback";

/**
 * Properties for creating or updating a Proxmox Role
 */
export interface RoleProps extends ProxmoxApiOptions {
  /**
   * Role ID/name
   */
  roleid: string;

  /**
   * Privileges assigned to this role
   */
  privs: Privilege[] | string;

  /**
   * Whether to delete the role when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after Role creation/update
 */
export interface Role {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Role ID/name
   */
  roleid: string;

  /**
   * Privileges assigned to this role
   */
  privs: string[];

  /**
   * Whether this is a special/built-in role
   */
  special: boolean;
}

/**
 * Type guard to check if a resource is a Role
 */
export function isRole(resource: unknown): resource is Role {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::Role"
  );
}

/**
 * Creates and manages a Proxmox Role for access control.
 *
 * @example
 * ## Create a VM operator role
 *
 * Create a role with VM management privileges:
 *
 * ```ts
 * import { Role } from "alchemy/proxmox";
 *
 * const role = await Role("vm-operator", {
 *   roleid: "VMOperator",
 *   privs: [
 *     "VM.Audit",
 *     "VM.Console",
 *     "VM.PowerMgmt",
 *     "VM.Monitor",
 *   ],
 * });
 * ```
 *
 * @example
 * ## Create a backup operator role
 *
 * Create a role for backup operations:
 *
 * ```ts
 * import { Role } from "alchemy/proxmox";
 *
 * const role = await Role("backup-operator", {
 *   roleid: "BackupOperator",
 *   privs: [
 *     "Datastore.Audit",
 *     "Datastore.AllocateSpace",
 *     "VM.Backup",
 *   ],
 * });
 * ```
 *
 * @example
 * ## Create a read-only role
 *
 * Create a role for auditing:
 *
 * ```ts
 * import { Role } from "alchemy/proxmox";
 *
 * const role = await Role("auditor", {
 *   roleid: "Auditor",
 *   privs: [
 *     "Sys.Audit",
 *     "VM.Audit",
 *     "Datastore.Audit",
 *     "Pool.Audit",
 *   ],
 * });
 * ```
 */
export const Role = Resource(
  "proxmox::Role",
  async function (
    this: Context<Role>,
    id: string,
    props: RoleProps,
  ): Promise<Role> {
    const client = await createProxmoxClient(props);
    const roleid = props.roleid;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.roleid) {
          try {
            await client.access.roles.$(this.output.roleid).$delete();
          } catch (error: unknown) {
            // Ignore 404 errors (role already deleted)
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create": {
        // Build role configuration
        const privs = Array.isArray(props.privs)
          ? props.privs.join(",")
          : props.privs;

        const createParams: Record<string, unknown> = {
          roleid,
          privs,
        };

        // Create the role
        await client.access.roles.$post(
          createParams as Parameters<typeof client.access.roles.$post>[0],
        );

        return fetchRoleInfo(client, id, roleid);
      }

      case "update": {
        // Build update configuration
        const privs = Array.isArray(props.privs)
          ? props.privs.join(",")
          : props.privs;

        // Update existing role
        await client.access.roles
          .$(roleid)
          .$put({ privs } as Parameters<
            (typeof client.access.roles.$get)[0]["$put"]
          >[0]);

        return fetchRoleInfo(client, id, roleid);
      }
    }
  },
);

/**
 * Fetch role information from Proxmox
 * @internal
 */
async function fetchRoleInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  roleid: string,
): Promise<Role> {
  const roleInfo = await client.access.roles.$(roleid).$get();

  // Parse privileges from response
  const privsStr =
    typeof roleInfo === "string" ? roleInfo : ((roleInfo as Record<string, unknown>).privs as string) ?? "";
  const privs = privsStr ? privsStr.split(",") : [];

  return {
    id,
    roleid,
    privs,
    special: false, // Custom roles are not special
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
