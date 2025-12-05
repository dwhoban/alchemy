import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * HA resource state
 */
export type HAResourceState = "started" | "stopped" | "enabled" | "disabled" | "ignored";

/**
 * Properties for creating or updating an HA Resource
 */
export interface HAResourceProps extends ProxmoxApiOptions {
  /**
   * HA resource ID (format: '<type>:<vmid>', e.g., 'vm:100' or 'ct:200')
   */
  sid: string;

  /**
   * Requested resource state
   * @default "started"
   */
  state?: HAResourceState;

  /**
   * HA group to assign the resource to
   */
  group?: string;

  /**
   * Maximum restart attempts when resource fails
   * @default 1
   */
  maxRestart?: number;

  /**
   * Maximum relocate attempts when node fails
   * @default 1
   */
  maxRelocate?: number;

  /**
   * Resource comment/description
   */
  comment?: string;

  /**
   * Whether to delete the HA resource when the resource is destroyed
   * Note: This only removes HA management, not the VM/CT itself
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after HAResource creation/update
 */
export interface HAResource {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * HA resource ID
   */
  sid: string;

  /**
   * Resource type (vm or ct)
   */
  type: "vm" | "ct";

  /**
   * VM/CT ID
   */
  vmid: number;

  /**
   * Current resource state
   */
  state: string;

  /**
   * Assigned HA group
   */
  group?: string;

  /**
   * Maximum restart attempts
   */
  maxRestart: number;

  /**
   * Maximum relocate attempts
   */
  maxRelocate: number;

  /**
   * Resource comment/description
   */
  comment?: string;

  /**
   * Current digest (for concurrency control)
   */
  digest?: string;
}

/**
 * Type guard to check if a resource is an HAResource
 */
export function isHAResource(resource: unknown): resource is HAResource {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::HAResource"
  );
}

/**
 * Creates and manages a Proxmox HA (High Availability) Resource.
 *
 * @example
 * ## Add a VM to HA management
 *
 * Make a VM highly available:
 *
 * ```ts
 * import { HAResource } from "alchemy/proxmox";
 *
 * const haResource = await HAResource("web-ha", {
 *   sid: "vm:100",
 *   state: "started",
 *   maxRestart: 3,
 *   maxRelocate: 2,
 *   comment: "Critical web server",
 * });
 * ```
 *
 * @example
 * ## Add a container to HA with group
 *
 * Add a container to an HA group:
 *
 * ```ts
 * import { HAResource, HAGroup } from "alchemy/proxmox";
 *
 * const group = await HAGroup("production", {
 *   group: "production",
 *   nodes: "pve1:100,pve2:50",
 * });
 *
 * const haResource = await HAResource("app-ha", {
 *   sid: "ct:200",
 *   state: "started",
 *   group: group.group,
 * });
 * ```
 *
 * @example
 * ## Disable HA for maintenance
 *
 * Temporarily disable HA for a resource:
 *
 * ```ts
 * import { HAResource } from "alchemy/proxmox";
 *
 * const haResource = await HAResource("db-ha", {
 *   sid: "vm:101",
 *   state: "disabled",
 *   comment: "Disabled for maintenance",
 * });
 * ```
 */
export const HAResource = Resource(
  "proxmox::HAResource",
  async function (
    this: Context<HAResource>,
    id: string,
    props: HAResourceProps,
  ): Promise<HAResource> {
    const client = await createProxmoxClient(props);
    const sid = props.sid;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.sid) {
          try {
            await client.cluster.ha.resources.$(this.output.sid).$delete();
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
          sid,
        };

        if (props.state) createParams.state = props.state;
        if (props.group) createParams.group = props.group;
        if (props.maxRestart !== undefined)
          createParams.max_restart = props.maxRestart;
        if (props.maxRelocate !== undefined)
          createParams.max_relocate = props.maxRelocate;
        if (props.comment) createParams.comment = props.comment;

        await client.cluster.ha.resources.$post(
          createParams as Parameters<
            typeof client.cluster.ha.resources.$post
          >[0],
        );

        return fetchHAResourceInfo(client, id, sid);
      }

      case "update": {
        const updateParams: Record<string, unknown> = {};

        if (props.state) updateParams.state = props.state;
        if (props.group) updateParams.group = props.group;
        if (props.maxRestart !== undefined)
          updateParams.max_restart = props.maxRestart;
        if (props.maxRelocate !== undefined)
          updateParams.max_relocate = props.maxRelocate;
        if (props.comment) updateParams.comment = props.comment;

        await client.cluster.ha.resources
          .$(sid)
          .$put(
            updateParams as Parameters<
              (typeof client.cluster.ha.resources.$get)[0]["$put"]
            >[0],
          );

        return fetchHAResourceInfo(client, id, sid);
      }
    }
  },
);

/**
 * Fetch HA resource information from Proxmox
 * @internal
 */
async function fetchHAResourceInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  sid: string,
): Promise<HAResource> {
  const resourceInfo = await client.cluster.ha.resources.$(sid).$get();

  // Parse sid to get type and vmid
  const [typeStr, vmidStr] = sid.split(":");
  const type = (typeStr === "ct" ? "ct" : "vm") as "vm" | "ct";
  const vmid = Number.parseInt(vmidStr, 10);

  return {
    id,
    sid,
    type,
    vmid,
    state: (resourceInfo.state as string) ?? "started",
    group: resourceInfo.group as string | undefined,
    maxRestart: (resourceInfo.max_restart as number) ?? 1,
    maxRelocate: (resourceInfo.max_relocate as number) ?? 1,
    comment: resourceInfo.comment as string | undefined,
    digest: resourceInfo.digest as string | undefined,
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
