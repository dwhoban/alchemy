import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * IPAM type
 */
export type SDNIPAMType = "pve" | "phpipam" | "netbox";

/**
 * Properties for creating or updating an SDN IPAM
 */
export interface SDNIPAMProps extends ProxmoxApiOptions {
  /**
   * IPAM ID/name
   */
  ipam: string;

  /**
   * IPAM type
   */
  type: SDNIPAMType;

  /**
   * IPAM server URL (for phpipam, netbox)
   */
  url?: string;

  /**
   * IPAM token (for phpipam, netbox)
   */
  token?: string;

  /**
   * IPAM section (for phpipam)
   */
  section?: number;

  /**
   * Whether to delete the IPAM when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after SDNIPAM creation/update
 */
export interface SDNIPAM {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * IPAM ID/name
   */
  ipam: string;

  /**
   * IPAM type
   */
  type: SDNIPAMType;

  /**
   * IPAM server URL
   */
  url?: string;

  /**
   * IPAM section
   */
  section?: number;

  /**
   * Status
   */
  status?: string;
}

/**
 * Type guard to check if a resource is an SDNIPAM
 */
export function isSDNIPAM(resource: unknown): resource is SDNIPAM {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::SDNIPAM"
  );
}

/**
 * Creates and manages a Proxmox SDN IPAM (IP Address Management) configuration.
 *
 * @example
 * ## Create PVE IPAM
 *
 * Use built-in Proxmox IPAM:
 *
 * ```ts
 * import { SDNIPAM } from "alchemy/proxmox";
 *
 * const ipam = await SDNIPAM("pve-ipam", {
 *   ipam: "pve-ipam",
 *   type: "pve",
 * });
 * ```
 *
 * @example
 * ## Create phpIPAM integration
 *
 * Integrate with phpIPAM server:
 *
 * ```ts
 * import { SDNIPAM } from "alchemy/proxmox";
 *
 * const ipam = await SDNIPAM("phpipam", {
 *   ipam: "phpipam",
 *   type: "phpipam",
 *   url: "https://ipam.example.com/api/v1",
 *   token: alchemy.secret.env.PHPIPAM_TOKEN,
 *   section: 1,
 * });
 * ```
 *
 * @example
 * ## Create NetBox integration
 *
 * Integrate with NetBox IPAM:
 *
 * ```ts
 * import { SDNIPAM } from "alchemy/proxmox";
 *
 * const ipam = await SDNIPAM("netbox", {
 *   ipam: "netbox",
 *   type: "netbox",
 *   url: "https://netbox.example.com/api",
 *   token: alchemy.secret.env.NETBOX_TOKEN,
 * });
 * ```
 */
export const SDNIPAM = Resource(
  "proxmox::SDNIPAM",
  async function (
    this: Context<SDNIPAM>,
    id: string,
    props: SDNIPAMProps,
  ): Promise<SDNIPAM> {
    const client = await createProxmoxClient(props);
    const ipam = props.ipam;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.ipam) {
          try {
            await client.cluster.sdn.ipams.$(this.output.ipam).$delete();
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
          ipam,
          type: props.type,
        };

        if (props.url) createParams.url = props.url;
        if (props.token) createParams.token = props.token;
        if (props.section) createParams.section = props.section;

        await client.cluster.sdn.ipams.$post(
          createParams as Parameters<typeof client.cluster.sdn.ipams.$post>[0],
        );

        return fetchIPAMInfo(client, id, ipam);
      }

      case "update": {
        const updateParams: Record<string, unknown> = {};

        if (props.url) updateParams.url = props.url;
        if (props.token) updateParams.token = props.token;
        if (props.section) updateParams.section = props.section;

        if (Object.keys(updateParams).length > 0) {
          await client.cluster.sdn.ipams
            .$(ipam)
            .$put(
              updateParams as Parameters<
                (typeof client.cluster.sdn.ipams.$get)[0]["$put"]
              >[0],
            );
        }

        return fetchIPAMInfo(client, id, ipam);
      }
    }
  },
);

/**
 * Fetch IPAM information from Proxmox
 * @internal
 */
async function fetchIPAMInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  ipam: string,
): Promise<SDNIPAM> {
  const ipamInfo = await client.cluster.sdn.ipams.$(ipam).$get();
  const ipamObj = ipamInfo as Record<string, unknown>;

  return {
    id,
    ipam,
    type: (ipamObj.type as SDNIPAMType) ?? "pve",
    url: ipamObj.url as string | undefined,
    section: ipamObj.section as number | undefined,
    status: ipamObj.status as string | undefined,
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
