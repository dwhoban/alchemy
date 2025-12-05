import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating or updating a Replication Job
 */
export interface ReplicationJobProps extends ProxmoxApiOptions {
  /**
   * Replication job ID (format: '<vmid>-<jobnum>', e.g., '100-0')
   */
  id: string;

  /**
   * Source VM/CT ID to replicate
   */
  vmid: number;

  /**
   * Target node for replication
   */
  target: string;

  /**
   * Replication schedule (cron format)
   * @default every 15 minutes
   */
  schedule?: string;

  /**
   * Rate limit in MB/s (0 = unlimited)
   * @default 0
   */
  rate?: number;

  /**
   * Replication job comment
   */
  comment?: string;

  /**
   * Disable the replication job
   * @default false
   */
  disable?: boolean;

  /**
   * Mark replicated data as remove-synced
   * @default true
   */
  removeJob?: "local" | "full";

  /**
   * Whether to delete the replication job when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after ReplicationJob creation/update
 */
export interface ReplicationJob {
  /**
   * The Alchemy resource ID
   */
  alchemyId: string;

  /**
   * Replication job ID
   */
  id: string;

  /**
   * Source VM/CT ID
   */
  vmid: number;

  /**
   * Target node
   */
  target: string;

  /**
   * Replication schedule
   */
  schedule: string;

  /**
   * Rate limit in MB/s
   */
  rate: number;

  /**
   * Job comment
   */
  comment?: string;

  /**
   * Whether the job is disabled
   */
  disable: boolean;

  /**
   * Type of resource being replicated
   */
  type: string;

  /**
   * Source node
   */
  source?: string;

  /**
   * Last sync timestamp
   */
  lastSync?: number;

  /**
   * Next sync timestamp
   */
  nextSync?: number;

  /**
   * Current job state
   */
  jobState?: string;

  /**
   * Last error message
   */
  error?: string;
}

/**
 * Type guard to check if a resource is a ReplicationJob
 */
export function isReplicationJob(resource: unknown): resource is ReplicationJob {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::ReplicationJob"
  );
}

/**
 * Creates and manages a Proxmox Replication Job for VM/CT replication.
 *
 * @example
 * ## Create a basic replication job
 *
 * Replicate a VM to another node every 15 minutes:
 *
 * ```ts
 * import { ReplicationJob } from "alchemy/proxmox";
 *
 * const repl = await ReplicationJob("vm-replication", {
 *   id: "100-0",
 *   vmid: 100,
 *   target: "pve2",
 *   schedule: "*\/15",
 *   comment: "Replicate web server to backup node",
 * });
 * ```
 *
 * @example
 * ## Create a replication job with rate limit
 *
 * Replicate with bandwidth limit:
 *
 * ```ts
 * import { ReplicationJob } from "alchemy/proxmox";
 *
 * const repl = await ReplicationJob("db-replication", {
 *   id: "101-0",
 *   vmid: 101,
 *   target: "pve3",
 *   schedule: "0 *", // Every hour
 *   rate: 100, // 100 MB/s limit
 *   comment: "Database replication",
 * });
 * ```
 *
 * @example
 * ## Create a disabled replication job
 *
 * Create a job in disabled state:
 *
 * ```ts
 * import { ReplicationJob } from "alchemy/proxmox";
 *
 * const repl = await ReplicationJob("standby-repl", {
 *   id: "102-0",
 *   vmid: 102,
 *   target: "pve2",
 *   disable: true,
 *   comment: "Standby replication - enable when needed",
 * });
 * ```
 */
export const ReplicationJob = Resource(
  "proxmox::ReplicationJob",
  async function (
    this: Context<ReplicationJob>,
    alchemyId: string,
    props: ReplicationJobProps,
  ): Promise<ReplicationJob> {
    const client = await createProxmoxClient(props);
    const jobId = props.id;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.id) {
          try {
            await client.cluster.replication.$(this.output.id).$delete();
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
          id: jobId,
          target: props.target,
          type: "local", // Only local replication is currently supported
        };

        if (props.schedule) createParams.schedule = props.schedule;
        if (props.rate !== undefined) createParams.rate = props.rate;
        if (props.comment) createParams.comment = props.comment;
        if (props.disable !== undefined)
          createParams.disable = props.disable ? 1 : 0;
        if (props.removeJob) createParams.remove_job = props.removeJob;

        await client.cluster.replication.$post(
          createParams as Parameters<
            typeof client.cluster.replication.$post
          >[0],
        );

        return fetchReplicationJobInfo(client, alchemyId, jobId);
      }

      case "update": {
        const updateParams: Record<string, unknown> = {};

        if (props.schedule) updateParams.schedule = props.schedule;
        if (props.rate !== undefined) updateParams.rate = props.rate;
        if (props.comment) updateParams.comment = props.comment;
        if (props.disable !== undefined)
          updateParams.disable = props.disable ? 1 : 0;
        if (props.removeJob) updateParams.remove_job = props.removeJob;

        await client.cluster.replication
          .$(jobId)
          .$put(
            updateParams as Parameters<
              (typeof client.cluster.replication.$get)[0]["$put"]
            >[0],
          );

        return fetchReplicationJobInfo(client, alchemyId, jobId);
      }
    }
  },
);

/**
 * Fetch replication job information from Proxmox
 * @internal
 */
async function fetchReplicationJobInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  alchemyId: string,
  jobId: string,
): Promise<ReplicationJob> {
  const jobInfo = await client.cluster.replication.$(jobId).$get();

  // Parse vmid from job ID (format: vmid-jobnum)
  const [vmidStr] = jobId.split("-");
  const vmid = Number.parseInt(vmidStr, 10);

  return {
    alchemyId,
    id: jobId,
    vmid,
    target: (jobInfo.target as string) ?? "",
    schedule: (jobInfo.schedule as string) ?? "*/15",
    rate: (jobInfo.rate as number) ?? 0,
    comment: jobInfo.comment as string | undefined,
    disable: Boolean(jobInfo.disable),
    type: (jobInfo.type as string) ?? "local",
    source: jobInfo.source as string | undefined,
    lastSync: jobInfo.last_sync as number | undefined,
    nextSync: jobInfo.next_sync as number | undefined,
    jobState: jobInfo.jobstate as string | undefined,
    error: jobInfo.error as string | undefined,
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
