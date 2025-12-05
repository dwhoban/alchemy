import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import type { Secret } from "../secret.ts";
import { Secret as SecretClass } from "../secret.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating a Proxmox User
 */
export interface UserProps extends ProxmoxApiOptions {
  /**
   * User ID in the format 'username@realm' (e.g., 'admin@pve', 'user@pam')
   */
  userid: string;

  /**
   * User's email address
   */
  email?: string;

  /**
   * User's first name
   */
  firstname?: string;

  /**
   * User's last name
   */
  lastname?: string;

  /**
   * User comment/description
   */
  comment?: string;

  /**
   * Initial password for the user (only used on creation)
   */
  password?: string | Secret;

  /**
   * Groups the user belongs to (comma-separated or array)
   */
  groups?: string | string[];

  /**
   * Account expiration date (seconds since epoch, 0 = never)
   * @default 0
   */
  expire?: number;

  /**
   * Enable/disable the user account
   * @default true
   */
  enable?: boolean;

  /**
   * User keys (for two-factor auth)
   */
  keys?: string;

  /**
   * Whether to delete the user when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after User creation/update
 */
export interface User {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * User ID in the format 'username@realm'
   */
  userid: string;

  /**
   * User's email address
   */
  email?: string;

  /**
   * User's first name
   */
  firstname?: string;

  /**
   * User's last name
   */
  lastname?: string;

  /**
   * User comment/description
   */
  comment?: string;

  /**
   * Groups the user belongs to
   */
  groups: string[];

  /**
   * Account expiration date (seconds since epoch)
   */
  expire: number;

  /**
   * Whether the user is enabled
   */
  enable: boolean;

  /**
   * Realm of the user (e.g., 'pam', 'pve')
   */
  realm: string;
}

/**
 * Type guard to check if a resource is a User
 */
export function isUser(resource: unknown): resource is User {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::User"
  );
}

/**
 * Creates and manages a Proxmox User account.
 *
 * @example
 * ## Create a basic user
 *
 * Create a user with minimal configuration:
 *
 * ```ts
 * import { User } from "alchemy/proxmox";
 *
 * const user = await User("admin-user", {
 *   userid: "admin@pve",
 *   password: alchemy.secret.env.ADMIN_PASSWORD,
 *   email: "admin@example.com",
 * });
 * ```
 *
 * @example
 * ## Create a user with groups
 *
 * Create a user and assign to groups:
 *
 * ```ts
 * import { User } from "alchemy/proxmox";
 *
 * const user = await User("developer", {
 *   userid: "dev@pve",
 *   firstname: "John",
 *   lastname: "Doe",
 *   email: "john@example.com",
 *   groups: ["developers", "testers"],
 *   comment: "Developer account",
 * });
 * ```
 *
 * @example
 * ## Create a user with expiration
 *
 * Create a temporary user account:
 *
 * ```ts
 * import { User } from "alchemy/proxmox";
 *
 * const tempUser = await User("temp-user", {
 *   userid: "temp@pve",
 *   expire: Math.floor(Date.now() / 1000) + 86400 * 30, // Expires in 30 days
 *   comment: "Temporary account",
 * });
 * ```
 */
export const User = Resource(
  "proxmox::User",
  async function (
    this: Context<User>,
    id: string,
    props: UserProps,
  ): Promise<User> {
    const client = await createProxmoxClient(props);
    const userid = props.userid;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.userid) {
          try {
            await client.access.users.$(this.output.userid).$delete();
          } catch (error: unknown) {
            // Ignore 404 errors (user already deleted)
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create": {
        // Build user configuration
        const createParams: Record<string, unknown> = {
          userid,
        };

        if (props.email) createParams.email = props.email;
        if (props.firstname) createParams.firstname = props.firstname;
        if (props.lastname) createParams.lastname = props.lastname;
        if (props.comment) createParams.comment = props.comment;
        if (props.password) {
          createParams.password = SecretClass.unwrap(props.password);
        }
        if (props.groups) {
          createParams.groups = Array.isArray(props.groups)
            ? props.groups.join(",")
            : props.groups;
        }
        if (props.expire !== undefined) createParams.expire = props.expire;
        if (props.enable !== undefined)
          createParams.enable = props.enable ? 1 : 0;
        if (props.keys) createParams.keys = props.keys;

        // Create the user
        await client.access.users.$post(
          createParams as Parameters<typeof client.access.users.$post>[0],
        );

        return fetchUserInfo(client, id, userid);
      }

      case "update": {
        // Build update configuration
        const updateParams: Record<string, unknown> = {};

        if (props.email) updateParams.email = props.email;
        if (props.firstname) updateParams.firstname = props.firstname;
        if (props.lastname) updateParams.lastname = props.lastname;
        if (props.comment) updateParams.comment = props.comment;
        if (props.groups) {
          updateParams.groups = Array.isArray(props.groups)
            ? props.groups.join(",")
            : props.groups;
        }
        if (props.expire !== undefined) updateParams.expire = props.expire;
        if (props.enable !== undefined)
          updateParams.enable = props.enable ? 1 : 0;
        if (props.keys) updateParams.keys = props.keys;

        // Update existing user
        await client.access.users
          .$(userid)
          .$put(
            updateParams as Parameters<
              (typeof client.access.users.$get)[0]["$put"]
            >[0],
          );

        return fetchUserInfo(client, id, userid);
      }
    }
  },
);

/**
 * Fetch user information from Proxmox
 * @internal
 */
async function fetchUserInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  userid: string,
): Promise<User> {
  const userInfo = await client.access.users.$(userid).$get();

  // Parse groups from response
  const groupsStr = (userInfo.groups as string) ?? "";
  const groups = groupsStr ? groupsStr.split(",") : [];

  // Extract realm from userid
  const realmMatch = userid.match(/@(.+)$/);
  const realm = realmMatch ? realmMatch[1] : "pam";

  return {
    id,
    userid,
    email: userInfo.email as string | undefined,
    firstname: userInfo.firstname as string | undefined,
    lastname: userInfo.lastname as string | undefined,
    comment: userInfo.comment as string | undefined,
    groups,
    expire: (userInfo.expire as number) ?? 0,
    enable: userInfo.enable !== 0,
    realm,
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
