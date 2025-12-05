import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * APT repository type
 */
export type AptRepositoryType = "deb" | "deb-src";

/**
 * Properties for managing node APT repositories
 */
export interface NodeAptProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * Repository path (e.g., "/etc/apt/sources.list.d/pve-enterprise.list")
   */
  path?: string;

  /**
   * Repository index in the file
   */
  index?: number;

  /**
   * Enable or disable the repository
   */
  enabled?: boolean;

  /**
   * Digest for concurrent modification protection
   */
  digest?: string;
}

/**
 * APT repository information
 */
export interface AptRepository {
  /**
   * Repository path
   */
  path: string;

  /**
   * Index in file
   */
  index: number;

  /**
   * Whether enabled
   */
  enabled: boolean;

  /**
   * Repository type
   */
  types?: string[];

  /**
   * URIs
   */
  uris?: string[];

  /**
   * Suites
   */
  suites?: string[];

  /**
   * Components
   */
  components?: string[];

  /**
   * Comment
   */
  comment?: string;

  /**
   * File type
   */
  fileType?: string;
}

/**
 * Output returned after NodeApt query/update
 */
export interface NodeApt {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Content digest
   */
  digest?: string;

  /**
   * Standard repositories info
   */
  standardRepos?: Array<{
    handle: string;
    name: string;
    status: number;
  }>;

  /**
   * All configured repositories
   */
  repositories?: AptRepository[];

  /**
   * Repository files
   */
  files?: Array<{
    path: string;
    fileType: string;
    repositories: AptRepository[];
  }>;
}

/**
 * Type guard to check if a resource is a NodeApt
 */
export function isNodeApt(resource: unknown): resource is NodeApt {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::NodeApt"
  );
}

/**
 * Manages Proxmox node APT repositories.
 *
 * @example
 * ## List APT repositories
 *
 * Get all configured APT repositories:
 *
 * ```ts
 * import { NodeApt } from "alchemy/proxmox";
 *
 * const apt = await NodeApt("pve-apt", {
 *   node: "pve",
 * });
 * console.log(apt.repositories);
 * ```
 *
 * @example
 * ## Disable enterprise repository
 *
 * Disable the enterprise repository:
 *
 * ```ts
 * import { NodeApt } from "alchemy/proxmox";
 *
 * const apt = await NodeApt("disable-enterprise", {
 *   node: "pve",
 *   path: "/etc/apt/sources.list.d/pve-enterprise.list",
 *   index: 0,
 *   enabled: false,
 * });
 * ```
 *
 * @example
 * ## Enable no-subscription repository
 *
 * Enable the no-subscription community repository:
 *
 * ```ts
 * import { NodeApt } from "alchemy/proxmox";
 *
 * const apt = await NodeApt("enable-nosub", {
 *   node: "pve",
 *   path: "/etc/apt/sources.list.d/pve-no-subscription.list",
 *   index: 0,
 *   enabled: true,
 * });
 * ```
 */
export const NodeApt = Resource(
  "proxmox::NodeApt",
  async function (
    this: Context<NodeApt>,
    id: string,
    props: NodeAptProps,
  ): Promise<NodeApt> {
    const client = await createProxmoxClient(props);
    const { node } = props;

    // This is a configuration resource, delete just means stop managing
    if (this.phase === "delete") {
      return this.destroy();
    }

    // If path and index provided, modify repository
    if (props.path !== undefined && props.index !== undefined) {
      const updateParams: Record<string, unknown> = {
        path: props.path,
        index: props.index,
      };

      if (props.enabled !== undefined) {
        updateParams.enabled = props.enabled ? 1 : 0;
      }

      if (props.digest) {
        updateParams.digest = props.digest;
      }

      await client.nodes
        .$(node)
        .apt.repositories.$post(
          updateParams as Parameters<
            (typeof client.nodes.$get)[0]["apt"]["repositories"]["$post"]
          >[0],
        );
    }

    // Get repository info
    const repoInfo = await client.nodes.$(node).apt.repositories.$get();
    const repoObj = repoInfo as Record<string, unknown>;

    // Parse files and repositories
    const files = (repoObj.files as Array<Record<string, unknown>> | undefined)?.map(
      (f) => ({
        path: f.path as string,
        fileType: f["file-type"] as string,
        repositories: (
          f.repositories as Array<Record<string, unknown>> | undefined
        )?.map((r) => ({
          path: f.path as string,
          index: r.index as number,
          enabled: Boolean(r.enabled),
          types: r.types as string[] | undefined,
          uris: r.uris as string[] | undefined,
          suites: r.suites as string[] | undefined,
          components: r.components as string[] | undefined,
          comment: r.comment as string | undefined,
          fileType: r["file-type"] as string | undefined,
        })) ?? [],
      }),
    );

    // Flatten repositories from all files
    const repositories = files?.flatMap((f) => f.repositories) ?? [];

    // Parse standard repos
    const standardRepos = (
      repoObj.standard as Array<Record<string, unknown>> | undefined
    )?.map((s) => ({
      handle: s.handle as string,
      name: s.name as string,
      status: s.status as number,
    }));

    return {
      id,
      node,
      digest: repoObj.digest as string | undefined,
      standardRepos,
      repositories,
      files,
    };
  },
);
