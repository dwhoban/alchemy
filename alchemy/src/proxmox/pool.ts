import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating a Proxmox Pool
 */
export interface PoolProps extends ProxmoxApiOptions {
  /**
   * Pool ID/name
   */
  poolid: string;

  /**
   * Pool comment/description
   */
  comment?: string;

  /**
   * Members to add to the pool (VMs, containers, or storage)
   * Format: 'vmid' for VMs/CTs or 'storage:storageid' for storage
   */
  members?: string[];

  /**
   * Whether to delete the pool when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Pool member type
 */
export interface PoolMember {
  /**
   * Member ID
   */
  id: string;

  /**
   * Member type (qemu, lxc, or storage)
   */
  type: "qemu" | "lxc" | "storage";

  /**
   * Node where the member is located (for VMs/CTs)
   */
  node?: string;

  /**
   * VM/CT ID (for VMs/CTs)
   */
  vmid?: number;

  /**
   * Storage name (for storage)
   */
  storage?: string;
}

/**
 * Output returned after Pool creation/update
 */
export interface Pool {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Pool ID/name
   */
  poolid: string;

  /**
   * Pool comment/description
   */
  comment?: string;

  /**
   * Pool members
   */
  members: PoolMember[];
}

/**
 * Type guard to check if a resource is a Pool
 */
export function isPool(resource: unknown): resource is Pool {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::Pool"
  );
}

/**
 * Creates and manages a Proxmox Resource Pool.
 *
 * @example
 * ## Create a basic pool
 *
 * Create a pool for organizing resources:
 *
 * ```ts
 * import { Pool } from "alchemy/proxmox";
 *
 * const pool = await Pool("production", {
 *   poolid: "production",
 *   comment: "Production environment resources",
 * });
 * ```
 *
 * @example
 * ## Create a pool with members
 *
 * Create a pool and add VMs:
 *
 * ```ts
 * import { Pool, VirtualMachine } from "alchemy/proxmox";
 *
 * const vm = await VirtualMachine("web", {
 *   node: "pve",
 *   name: "web-server",
 *   memory: 2048,
 * });
 *
 * const pool = await Pool("web-pool", {
 *   poolid: "web-pool",
 *   comment: "Web server pool",
 *   members: [String(vm.vmid)],
 * });
 * ```
 *
 * @example
 * ## Create a pool with storage
 *
 * Create a pool including storage:
 *
 * ```ts
 * import { Pool } from "alchemy/proxmox";
 *
 * const pool = await Pool("data-pool", {
 *   poolid: "data-pool",
 *   comment: "Data storage pool",
 *   members: ["storage:local-lvm", "storage:backup"],
 * });
 * ```
 */
export const Pool = Resource(
  "proxmox::Pool",
  async function (
    this: Context<Pool>,
    id: string,
    props: PoolProps,
  ): Promise<Pool> {
    const client = await createProxmoxClient(props);
    const poolid = props.poolid;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.poolid) {
          try {
            await client.pools.$(this.output.poolid).$delete();
          } catch (error: unknown) {
            // Ignore 404 errors (pool already deleted)
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create": {
        // Build pool configuration
        const createParams: Record<string, unknown> = {
          poolid,
        };

        if (props.comment) createParams.comment = props.comment;

        // Create the pool
        await client.pools.$post(
          createParams as Parameters<typeof client.pools.$post>[0],
        );

        // Add members if specified
        if (props.members && props.members.length > 0) {
          for (const member of props.members) {
            try {
              if (member.startsWith("storage:")) {
                // Add storage to pool
                const storage = member.replace("storage:", "");
                await client.pools
                  .$(poolid)
                  .$put({ storage } as Parameters<
                    (typeof client.pools.$get)[0]["$put"]
                  >[0]);
              } else {
                // Add VM/CT to pool
                await client.pools
                  .$(poolid)
                  .$put({ vms: member } as Parameters<
                    (typeof client.pools.$get)[0]["$put"]
                  >[0]);
              }
            } catch {
              // Member might not exist or already in pool
            }
          }
        }

        return fetchPoolInfo(client, id, poolid);
      }

      case "update": {
        // Update pool comment
        if (props.comment) {
          await client.pools
            .$(poolid)
            .$put({ comment: props.comment } as Parameters<
              (typeof client.pools.$get)[0]["$put"]
            >[0]);
        }

        // Update members if specified
        if (props.members) {
          for (const member of props.members) {
            try {
              if (member.startsWith("storage:")) {
                const storage = member.replace("storage:", "");
                await client.pools
                  .$(poolid)
                  .$put({ storage } as Parameters<
                    (typeof client.pools.$get)[0]["$put"]
                  >[0]);
              } else {
                await client.pools
                  .$(poolid)
                  .$put({ vms: member } as Parameters<
                    (typeof client.pools.$get)[0]["$put"]
                  >[0]);
              }
            } catch {
              // Member might not exist
            }
          }
        }

        return fetchPoolInfo(client, id, poolid);
      }
    }
  },
);

/**
 * Fetch pool information from Proxmox
 * @internal
 */
async function fetchPoolInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  poolid: string,
): Promise<Pool> {
  const poolInfo = await client.pools.$(poolid).$get();

  // Parse members from response
  const membersRaw = (poolInfo.members as Array<Record<string, unknown>>) ?? [];
  const members: PoolMember[] = membersRaw.map((m) => ({
    id: (m.id as string) ?? "",
    type: m.type as "qemu" | "lxc" | "storage",
    node: m.node as string | undefined,
    vmid: m.vmid as number | undefined,
    storage: m.storage as string | undefined,
  }));

  return {
    id,
    poolid,
    comment: poolInfo.comment as string | undefined,
    members,
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
