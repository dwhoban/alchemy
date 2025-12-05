import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for uploading/managing Storage Content
 */
export interface StorageContentProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * Storage name
   */
  storage: string;

  /**
   * Content type (iso, vztmpl, backup, images, rootdir, snippets)
   */
  content: "iso" | "vztmpl" | "backup" | "images" | "rootdir" | "snippets";

  /**
   * Filename for the content
   */
  filename: string;

  /**
   * URL to download content from (for download operation)
   */
  url?: string;

  /**
   * Checksum for verification (optional)
   */
  checksum?: string;

  /**
   * Checksum algorithm (md5, sha1, sha224, sha256, sha384, sha512)
   */
  checksumAlgorithm?: "md5" | "sha1" | "sha224" | "sha256" | "sha384" | "sha512";

  /**
   * Whether to verify SSL certificates when downloading
   * @default true
   */
  verifyCertificates?: boolean;

  /**
   * Whether to delete the content when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after StorageContent creation
 */
export interface StorageContent {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Storage name
   */
  storage: string;

  /**
   * Content type
   */
  content: string;

  /**
   * Filename
   */
  filename: string;

  /**
   * Volume ID (storage:filename)
   */
  volid: string;

  /**
   * Content size in bytes
   */
  size?: number;

  /**
   * Creation timestamp
   */
  ctime?: number;

  /**
   * Format (e.g., iso, raw, qcow2)
   */
  format?: string;
}

/**
 * Type guard to check if a resource is StorageContent
 */
export function isStorageContent(
  resource: unknown,
): resource is StorageContent {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::StorageContent"
  );
}

/**
 * Manages Proxmox Storage Content (ISOs, templates, backups).
 *
 * @example
 * ## Download an ISO
 *
 * Download an ISO image from URL:
 *
 * ```ts
 * import { StorageContent } from "alchemy/proxmox";
 *
 * const iso = await StorageContent("debian-iso", {
 *   node: "pve",
 *   storage: "local",
 *   content: "iso",
 *   filename: "debian-12.0.0-amd64-netinst.iso",
 *   url: "https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/debian-12.0.0-amd64-netinst.iso",
 *   checksum: "...",
 *   checksumAlgorithm: "sha256",
 * });
 * ```
 *
 * @example
 * ## Download a container template
 *
 * Download an LXC container template:
 *
 * ```ts
 * import { StorageContent } from "alchemy/proxmox";
 *
 * const template = await StorageContent("debian-template", {
 *   node: "pve",
 *   storage: "local",
 *   content: "vztmpl",
 *   filename: "debian-12-standard_12.0-1_amd64.tar.zst",
 *   url: "http://download.proxmox.com/images/system/debian-12-standard_12.0-1_amd64.tar.zst",
 * });
 * ```
 */
export const StorageContent = Resource(
  "proxmox::StorageContent",
  async function (
    this: Context<StorageContent>,
    id: string,
    props: StorageContentProps,
  ): Promise<StorageContent> {
    const client = await createProxmoxClient(props);
    const { node, storage, content, filename } = props;
    const volid = `${storage}:${content}/${filename}`;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.volid) {
          try {
            await client.nodes
              .$(node)
              .storage.$(storage)
              .content.$(this.output.volid)
              .$delete();
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
        // Check if content already exists
        let exists = false;
        try {
          const contentList = await client.nodes
            .$(node)
            .storage.$(storage)
            .content.$get({ content });
          const contentArray = contentList as Array<Record<string, unknown>>;
          exists = contentArray.some((c) => c.volid === volid);
        } catch {
          // Ignore errors, assume doesn't exist
        }

        if (!exists && props.url) {
          // Download content from URL
          const downloadParams: Record<string, unknown> = {
            content,
            filename,
            url: props.url,
          };

          if (props.checksum) downloadParams.checksum = props.checksum;
          if (props.checksumAlgorithm)
            downloadParams["checksum-algorithm"] = props.checksumAlgorithm;
          if (props.verifyCertificates === false)
            downloadParams["verify-certificates"] = 0;

          await client.nodes
            .$(node)
            .storage.$(storage)
            ["download-url"].$post(
              downloadParams as Parameters<
                (typeof client.nodes.$get)[0]["storage"]["$get"][0]["download-url"]["$post"]
              >[0],
            );

          // Wait for download completion
          await waitForTask(client, node, 1800000); // 30 minute timeout for downloads
        }

        return fetchContentInfo(client, id, node, storage, content, filename, volid);
      }
    }
  },
);

/**
 * Fetch storage content information
 * @internal
 */
async function fetchContentInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
  storage: string,
  content: string,
  filename: string,
  volid: string,
): Promise<StorageContent> {
  const contentList = await client.nodes
    .$(node)
    .storage.$(storage)
    .content.$get({ content });
  const contentArray = contentList as Array<Record<string, unknown>>;
  const contentInfo = contentArray.find((c) => c.volid === volid);

  return {
    id,
    node,
    storage,
    content,
    filename,
    volid,
    size: contentInfo?.size as number | undefined,
    ctime: contentInfo?.ctime as number | undefined,
    format: contentInfo?.format as string | undefined,
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
