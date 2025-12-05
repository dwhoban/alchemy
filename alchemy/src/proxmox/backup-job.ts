import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Backup compression type
 */
export type BackupCompression = "0" | "gzip" | "lzo" | "zstd";

/**
 * Backup mode
 */
export type BackupMode = "snapshot" | "suspend" | "stop";

/**
 * Properties for creating or updating a Backup Job
 */
export interface BackupJobProps extends ProxmoxApiOptions {
  /**
   * Backup job ID
   */
  id?: string;

  /**
   * Storage for backups
   */
  storage: string;

  /**
   * Schedule in cron format or special value
   * Examples: "0 2 * * *" (daily at 2am), "sat 01:00" (Saturday at 1am)
   */
  schedule?: string;

  /**
   * VMs/CTs to backup (comma-separated IDs, or 'all')
   */
  vmid?: string;

  /**
   * Backup all guests
   * @default false
   */
  all?: boolean;

  /**
   * Exclude specific VMs/CTs (comma-separated IDs)
   */
  exclude?: string;

  /**
   * Node to run backup on (for cluster)
   */
  node?: string;

  /**
   * Backup mode
   * @default "snapshot"
   */
  mode?: BackupMode;

  /**
   * Compression type
   * @default "zstd"
   */
  compress?: BackupCompression;

  /**
   * Mail to address for notifications
   */
  mailto?: string;

  /**
   * Mail notification mode
   */
  mailnotification?: "always" | "failure";

  /**
   * Prune backups (keep-daily, keep-weekly, etc.)
   */
  pruneBackups?: string;

  /**
   * Maximum number of backups to keep
   */
  maxfiles?: number;

  /**
   * Enable/disable the job
   * @default true
   */
  enabled?: boolean;

  /**
   * Job comment
   */
  comment?: string;

  /**
   * Include RAM in backup (for VMs)
   * @default false
   */
  pigz?: number;

  /**
   * Whether to delete the job when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after BackupJob creation/update
 */
export interface BackupJob {
  /**
   * The Alchemy resource ID
   */
  alchemyId: string;

  /**
   * Backup job ID
   */
  id: string;

  /**
   * Storage for backups
   */
  storage: string;

  /**
   * Schedule
   */
  schedule?: string;

  /**
   * VMs/CTs to backup
   */
  vmid?: string;

  /**
   * Whether all guests are backed up
   */
  all: boolean;

  /**
   * Excluded VMs/CTs
   */
  exclude?: string;

  /**
   * Node
   */
  node?: string;

  /**
   * Backup mode
   */
  mode: BackupMode;

  /**
   * Compression type
   */
  compress: string;

  /**
   * Whether job is enabled
   */
  enabled: boolean;

  /**
   * Job comment
   */
  comment?: string;

  /**
   * Next scheduled run
   */
  nextRun?: string;

  /**
   * Resource type
   */
  type: "vzdump";
}

/**
 * Type guard to check if a resource is a BackupJob
 */
export function isBackupJob(resource: unknown): resource is BackupJob {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::BackupJob"
  );
}

/**
 * Creates and manages a Proxmox Backup Job (vzdump).
 *
 * @example
 * ## Create a daily backup job
 *
 * Backup all VMs daily at 2am:
 *
 * ```ts
 * import { BackupJob } from "alchemy/proxmox";
 *
 * const backup = await BackupJob("daily-backup", {
 *   storage: "backup-storage",
 *   schedule: "0 2 * * *",
 *   all: true,
 *   mode: "snapshot",
 *   compress: "zstd",
 *   comment: "Daily backup of all VMs",
 * });
 * ```
 *
 * @example
 * ## Create a backup job for specific VMs
 *
 * Backup specific VMs:
 *
 * ```ts
 * import { BackupJob } from "alchemy/proxmox";
 *
 * const backup = await BackupJob("web-backup", {
 *   storage: "local",
 *   schedule: "0 3 * * 0",  // Weekly on Sunday at 3am
 *   vmid: "100,101,102",
 *   mode: "snapshot",
 *   mailto: "admin@example.com",
 *   mailnotification: "failure",
 * });
 * ```
 *
 * @example
 * ## Create a backup with retention
 *
 * Backup with automatic pruning:
 *
 * ```ts
 * import { BackupJob } from "alchemy/proxmox";
 *
 * const backup = await BackupJob("prod-backup", {
 *   storage: "nfs-backup",
 *   schedule: "0 1 * * *",
 *   vmid: "100",
 *   mode: "snapshot",
 *   pruneBackups: "keep-daily=7,keep-weekly=4,keep-monthly=6",
 * });
 * ```
 */
export const BackupJob = Resource(
  "proxmox::BackupJob",
  async function (
    this: Context<BackupJob>,
    alchemyId: string,
    props: BackupJobProps,
  ): Promise<BackupJob> {
    const client = await createProxmoxClient(props);

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.id) {
          try {
            await client.cluster.backup.$(this.output.id).$delete();
          } catch (error: unknown) {
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create": {
        const createParams = buildBackupJobParams(props);

        const result = await client.cluster.backup.$post(
          createParams as Parameters<typeof client.cluster.backup.$post>[0],
        );

        // Get the created job ID
        const jobId = (result as string) ?? props.id ?? "";

        return fetchBackupJobInfo(client, alchemyId, jobId);
      }

      case "update": {
        const updateParams = buildBackupJobParams(props);
        const jobId = this.output?.id ?? props.id ?? "";

        await client.cluster.backup
          .$(jobId)
          .$put(
            updateParams as Parameters<
              (typeof client.cluster.backup.$get)[0]["$put"]
            >[0],
          );

        return fetchBackupJobInfo(client, alchemyId, jobId);
      }
    }
  },
);

/**
 * Build backup job parameters
 * @internal
 */
function buildBackupJobParams(
  props: BackupJobProps,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    storage: props.storage,
  };

  if (props.schedule) params.schedule = props.schedule;
  if (props.vmid) params.vmid = props.vmid;
  if (props.all !== undefined) params.all = props.all ? 1 : 0;
  if (props.exclude) params.exclude = props.exclude;
  if (props.node) params.node = props.node;
  if (props.mode) params.mode = props.mode;
  if (props.compress) params.compress = props.compress;
  if (props.mailto) params.mailto = props.mailto;
  if (props.mailnotification) params.mailnotification = props.mailnotification;
  if (props.pruneBackups) params["prune-backups"] = props.pruneBackups;
  if (props.maxfiles !== undefined) params.maxfiles = props.maxfiles;
  if (props.enabled !== undefined) params.enabled = props.enabled ? 1 : 0;
  if (props.comment) params.comment = props.comment;
  if (props.pigz !== undefined) params.pigz = props.pigz;

  return params;
}

/**
 * Fetch backup job information from Proxmox
 * @internal
 */
async function fetchBackupJobInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  alchemyId: string,
  jobId: string,
): Promise<BackupJob> {
  const jobInfo = await client.cluster.backup.$(jobId).$get();

  return {
    alchemyId,
    id: jobId,
    storage: (jobInfo.storage as string) ?? "",
    schedule: jobInfo.schedule as string | undefined,
    vmid: jobInfo.vmid as string | undefined,
    all: Boolean(jobInfo.all),
    exclude: jobInfo.exclude as string | undefined,
    node: jobInfo.node as string | undefined,
    mode: (jobInfo.mode as BackupMode) ?? "snapshot",
    compress: (jobInfo.compress as string) ?? "zstd",
    enabled: jobInfo.enabled !== 0,
    comment: jobInfo.comment as string | undefined,
    nextRun: jobInfo["next-run"] as string | undefined,
    type: "vzdump",
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
