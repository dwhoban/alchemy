import type { Client as OnePasswordClient } from "@1password/sdk";
import type { Secret } from "../secret.ts";

/**
 * Options for 1Password API requests
 */
export interface OnePasswordApiOptions {
  /**
   * Service Account Token for authentication
   * (overrides OP_SERVICE_ACCOUNT_TOKEN env var)
   */
  serviceAccountToken?: Secret;

  /**
   * Integration name to identify your application
   * @default "Alchemy Integration"
   */
  integrationName?: string;

  /**
   * Integration version to identify your application version
   * @default "v1.0.0"
   */
  integrationVersion?: string;
}

/**
 * Creates a 1Password SDK client instance
 *
 * @param options API options
 * @returns 1Password SDK client instance
 */
export async function createOnePasswordClient(
  options: Partial<OnePasswordApiOptions> = {},
): Promise<OnePasswordClient> {
  const sdk = await import("@1password/sdk");

  const token =
    options.serviceAccountToken?.unencrypted ??
    process.env.OP_SERVICE_ACCOUNT_TOKEN;
  if (!token) {
    throw new Error(
      "1Password Service Account Token is required. Set OP_SERVICE_ACCOUNT_TOKEN environment variable or provide serviceAccountToken option.",
    );
  }

  const client = await sdk.createClient({
    auth: token,
    integrationName: options.integrationName ?? "Alchemy Integration",
    integrationVersion: options.integrationVersion ?? "v1.0.0",
  });

  return client;
}
