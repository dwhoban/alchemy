import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for ordering/renewing a Node Certificate
 */
export interface CertificateProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * Force renewal even if certificate is not due
   * @default false
   */
  force?: boolean;

  /**
   * Whether to delete/revoke the certificate when the resource is destroyed
   * @default false
   */
  delete?: boolean;
}

/**
 * Output returned after Certificate creation/renewal
 */
export interface Certificate {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Certificate filename
   */
  filename?: string;

  /**
   * Certificate fingerprint
   */
  fingerprint?: string;

  /**
   * Certificate issuer
   */
  issuer?: string;

  /**
   * Certificate subject
   */
  subject?: string;

  /**
   * Not valid before (timestamp)
   */
  notbefore?: number;

  /**
   * Not valid after (timestamp)
   */
  notafter?: number;

  /**
   * Public key type
   */
  public_key_type?: string;

  /**
   * Public key bits
   */
  public_key_bits?: number;
}

/**
 * Type guard to check if a resource is a Certificate
 */
export function isCertificate(resource: unknown): resource is Certificate {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::Certificate"
  );
}

/**
 * Manages Proxmox Node SSL Certificates via ACME.
 *
 * @example
 * ## Order a certificate
 *
 * Order a new ACME certificate for a node:
 *
 * ```ts
 * import { Certificate } from "alchemy/proxmox";
 *
 * const cert = await Certificate("node-cert", {
 *   node: "pve",
 * });
 * ```
 *
 * @example
 * ## Force certificate renewal
 *
 * Force renewal of an existing certificate:
 *
 * ```ts
 * import { Certificate } from "alchemy/proxmox";
 *
 * const cert = await Certificate("renew-cert", {
 *   node: "pve",
 *   force: true,
 * });
 * ```
 *
 * @see First configure an ACME account with ACMEAccount resource
 * @see Configure DNS plugins with ACMEPlugin resource
 */
export const Certificate = Resource(
  "proxmox::Certificate",
  async function (
    this: Context<Certificate>,
    id: string,
    props: CertificateProps,
  ): Promise<Certificate> {
    const client = await createProxmoxClient(props);
    const { node } = props;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false) {
          try {
            // Revoke the certificate
            await client.nodes.$(node).certificates.acme.certificate.$delete();
          } catch (error: unknown) {
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create":
      case "update": {
        // Order/renew the certificate
        const orderParams: Record<string, unknown> = {};
        if (props.force) orderParams.force = 1;

        await client.nodes
          .$(node)
          .certificates.acme.certificate.$post(
            orderParams as Parameters<
              (typeof client.nodes.$get)[0]["certificates"]["acme"]["certificate"]["$post"]
            >[0],
          );

        // Wait for certificate ordering
        await waitForTask(client, node);

        return fetchCertificateInfo(client, id, node);
      }
    }
  },
);

/**
 * Fetch certificate information from Proxmox
 * @internal
 */
async function fetchCertificateInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
): Promise<Certificate> {
  const certs = await client.nodes.$(node).certificates.info.$get();
  const certArray = certs as Array<Record<string, unknown>>;

  // Find the ACME certificate
  const certInfo = certArray.find(
    (c) => c.filename === "pveproxy-ssl.pem" || c.filename === "pve-ssl.pem",
  );

  return {
    id,
    node,
    filename: certInfo?.filename as string | undefined,
    fingerprint: certInfo?.fingerprint as string | undefined,
    issuer: certInfo?.issuer as string | undefined,
    subject: certInfo?.subject as string | undefined,
    notbefore: certInfo?.notbefore as number | undefined,
    notafter: certInfo?.notafter as number | undefined,
    public_key_type: certInfo?.["public-key-type"] as string | undefined,
    public_key_bits: certInfo?.["public-key-bits"] as number | undefined,
  };
}

/**
 * Wait for any running task to complete
 * @internal
 */
async function waitForTask(
  client: ProxmoxClient,
  node: string,
  timeoutMs = 300000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const tasks = await client.nodes.$(node).tasks.$get({ running: 1 });
      if (!tasks || (tasks as Array<unknown>).length === 0) {
        return;
      }
    } catch {
      // Tasks endpoint might fail, continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
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
