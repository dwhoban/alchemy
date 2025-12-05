import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import {
  createProxmoxClient,
  HAGroup,
  HAResource,
} from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox High Availability Resources", () => {
  const testId = `${BRANCH_PREFIX}-test-ha`;

  test("create, update, and delete HA group", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox HAGroup test: credentials not set");
      return;
    }

    const node = process.env.PROXMOX_NODE || "pve";
    const client = await createProxmoxClient();
    let haGroup: HAGroup | undefined;

    try {
      // Create a test HA group
      haGroup = await HAGroup(`${testId}-group`, {
        group: `testhagroup-${testId}`,
        nodes: node,
        comment: "Test HA group created by Alchemy",
      });

      expect(haGroup.group).toEqual(`testhagroup-${testId}`);
      expect(haGroup.nodes).toContain(node);

      // Update the HA group
      haGroup = await HAGroup(`${testId}-group`, {
        group: `testhagroup-${testId}`,
        nodes: node,
        comment: "Updated test HA group",
        nofailback: true,
      });

      expect(haGroup.nofailback).toBe(true);
    } finally {
      await destroy(scope);

      // Verify HA group was deleted
      if (haGroup?.group) {
        try {
          await client.cluster.ha.groups.$(haGroup.group).$get();
          throw new Error(`HA Group ${haGroup.group} was not deleted`);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });

  // HAResource test requires an existing VM/CT, skipped by default
  test.skip("create and delete HA resource", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox HAResource test: credentials not set");
      return;
    }

    // This test requires an existing VM ID
    const vmid = process.env.PROXMOX_TEST_VMID;
    if (!vmid) {
      console.log("Skipping Proxmox HAResource test: PROXMOX_TEST_VMID not set");
      return;
    }

    let haResource: HAResource | undefined;

    try {
      haResource = await HAResource(`${testId}-resource`, {
        sid: `vm:${vmid}`,
        state: "started",
        comment: "Test HA resource",
      });

      expect(haResource.sid).toEqual(`vm:${vmid}`);
    } finally {
      await destroy(scope);
    }
  });
});
