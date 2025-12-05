import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import type { Secret } from "../secret.ts";
import { Secret as SecretClass } from "../secret.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating a Proxmox API Token
 */
export interface APITokenProps extends ProxmoxApiOptions {
  /**
   * User ID the token belongs to (e.g., 'root@pam')
   */
  userid: string;

  /**
   * Token ID (will be combined with userid as 'userid!tokenid')
   */
  tokenid: string;

  /**
   * Token comment/description
   */
  comment?: string;

  /**
   * Token expiration date (seconds since epoch, 0 = never)
   * @default 0
   */
  expire?: number;

  /**
   * Enable privilege separation (token has own permissions via ACL)
   * If false, token inherits user's permissions
   * @default true
   */
  privsep?: boolean;

  /**
   * Whether to delete the token when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after API Token creation/update
 */
export interface APIToken {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * User ID the token belongs to
   */
  userid: string;

  /**
   * Token ID
   */
  tokenid: string;

  /**
   * Full token ID (userid!tokenid)
   */
  fullTokenId: string;

  /**
   * Token value/secret (only available on creation)
   */
  value: Secret;

  /**
   * Token comment/description
   */
  comment?: string;

  /**
   * Token expiration date (seconds since epoch)
   */
  expire: number;

  /**
   * Whether privilege separation is enabled
   */
  privsep: boolean;
}

/**
 * Type guard to check if a resource is an APIToken
 */
export function isAPIToken(resource: unknown): resource is APIToken {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::APIToken"
  );
}

/**
 * Creates and manages a Proxmox API Token for authentication.
 *
 * @example
 * ## Create a basic API token
 *
 * Create an API token for automation:
 *
 * ```ts
 * import { APIToken } from "alchemy/proxmox";
 *
 * const token = await APIToken("automation-token", {
 *   userid: "root@pam",
 *   tokenid: "automation",
 *   comment: "Token for CI/CD automation",
 * });
 *
 * console.log(`Token ID: ${token.fullTokenId}`);
 * // Use token.value for authentication
 * ```
 *
 * @example
 * ## Create a token with privilege separation
 *
 * Create a token with its own permissions:
 *
 * ```ts
 * import { APIToken, ACL } from "alchemy/proxmox";
 *
 * const token = await APIToken("limited-token", {
 *   userid: "admin@pve",
 *   tokenid: "readonly",
 *   privsep: true,
 *   comment: "Read-only token",
 * });
 *
 * // Grant permissions to the token
 * const acl = await ACL("token-access", {
 *   path: "/",
 *   roles: "PVEAuditor",
 *   users: token.fullTokenId,
 * });
 * ```
 *
 * @example
 * ## Create a token with expiration
 *
 * Create a temporary token:
 *
 * ```ts
 * import { APIToken } from "alchemy/proxmox";
 *
 * const token = await APIToken("temp-token", {
 *   userid: "root@pam",
 *   tokenid: "temp",
 *   expire: Math.floor(Date.now() / 1000) + 86400 * 7, // Expires in 7 days
 * });
 * ```
 */
export const APIToken = Resource(
  "proxmox::APIToken",
  async function (
    this: Context<APIToken>,
    id: string,
    props: APITokenProps,
  ): Promise<APIToken> {
    const client = await createProxmoxClient(props);
    const userid = props.userid;
    const tokenid = props.tokenid;
    const fullTokenId = `${userid}!${tokenid}`;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.tokenid) {
          try {
            await client.access.users
              .$(userid)
              .token.$(this.output.tokenid)
              .$delete();
          } catch (error: unknown) {
            // Ignore 404 errors (token already deleted)
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create": {
        // Build token configuration
        const createParams: Record<string, unknown> = {};

        if (props.comment) createParams.comment = props.comment;
        if (props.expire !== undefined) createParams.expire = props.expire;
        if (props.privsep !== undefined)
          createParams.privsep = props.privsep ? 1 : 0;

        // Create the token
        const result = await client.access.users
          .$(userid)
          .token.$(tokenid)
          .$post(
            createParams as Parameters<
              (typeof client.access.users.$get)[0]["token"]["$post"]
            >[0],
          );

        // The API returns the token value on creation
        const tokenValue =
          (result as Record<string, unknown>).value as string ?? "";

        return {
          id,
          userid,
          tokenid,
          fullTokenId,
          value: SecretClass.wrap(tokenValue),
          comment: props.comment,
          expire: props.expire ?? 0,
          privsep: props.privsep !== false,
        };
      }

      case "update": {
        // Build update configuration
        const updateParams: Record<string, unknown> = {};

        if (props.comment) updateParams.comment = props.comment;
        if (props.expire !== undefined) updateParams.expire = props.expire;
        if (props.privsep !== undefined)
          updateParams.privsep = props.privsep ? 1 : 0;

        // Update existing token
        await client.access.users
          .$(userid)
          .token.$(tokenid)
          .$put(
            updateParams as Parameters<
              (typeof client.access.users.$get)[0]["token"]["$put"]
            >[0],
          );

        // Token value is only available on creation
        return {
          id,
          userid,
          tokenid,
          fullTokenId,
          value: this.output?.value ?? SecretClass.wrap(""),
          comment: props.comment,
          expire: props.expire ?? 0,
          privsep: props.privsep !== false,
        };
      }
    }
  },
);

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
