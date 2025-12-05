import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { Secret } from "../secret.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for managing node subscription
 */
export interface NodeSubscriptionProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * Subscription key to set
   */
  key?: string | Secret;

  /**
   * Force refresh subscription status
   * @default false
   */
  force?: boolean;
}

/**
 * Output returned after NodeSubscription query/update
 */
export interface NodeSubscription {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Subscription status
   */
  status: string;

  /**
   * Subscription level
   */
  level?: string;

  /**
   * Subscription key (masked)
   */
  key?: string;

  /**
   * Server ID
   */
  serverid?: string;

  /**
   * Product name
   */
  productname?: string;

  /**
   * Registration date
   */
  regdate?: string;

  /**
   * Next due date
   */
  nextduedate?: string;

  /**
   * Subscription message
   */
  message?: string;
}

/**
 * Type guard to check if a resource is a NodeSubscription
 */
export function isNodeSubscription(
  resource: unknown,
): resource is NodeSubscription {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::NodeSubscription"
  );
}

/**
 * Manages Proxmox node subscription status.
 *
 * @example
 * ## Check subscription status
 *
 * Query current subscription:
 *
 * ```ts
 * import { NodeSubscription } from "alchemy/proxmox";
 *
 * const sub = await NodeSubscription("pve-sub", {
 *   node: "pve",
 * });
 * console.log(`Status: ${sub.status}`);
 * console.log(`Level: ${sub.level}`);
 * ```
 *
 * @example
 * ## Set subscription key
 *
 * Apply a subscription key:
 *
 * ```ts
 * import { NodeSubscription } from "alchemy/proxmox";
 *
 * const sub = await NodeSubscription("pve-sub", {
 *   node: "pve",
 *   key: alchemy.secret.env.PROXMOX_SUBSCRIPTION_KEY,
 * });
 * ```
 *
 * @example
 * ## Force refresh subscription
 *
 * Refresh subscription status from server:
 *
 * ```ts
 * import { NodeSubscription } from "alchemy/proxmox";
 *
 * const sub = await NodeSubscription("refresh-sub", {
 *   node: "pve",
 *   force: true,
 * });
 * ```
 */
export const NodeSubscription = Resource(
  "proxmox::NodeSubscription",
  async function (
    this: Context<NodeSubscription>,
    id: string,
    props: NodeSubscriptionProps,
  ): Promise<NodeSubscription> {
    const client = await createProxmoxClient(props);
    const { node } = props;

    // This is a query/config resource, delete just means stop managing
    if (this.phase === "delete") {
      return this.destroy();
    }

    // Set subscription key if provided
    if (props.key) {
      const keyValue =
        typeof props.key === "string" ? props.key : Secret.unwrap(props.key);

      await client.nodes
        .$(node)
        .subscription.$post({
          key: keyValue,
        } as Parameters<
          (typeof client.nodes.$get)[0]["subscription"]["$post"]
        >[0]);
    }

    // Force refresh if requested
    if (props.force) {
      await client.nodes
        .$(node)
        .subscription.$put({
          force: 1,
        } as Parameters<
          (typeof client.nodes.$get)[0]["subscription"]["$put"]
        >[0]);
    }

    // Get subscription status
    const subInfo = await client.nodes.$(node).subscription.$get();
    const subObj = subInfo as Record<string, unknown>;

    return {
      id,
      node,
      status: (subObj.status as string) ?? "unknown",
      level: subObj.level as string | undefined,
      key: subObj.key as string | undefined,
      serverid: subObj.serverid as string | undefined,
      productname: subObj.productname as string | undefined,
      regdate: subObj.regdate as string | undefined,
      nextduedate: subObj.nextduedate as string | undefined,
      message: subObj.message as string | undefined,
    };
  },
);
