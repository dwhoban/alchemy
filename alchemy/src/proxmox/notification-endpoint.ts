import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Notification endpoint type
 */
export type NotificationEndpointType =
  | "sendmail"
  | "smtp"
  | "gotify";

/**
 * Properties for creating or updating a notification endpoint
 */
export interface NotificationEndpointProps extends ProxmoxApiOptions {
  /**
   * Endpoint name
   */
  name: string;

  /**
   * Endpoint type
   */
  type: NotificationEndpointType;

  /**
   * Comment/description
   */
  comment?: string;

  /**
   * Disable this endpoint
   * @default false
   */
  disable?: boolean;

  // Sendmail options
  /**
   * Recipient email addresses (for sendmail/smtp)
   */
  mailto?: string[];

  /**
   * Recipient users (for sendmail/smtp)
   */
  mailtoUser?: string[];

  /**
   * Sender email address
   */
  fromAddress?: string;

  /**
   * Author name
   */
  author?: string;

  // SMTP options
  /**
   * SMTP server hostname
   */
  server?: string;

  /**
   * SMTP server port
   * @default 25
   */
  port?: number;

  /**
   * SMTP mode
   */
  mode?: "insecure" | "starttls" | "tls";

  /**
   * SMTP username
   */
  username?: string;

  /**
   * SMTP password
   */
  password?: string;

  // Gotify options
  /**
   * Gotify server URL
   */
  gotifyServer?: string;

  /**
   * Gotify token
   */
  gotifyToken?: string;

  /**
   * Whether to delete the endpoint when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after NotificationEndpoint creation/update
 */
export interface NotificationEndpoint {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Endpoint name
   */
  name: string;

  /**
   * Endpoint type
   */
  type: NotificationEndpointType;

  /**
   * Comment/description
   */
  comment?: string;

  /**
   * Whether disabled
   */
  disable?: boolean;

  /**
   * Digest
   */
  digest?: string;
}

/**
 * Type guard to check if a resource is a NotificationEndpoint
 */
export function isNotificationEndpoint(
  resource: unknown,
): resource is NotificationEndpoint {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::NotificationEndpoint"
  );
}

/**
 * Creates and manages a Proxmox notification endpoint.
 *
 * @example
 * ## Create sendmail endpoint
 *
 * Create a simple sendmail notification:
 *
 * ```ts
 * import { NotificationEndpoint } from "alchemy/proxmox";
 *
 * const endpoint = await NotificationEndpoint("admin-mail", {
 *   name: "admin-mail",
 *   type: "sendmail",
 *   mailto: ["admin@example.com"],
 *   comment: "Admin notifications",
 * });
 * ```
 *
 * @example
 * ## Create SMTP endpoint
 *
 * Create an SMTP notification endpoint:
 *
 * ```ts
 * import { NotificationEndpoint } from "alchemy/proxmox";
 *
 * const endpoint = await NotificationEndpoint("smtp-alerts", {
 *   name: "smtp-alerts",
 *   type: "smtp",
 *   server: "smtp.example.com",
 *   port: 587,
 *   mode: "starttls",
 *   username: "notifications@example.com",
 *   password: alchemy.secret.env.SMTP_PASSWORD,
 *   mailto: ["team@example.com"],
 *   fromAddress: "proxmox@example.com",
 * });
 * ```
 *
 * @example
 * ## Create Gotify endpoint
 *
 * Create a Gotify push notification endpoint:
 *
 * ```ts
 * import { NotificationEndpoint } from "alchemy/proxmox";
 *
 * const endpoint = await NotificationEndpoint("gotify-push", {
 *   name: "gotify-push",
 *   type: "gotify",
 *   gotifyServer: "https://gotify.example.com",
 *   gotifyToken: alchemy.secret.env.GOTIFY_TOKEN,
 * });
 * ```
 */
