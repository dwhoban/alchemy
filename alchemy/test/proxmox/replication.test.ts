import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { ReplicationJob } from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox Replication Resources", () => {
  const testId = `${BRANCH_PREFIX}-test-repl`;

  // Replication requires multiple nodes in a cluster
  // This test is skipped by default
  test.skip("create and delete replication job", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox ReplicationJob test: credentials not set");
      return;
    }

    // This test requires an existing VM and a target node
    const vmid = process.env.PROXMOX_TEST_VMID;
    const targetNode = process.env.PROXMOX_TARGET_NODE;
    
    if (!vmid || !targetNode) {
      console.log("Skipping Proxmox ReplicationJob test: PROXMOX_TEST_VMID or PROXMOX_TARGET_NODE not set");
      return;
    }

    let repl: ReplicationJob | undefined;

    try {
      repl = await ReplicationJob(`${testId}`, {
        id: `${vmid}-0`,
        target: targetNode,
        schedule: "*/15",
        rate: 10,
        comment: "Test replication job",
        disable: true, // Disabled for safety
      });

      expect(repl.jobId).toBeTruthy();
      expect(repl.target).toEqual(targetNode);
    } finally {
      await destroy(scope);
    }
  });
});
