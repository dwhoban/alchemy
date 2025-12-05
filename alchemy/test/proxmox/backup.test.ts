import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import {
  createProxmoxClient,
  BackupJob,
} from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox Backup Resources", () => {
  const testId = `${BRANCH_PREFIX}-test-backup`;

  test("create, update, and delete backup job", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox BackupJob test: credentials not set");
      return;
    }

    const client = await createProxmoxClient();
    let backup: BackupJob | undefined;

    try {
      // Create a test backup job
      backup = await BackupJob(`${testId}`, {
        id: `backup-${testId}`,
        schedule: "0 2 * * *",
        storage: "local",
        mode: "snapshot",
        compress: "zstd",
        enabled: false, // Disabled for safety
        comment: "Test backup job created by Alchemy",
      });

      expect(backup.jobId).toBeTruthy();
      expect(backup.schedule).toEqual("0 2 * * *");
      expect(backup.enabled).toBe(false);

      // Update the backup job
      backup = await BackupJob(`${testId}`, {
        id: `backup-${testId}`,
        schedule: "0 3 * * *",
        storage: "local",
        mode: "snapshot",
        compress: "zstd",
        enabled: false,
        comment: "Updated test backup job",
      });

      expect(backup.schedule).toEqual("0 3 * * *");
    } finally {
      await destroy(scope);

      // Verify backup job was deleted
      if (backup?.jobId) {
        try {
          const jobs = await client.cluster.backup.$get();
          const jobsArray = jobs as Array<Record<string, unknown>>;
          const found = jobsArray.find((j) => j.id === backup?.jobId);
          if (found) {
            throw new Error(`Backup job ${backup.jobId} was not deleted`);
          }
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });
});
