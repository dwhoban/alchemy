import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { createProxmoxClient, Storage } from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox Storage Resource", () => {
  const testId = `${BRANCH_PREFIX}-test-storage`;

  test("create, update, and delete storage", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox Storage test: credentials not set");
      return;
    }

    const client = await createProxmoxClient();
    let storage: Storage | undefined;

    try {
      // Create a test directory storage
      storage = await Storage(`${testId}`, {
        storage: `test-storage-${testId}`,
        type: "dir",
        path: `/tmp/test-storage-${testId}`,
        content: ["images", "iso"],
        shared: false,
      });

      expect(storage.storage).toEqual(`test-storage-${testId}`);
      expect(storage.type).toEqual("dir");

      // Update the storage
      storage = await Storage(`${testId}`, {
        storage: `test-storage-${testId}`,
        type: "dir",
        path: `/tmp/test-storage-${testId}`,
        content: ["images", "iso", "backup"],
        shared: false,
      });

      expect(storage.content).toContain("backup");
    } finally {
      await destroy(scope);

      // Verify storage was deleted
      if (storage?.storage) {
        try {
          await client.storage.$(storage.storage).$get();
          throw new Error(`Storage ${storage.storage} was not deleted`);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });
});
