import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating a Firewall IPSet
 */
export interface FirewallIPSetProps extends ProxmoxApiOptions {
  /**
   * IPSet name
   */
  name: string;

  /**
   * IPSet comment/description
   */
  comment?: string;

  /**
   * Whether to delete the IPSet when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after FirewallIPSet creation/update
 */
export interface FirewallIPSet {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * IPSet name
   */
  name: string;

  /**
   * IPSet comment/description
   */
  comment?: string;

  /**
   * Digest for concurrency control
   */
  digest?: string;
}

/**
 * Type guard to check if a resource is a FirewallIPSet
 */
export function isFirewallIPSet(resource: unknown): resource is FirewallIPSet {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::FirewallIPSet"
  );
}

/**
 * Creates and manages a Proxmox Firewall IPSet.
 *
 * @example
 * ## Create an IPSet
 *
 * Create an IPSet for grouping IPs:
 *
 * ```ts
 * import { FirewallIPSet } from "alchemy/proxmox";
 *
 * const ipset = await FirewallIPSet("trusted-hosts", {
 *   name: "trusted_hosts",
 *   comment: "Trusted hosts for SSH access",
 * });
 * ```
 *
 * @example
 * ## Create a blacklist IPSet
 *
 * Create an IPSet for blocking:
 *
 * ```ts
 * import { FirewallIPSet } from "alchemy/proxmox";
 *
 * const ipset = await FirewallIPSet("blacklist", {
 *   name: "blacklist",
 *   comment: "Blocked IP addresses",
 * });
 * ```
 */
export const FirewallIPSet = Resource(
  "proxmox::FirewallIPSet",
  async function (
    this: Context<FirewallIPSet>,
    id: string,
    props: FirewallIPSetProps,
  ): Promise<FirewallIPSet> {
    const client = await createProxmoxClient(props);
    const name = props.name;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.name) {
          try {
            await client.cluster.firewall.ipset.$(this.output.name).$delete();
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
        };

        if (props.comment) createParams.comment = props.comment;

        await client.cluster.firewall.ipset.$post(
          createParams as Parameters<
            typeof client.cluster.firewall.ipset.$post
          >[0],
        );

        return fetchIPSetInfo(client, id, name, props);
      }

      case "update": {
        // IPSets themselves can't be updated, only their entries
        return fetchIPSetInfo(client, id, name, props);
      }
    }
  },
);

/**
 * Fetch IPSet information from Proxmox
 * @internal
 */
async function fetchIPSetInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  name: string,
  props: FirewallIPSetProps,
): Promise<FirewallIPSet> {
  const ipsets = await client.cluster.firewall.ipset.$get();
  const ipsetInfo = (ipsets as Array<Record<string, unknown>>).find(
    (s) => s.name === name,
  );

  return {
    id,
    name,
    comment: (ipsetInfo?.comment as string) ?? props.comment,
    digest: ipsetInfo?.digest as string | undefined,
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
