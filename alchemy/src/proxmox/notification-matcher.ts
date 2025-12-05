import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Notification match field
 */
export type NotificationMatchField =
  | "exact"
  | "regex";

/**
 * Notification severity
 */
export type NotificationSeverity =
  | "info"
  | "notice"
  | "warning"
  | "error";

/**
 * Properties for creating or updating a notification matcher
 */
export interface NotificationMatcherProps extends ProxmoxApiOptions {
  /**
   * Matcher name
   */
  name: string;

  /**
   * Comment/description
   */
  comment?: string;

  /**
   * Disable this matcher
   * @default false
   */
  disable?: boolean;

  /**
   * Invert the match
   * @default false
   */
  invert?: boolean;

  /**
   * Match severity level
   */
  matchSeverity?: NotificationSeverity[];

  /**
   * Match field type
   */
  matchField?: NotificationMatchField;

  /**
   * Match calendar (for backup notifications)
   */
  matchCalendar?: string;

  /**
   * Target endpoints (comma-separated)
   */
  target?: string;

  /**
   * Matcher mode
   */
  mode?: "all" | "any";

  /**
   * Whether to delete the matcher when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after NotificationMatcher creation/update
 */
export interface NotificationMatcher {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Matcher name
   */
  name: string;

  /**
   * Comment/description
   */
  comment?: string;

  /**
   * Whether disabled
   */
  disable?: boolean;

  /**
   * Target endpoints
   */
  target?: string;

  /**
   * Matcher mode
   */
  mode?: string;

  /**
   * Digest
   */
  digest?: string;
}

/**
 * Type guard to check if a resource is a NotificationMatcher
 */
export function isNotificationMatcher(
  resource: unknown,
): resource is NotificationMatcher {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::NotificationMatcher"
  );
}

/**
 * Creates and manages a Proxmox notification matcher.
 *
 * Matchers route notifications to endpoints based on criteria.
 *
 * @example
 * ## Create a basic matcher
 *
 * Route all notifications to an endpoint:
 *
 * ```ts
 * import { NotificationMatcher } from "alchemy/proxmox";
 *
 * const matcher = await NotificationMatcher("all-to-admin", {
 *   name: "all-to-admin",
 *   target: "admin-mail",
 *   comment: "Send all notifications to admin",
 * });
 * ```
 *
 * @example
 * ## Create a severity filter
 *
 * Only route errors and warnings:
 *
 * ```ts
 * import { NotificationMatcher } from "alchemy/proxmox";
 *
 * const matcher = await NotificationMatcher("errors-only", {
 *   name: "errors-only",
 *   target: "ops-alerts",
 *   matchSeverity: ["error", "warning"],
 *   mode: "any",
 *   comment: "Route errors and warnings to ops",
 * });
 * ```
 *
 * @example
 * ## Create an inverted matcher
 *
 * Route everything except info messages:
 *
 * ```ts
 * import { NotificationMatcher } from "alchemy/proxmox";
 *
 * const matcher = await NotificationMatcher("no-info", {
 *   name: "no-info",
 *   target: "important-alerts",
 *   matchSeverity: ["info"],
 *   invert: true,
 *   comment: "All non-info notifications",
 * });
 * ```
 */
export const NotificationMatcher = Resource(
  "proxmox::NotificationMatcher",
  async function (
    this: Context<NotificationMatcher>,
    id: string,
    props: NotificationMatcherProps,
  ): Promise<NotificationMatcher> {
    const client = await createProxmoxClient(props);
    const name = props.name;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.name) {
          try {
            await client.cluster.notifications.matchers
              .$(this.output.name)
              .$delete();
          } catch (error: unknown) {
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create": {
        const createParams = buildMatcherParams(props);

        await client.cluster.notifications.matchers.$post(
          createParams as Parameters<
            typeof client.cluster.notifications.matchers.$post
          >[0],
        );

        return fetchMatcherInfo(client, id, name);
      }

      case "update": {
        const updateParams = buildMatcherParams(props);
        delete (updateParams as Record<string, unknown>).name;

        await client.cluster.notifications.matchers
          .$(name)
          .$put(
            updateParams as Parameters<
              (typeof client.cluster.notifications.matchers.$get)[0]["$put"]
            >[0],
          );

        return fetchMatcherInfo(client, id, name);
      }
    }
  },
);

/**
 * Build matcher parameters
 * @internal
 */
function buildMatcherParams(
  props: NotificationMatcherProps,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    name: props.name,
  };

  if (props.comment) params.comment = props.comment;
  if (props.disable) params.disable = 1;
  if (props.invert) params["invert-match"] = 1;
  if (props.target) params.target = props.target;
  if (props.mode) params.mode = props.mode;
  if (props.matchSeverity)
    params["match-severity"] = props.matchSeverity.join(",");
  if (props.matchField) params["match-field"] = props.matchField;
  if (props.matchCalendar) params["match-calendar"] = props.matchCalendar;

  return params;
}

/**
 * Fetch matcher information from Proxmox
 * @internal
 */
async function fetchMatcherInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  name: string,
): Promise<NotificationMatcher> {
  const matcherInfo = await client.cluster.notifications.matchers.$(name).$get();
  const matcherObj = matcherInfo as Record<string, unknown>;

  return {
    id,
    name,
    comment: matcherObj.comment as string | undefined,
    disable: Boolean(matcherObj.disable),
    target: matcherObj.target as string | undefined,
    mode: matcherObj.mode as string | undefined,
    digest: matcherObj.digest as string | undefined,
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
