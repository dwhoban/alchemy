import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating an Authentication Domain
 */
export interface AuthDomainProps extends ProxmoxApiOptions {
  /**
   * Realm name
   */
  realm: string;

  /**
   * Realm type (pam, pve, ldap, ad, openid)
   */
  type: "pam" | "pve" | "ldap" | "ad" | "openid";

  /**
   * Realm comment/description
   */
  comment?: string;

  /**
   * Default for new users
   * @default false
   */
  default?: boolean;

  // LDAP/AD specific options
  /**
   * LDAP/AD server address
   */
  server1?: string;

  /**
   * LDAP/AD backup server
   */
  server2?: string;

  /**
   * LDAP base domain name
   */
  base_dn?: string;

  /**
   * LDAP bind domain name
   */
  bind_dn?: string;

  /**
   * LDAP user attribute
   */
  user_attr?: string;

  /**
   * LDAP port
   */
  port?: number;

  /**
   * Enable SSL
   * @default false
   */
  secure?: boolean;

  /**
   * Verify SSL certificate
   * @default false
   */
  verify?: boolean;

  // OpenID specific options
  /**
   * OpenID issuer URL
   */
  issuer_url?: string;

  /**
   * OpenID client ID
   */
  client_id?: string;

  /**
   * OpenID client key
   */
  client_key?: string;

  /**
   * Auto-create users
   * @default false
   */
  autocreate?: boolean;

  /**
   * Username claim for OpenID
   */
  username_claim?: string;

  /**
   * Whether to delete the domain when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after AuthDomain creation/update
 */
export interface AuthDomain {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Realm name
   */
  realm: string;

  /**
   * Realm type
   */
  type: string;

  /**
   * Realm comment
   */
  comment?: string;

  /**
   * Is default realm
   */
  default: boolean;

  /**
   * Digest for concurrency control
   */
  digest?: string;
}

/**
 * Type guard to check if a resource is an AuthDomain
 */
export function isAuthDomain(resource: unknown): resource is AuthDomain {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::AuthDomain"
  );
}

/**
 * Creates and manages a Proxmox Authentication Domain.
 *
 * @example
 * ## Create an LDAP domain
 *
 * Create an LDAP authentication domain:
 *
 * ```ts
 * import { AuthDomain } from "alchemy/proxmox";
 *
 * const ldap = await AuthDomain("company-ldap", {
 *   realm: "company",
 *   type: "ldap",
 *   server1: "ldap.example.com",
 *   base_dn: "dc=example,dc=com",
 *   user_attr: "uid",
 *   secure: true,
 * });
 * ```
 *
 * @example
 * ## Create an Active Directory domain
 *
 * Create an AD authentication domain:
 *
 * ```ts
 * import { AuthDomain } from "alchemy/proxmox";
 *
 * const ad = await AuthDomain("company-ad", {
 *   realm: "ad",
 *   type: "ad",
 *   server1: "dc1.example.com",
 *   server2: "dc2.example.com",
 *   base_dn: "dc=example,dc=com",
 *   default: true,
 * });
 * ```
 *
 * @example
 * ## Create an OpenID domain
 *
 * Create an OpenID Connect authentication domain:
 *
 * ```ts
 * import { AuthDomain } from "alchemy/proxmox";
 *
 * const oidc = await AuthDomain("google", {
 *   realm: "google",
 *   type: "openid",
 *   issuer_url: "https://accounts.google.com",
 *   client_id: "your-client-id",
 *   client_key: alchemy.secret.env.GOOGLE_CLIENT_SECRET,
 *   username_claim: "email",
 *   autocreate: true,
 * });
 * ```
 */
export const AuthDomain = Resource(
  "proxmox::AuthDomain",
  async function (
    this: Context<AuthDomain>,
    id: string,
    props: AuthDomainProps,
  ): Promise<AuthDomain> {
    const client = await createProxmoxClient(props);
    const realm = props.realm;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.realm) {
          try {
            await client.access.domains.$(this.output.realm).$delete();
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
          realm,
          type: props.type,
        };

        if (props.comment) createParams.comment = props.comment;
        if (props.default) createParams.default = 1;

        // LDAP/AD options
        if (props.server1) createParams.server1 = props.server1;
        if (props.server2) createParams.server2 = props.server2;
        if (props.base_dn) createParams.base_dn = props.base_dn;
        if (props.bind_dn) createParams.bind_dn = props.bind_dn;
        if (props.user_attr) createParams.user_attr = props.user_attr;
        if (props.port) createParams.port = props.port;
        if (props.secure) createParams.secure = 1;
        if (props.verify) createParams.verify = 1;

        // OpenID options
        if (props.issuer_url) createParams["issuer-url"] = props.issuer_url;
        if (props.client_id) createParams["client-id"] = props.client_id;
        if (props.client_key) createParams["client-key"] = props.client_key;
        if (props.autocreate) createParams.autocreate = 1;
        if (props.username_claim)
          createParams["username-claim"] = props.username_claim;

        await client.access.domains.$post(
          createParams as Parameters<typeof client.access.domains.$post>[0],
        );

        return fetchDomainInfo(client, id, realm, props);
      }

      case "update": {
        const updateParams: Record<string, unknown> = {};

        if (props.comment) updateParams.comment = props.comment;
        if (props.default !== undefined)
          updateParams.default = props.default ? 1 : 0;

        // LDAP/AD options
        if (props.server1) updateParams.server1 = props.server1;
        if (props.server2) updateParams.server2 = props.server2;
        if (props.base_dn) updateParams.base_dn = props.base_dn;
        if (props.bind_dn) updateParams.bind_dn = props.bind_dn;
        if (props.user_attr) updateParams.user_attr = props.user_attr;
        if (props.port) updateParams.port = props.port;
        if (props.secure !== undefined) updateParams.secure = props.secure ? 1 : 0;

        // OpenID options
        if (props.issuer_url) updateParams["issuer-url"] = props.issuer_url;
        if (props.client_id) updateParams["client-id"] = props.client_id;
        if (props.client_key) updateParams["client-key"] = props.client_key;
        if (props.autocreate !== undefined)
          updateParams.autocreate = props.autocreate ? 1 : 0;
        if (props.username_claim)
          updateParams["username-claim"] = props.username_claim;

        await client.access.domains
          .$(realm)
          .$put(
            updateParams as Parameters<
              (typeof client.access.domains.$get)[0]["$put"]
            >[0],
          );

        return fetchDomainInfo(client, id, realm, props);
      }
    }
  },
);

/**
 * Fetch domain information from Proxmox
 * @internal
 */
async function fetchDomainInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  realm: string,
  props: AuthDomainProps,
): Promise<AuthDomain> {
  const domains = await client.access.domains.$get();
  const domainInfo = (domains as Array<Record<string, unknown>>).find(
    (d) => d.realm === realm,
  );

  return {
    id,
    realm,
    type: (domainInfo?.type as string) ?? props.type,
    comment: (domainInfo?.comment as string) ?? props.comment,
    default: Boolean(domainInfo?.default ?? props.default),
    digest: domainInfo?.digest as string | undefined,
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