export const NotificationEndpoint = Resource(
  "proxmox::NotificationEndpoint",
  async function (
    this: Context<NotificationEndpoint>,
    id: string,
    props: NotificationEndpointProps,
  ): Promise<NotificationEndpoint> {
    const client = await createProxmoxClient(props);
    const name = props.name;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.name) {
          try {
            await client.cluster.notifications.endpoints[
              props.type === "smtp" ? "smtp" : props.type === "gotify" ? "gotify" : "sendmail"
            ].$(this.output.name).$delete();
          } catch (error: unknown) {
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create": {
        const createParams = buildEndpointParams(props);

        if (props.type === "sendmail") {
          await client.cluster.notifications.endpoints.sendmail.$post(
            createParams as Parameters<
              typeof client.cluster.notifications.endpoints.sendmail.$post
            >[0],
          );
        } else if (props.type === "smtp") {
          await client.cluster.notifications.endpoints.smtp.$post(
            createParams as Parameters<
              typeof client.cluster.notifications.endpoints.smtp.$post
            >[0],
          );
        } else if (props.type === "gotify") {
          await client.cluster.notifications.endpoints.gotify.$post(
            createParams as Parameters<
              typeof client.cluster.notifications.endpoints.gotify.$post
            >[0],
          );
        }

        return fetchEndpointInfo(client, id, name, props.type);
      }

      case "update": {
        const updateParams = buildEndpointParams(props);
        delete (updateParams as Record<string, unknown>).name;

        if (props.type === "sendmail") {
          await client.cluster.notifications.endpoints.sendmail
            .$(name)
            .$put(
              updateParams as Parameters<
                (typeof client.cluster.notifications.endpoints.sendmail.$get)[0]["$put"]
              >[0],
            );
        } else if (props.type === "smtp") {
          await client.cluster.notifications.endpoints.smtp
            .$(name)
            .$put(
              updateParams as Parameters<
                (typeof client.cluster.notifications.endpoints.smtp.$get)[0]["$put"]
              >[0],
            );
        } else if (props.type === "gotify") {
          await client.cluster.notifications.endpoints.gotify
            .$(name)
            .$put(
              updateParams as Parameters<
                (typeof client.cluster.notifications.endpoints.gotify.$get)[0]["$put"]
              >[0],
            );
        }

        return fetchEndpointInfo(client, id, name, props.type);
      }
    }
  },
);

/**
 * Build endpoint parameters
 * @internal
 */
function buildEndpointParams(
  props: NotificationEndpointProps,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    name: props.name,
  };

  if (props.comment) params.comment = props.comment;
  if (props.disable) params.disable = 1;

  // Sendmail/SMTP options
  if (props.mailto) params.mailto = props.mailto.join(",");
  if (props.mailtoUser) params["mailto-user"] = props.mailtoUser.join(",");
  if (props.fromAddress) params["from-address"] = props.fromAddress;
  if (props.author) params.author = props.author;

  // SMTP options
  if (props.server) params.server = props.server;
  if (props.port) params.port = props.port;
  if (props.mode) params.mode = props.mode;
  if (props.username) params.username = props.username;
  if (props.password) params.password = props.password;

  // Gotify options
  if (props.gotifyServer) params.server = props.gotifyServer;
  if (props.gotifyToken) params.token = props.gotifyToken;

  return params;
}

/**
 * Fetch endpoint information from Proxmox
 * @internal
 */
async function fetchEndpointInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  name: string,
  type: NotificationEndpointType,
): Promise<NotificationEndpoint> {
  let endpointInfo: Record<string, unknown> = {};

  try {
    if (type === "sendmail") {
      endpointInfo = (await client.cluster.notifications.endpoints.sendmail
        .$(name)
        .$get()) as Record<string, unknown>;
    } else if (type === "smtp") {
      endpointInfo = (await client.cluster.notifications.endpoints.smtp
        .$(name)
        .$get()) as Record<string, unknown>;
    } else if (type === "gotify") {
      endpointInfo = (await client.cluster.notifications.endpoints.gotify
        .$(name)
        .$get()) as Record<string, unknown>;
    }
  } catch {
    // Endpoint might not be queryable
  }

  return {
    id,
    name,
    type,
    comment: endpointInfo.comment as string | undefined,
    disable: Boolean(endpointInfo.disable),
    digest: endpointInfo.digest as string | undefined,
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
