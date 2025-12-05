import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating an ACME Account
 */
export interface ACMEAccountProps extends ProxmoxApiOptions {
  /**
   * ACME account name
   */
  name: string;

  /**
   * Contact email for the account
   */
  contact: string;

  /**
   * ACME directory URL
   * @default "https://acme-v02.api.letsencrypt.org/directory"
   */
  directory?: string;

  /**
   * Accept Terms of Service
   * @default true
   */
  tosAccepted?: boolean;

  /**
   * Whether to delete the account when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after ACMEAccount creation/update
 */
export interface ACMEAccount {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * ACME account name
   */
  name: string;

  /**
   * Contact email
   */
  contact: string;

  /**
   * ACME directory URL
   */
  directory: string;

  /**
   * Account status
   */
  status?: string;

  /**
   * Account location URL
   */
  location?: string;

  /**
   * Terms of Service URL
   */
  tos?: string;
}

/**
 * Type guard to check if a resource is an ACMEAccount
 */
export function isACMEAccount(resource: unknown): resource is ACMEAccount {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::ACMEAccount"
  );
}

/**
 * Creates and manages a Proxmox ACME Account for Let's Encrypt certificates.
 *
 * @example
 * ## Create an ACME account
 *
 * Register with Let's Encrypt:
 *
 * ```ts
 * import { ACMEAccount } from "alchemy/proxmox";
 *
 * const account = await ACMEAccount("letsencrypt", {
 *   name: "default",
 *   contact: "admin@example.com",
 * });
 * ```
 *
 * @example
 * ## Use staging environment
 *
 * Use Let's Encrypt staging for testing:
 *
 * ```ts
 * import { ACMEAccount } from "alchemy/proxmox";
 *
 * const account = await ACMEAccount("staging", {
 *   name: "staging",
 *   contact: "admin@example.com",
 *   directory: "https://acme-staging-v02.api.letsencrypt.org/directory",
 * });
 * ```
 */
export const ACMEAccount = Resource(
  "proxmox::ACMEAccount",
  async function (
    this: Context<ACMEAccount>,
    id: string,
    props: ACMEAccountProps,
  ): Promise<ACMEAccount> {
    const client = await createProxmoxClient(props);
    const name = props.name;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.name) {
          try {
            await client.cluster.acme.account.$(this.output.name).$delete();
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
          contact: props.contact,
        };

        if (props.directory) createParams.directory = props.directory;
        if (props.tosAccepted !== false) createParams.tos_url = "1";

        await client.cluster.acme.account.$post(
          createParams as Parameters<
            typeof client.cluster.acme.account.$post
          >[0],
        );

        return fetchACMEAccountInfo(client, id, name, props);
      }

      case "update": {
        const updateParams: Record<string, unknown> = {};

        if (props.contact) updateParams.contact = props.contact;

        await client.cluster.acme.account
          .$(name)
          .$put(
            updateParams as Parameters<
              (typeof client.cluster.acme.account.$get)[0]["$put"]
            >[0],
          );

        return fetchACMEAccountInfo(client, id, name, props);
      }
    }
  },
);

/**
 * Fetch ACME account information from Proxmox
 * @internal
 */
async function fetchACMEAccountInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  name: string,
  props: ACMEAccountProps,
): Promise<ACMEAccount> {
  const accountInfo = await client.cluster.acme.account.$(name).$get();

  return {
    id,
    name,
    contact: (accountInfo.account as Record<string, unknown>)?.contact as string ?? props.contact,
    directory:
      (accountInfo.directory as string) ??
      props.directory ??
      "https://acme-v02.api.letsencrypt.org/directory",
    status: (accountInfo.account as Record<string, unknown>)?.status as string | undefined,
    location: accountInfo.location as string | undefined,
    tos: accountInfo.tos as string | undefined,
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
