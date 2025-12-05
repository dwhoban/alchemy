import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * SDN DNS type
 */
export type SDNDNSType = "powerdns";

/**
 * Properties for creating or updating an SDN DNS
 */
export interface SDNDNSProps extends ProxmoxApiOptions {
  /**
   * DNS plugin ID/name
   */
  dns: string;

  /**
   * DNS type
   */
  type: SDNDNSType;

  /**
   * DNS server URL
   */
  url: string;

  /**
   * DNS API key/token
   */
  key?: string;

  /**
   * TTL for DNS records
   * @default 3600
   */
  ttl?: number;

  /**
   * Reverse DNS server (if different)
   */
  reversemaskv6?: number;

  /**
   * Whether to delete the DNS config when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after SDNDNS creation/update
 */
export interface SDNDNS {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * DNS plugin ID/name
   */
  dns: string;

  /**
   * DNS type
   */
  type: SDNDNSType;

  /**
   * DNS server URL
   */
  url: string;

  /**
   * TTL for DNS records
   */
  ttl?: number;
}

/**
 * Type guard to check if a resource is an SDNDNS
 */
export function isSDNDNS(resource: unknown): resource is SDNDNS {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::SDNDNS"
  );
}

/**
 * Creates and manages a Proxmox SDN DNS configuration.
 *
 * @example
 * ## Create PowerDNS integration
 *
 * Integrate with PowerDNS server:
 *
 * ```ts
 * import { SDNDNS } from "alchemy/proxmox";
 *
 * const dns = await SDNDNS("powerdns", {
 *   dns: "powerdns",
 *   type: "powerdns",
 *   url: "http://powerdns.example.com:8081/api/v1/servers/localhost",
 *   key: alchemy.secret.env.POWERDNS_API_KEY,
 *   ttl: 3600,
 * });
 * ```
 *
 * @example
 * ## Create DNS with custom TTL
 *
 * Configure DNS with shorter TTL:
 *
 * ```ts
 * import { SDNDNS } from "alchemy/proxmox";
 *
 * const dns = await SDNDNS("fast-dns", {
 *   dns: "fast-dns",
 *   type: "powerdns",
 *   url: "http://dns.local:8081/api/v1/servers/localhost",
 *   key: alchemy.secret.env.DNS_KEY,
 *   ttl: 60,
 * });
 * ```
 */
export const SDNDNS = Resource(
  "proxmox::SDNDNS",
  async function (
    this: Context<SDNDNS>,
    id: string,
    props: SDNDNSProps,
  ): Promise<SDNDNS> {
    const client = await createProxmoxClient(props);
    const dns = props.dns;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.dns) {
          try {
            await client.cluster.sdn.dns.$(this.output.dns).$delete();
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
          dns,
          type: props.type,
          url: props.url,
        };

        if (props.key) createParams.key = props.key;
        if (props.ttl) createParams.ttl = props.ttl;
        if (props.reversemaskv6) createParams.reversemaskv6 = props.reversemaskv6;

        await client.cluster.sdn.dns.$post(
          createParams as Parameters<typeof client.cluster.sdn.dns.$post>[0],
        );

        return fetchDNSInfo(client, id, dns, props.url);
      }

      case "update": {
        const updateParams: Record<string, unknown> = {};

        if (props.url) updateParams.url = props.url;
        if (props.key) updateParams.key = props.key;
        if (props.ttl) updateParams.ttl = props.ttl;
        if (props.reversemaskv6) updateParams.reversemaskv6 = props.reversemaskv6;

        if (Object.keys(updateParams).length > 0) {
          await client.cluster.sdn.dns
            .$(dns)
            .$put(
              updateParams as Parameters<
                (typeof client.cluster.sdn.dns.$get)[0]["$put"]
              >[0],
            );
        }

        return fetchDNSInfo(client, id, dns, props.url);
      }
    }
  },
);

/**
 * Fetch DNS information from Proxmox
 * @internal
 */
async function fetchDNSInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  dns: string,
  defaultUrl: string,
): Promise<SDNDNS> {
  const dnsInfo = await client.cluster.sdn.dns.$(dns).$get();
  const dnsObj = dnsInfo as Record<string, unknown>;

  return {
    id,
    dns,
    type: (dnsObj.type as SDNDNSType) ?? "powerdns",
    url: (dnsObj.url as string) ?? defaultUrl,
    ttl: dnsObj.ttl as number | undefined,
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
