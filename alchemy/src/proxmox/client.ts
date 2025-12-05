import type { Secret } from "../secret.ts";
import { Secret as SecretClass } from "../secret.ts";

/**
 * Options for Proxmox API connection
 */
export interface ProxmoxApiOptions {
  /**
   * Proxmox server hostname or IP address
   * @default process.env.PROXMOX_HOST
   */
  host?: string;

  /**
   * Proxmox server port
   * @default 8006
   */
  port?: number;

  /**
   * Username for authentication (e.g., 'root@pam')
   * Required if not using token authentication
   * @default process.env.PROXMOX_USERNAME
   */
  username?: string;

  /**
   * Password for authentication
   * Required if using username authentication
   * @default process.env.PROXMOX_PASSWORD
   */
  password?: string | Secret;

  /**
   * API token ID (e.g., 'root@pam!mytoken')
   * Required if not using username/password authentication
   * @default process.env.PROXMOX_TOKEN_ID
   */
  tokenID?: string;

  /**
   * API token secret
   * Required if using token authentication
   * @default process.env.PROXMOX_TOKEN_SECRET
   */
  tokenSecret?: string | Secret;

  /**
   * Authentication timeout in milliseconds
   * @default 5000
   */
  authTimeout?: number;

  /**
   * Query timeout in milliseconds
   * @default 60000
   */
  queryTimeout?: number;

  /**
   * Whether to reject unauthorized SSL certificates
   * Set to false for self-signed certificates
   * @default true
   */
  rejectUnauthorized?: boolean;
}

/**
 * Proxmox API client type from proxmox-api package
 * @internal
 */
export type ProxmoxClient = Awaited<ReturnType<typeof import("proxmox-api").default>>;

/**
 * Create a Proxmox API client
 * @param options Connection options
 * @returns Proxmox API client
 */
export async function createProxmoxClient(
  options: ProxmoxApiOptions = {},
): Promise<ProxmoxClient> {
  const proxmoxApi = (await import("proxmox-api")).default;

  const host = options.host ?? process.env.PROXMOX_HOST;
  if (!host) {
    throw new Error(
      "Proxmox host is required. Set PROXMOX_HOST environment variable or provide host option.",
    );
  }

  const port = options.port ?? 8006;

  // Handle SSL certificate verification
  if (options.rejectUnauthorized === false) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  // Check for token-based authentication
  const tokenID = options.tokenID ?? process.env.PROXMOX_TOKEN_ID;
  const tokenSecret = options.tokenSecret
    ? SecretClass.unwrap(options.tokenSecret)
    : process.env.PROXMOX_TOKEN_SECRET;

  if (tokenID && tokenSecret) {
    return proxmoxApi({
      host: `${host}:${port}`,
      tokenID,
      tokenSecret,
      authTimeout: options.authTimeout,
      queryTimeout: options.queryTimeout,
    });
  }

  // Fall back to username/password authentication
  const username = options.username ?? process.env.PROXMOX_USERNAME;
  const password = options.password
    ? SecretClass.unwrap(options.password)
    : process.env.PROXMOX_PASSWORD;

  if (!username) {
    throw new Error(
      "Proxmox username is required. Set PROXMOX_USERNAME environment variable or provide username option.",
    );
  }

  if (!password) {
    throw new Error(
      "Proxmox password is required. Set PROXMOX_PASSWORD environment variable or provide password option.",
    );
  }

  return proxmoxApi({
    host: `${host}:${port}`,
    username,
    password,
    authTimeout: options.authTimeout,
    queryTimeout: options.queryTimeout,
  });
}
