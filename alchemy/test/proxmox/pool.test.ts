import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { createProxmoxClient, Pool } from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox Pool Resource", () => {
  const testId = `${BRANCH_PREFIX}-test-pool`;

  test("create, update, and delete pool", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox Pool test: credentials not set");
      return;
    }

    const client = await createProxmoxClient();
    let pool: Pool | undefined;

    try {
      // Create a test pool
      pool = await Pool(`${testId}`, {
        poolid: `testpool-${testId}`,
        comment: "Test pool created by Alchemy",
      });

      expect(pool.poolid).toEqual(`testpool-${testId}`);
      expect(pool.comment).toEqual("Test pool created by Alchemy");

      // Update the pool
      pool = await Pool(`${testId}`, {
        poolid: `testpool-${testId}`,
        comment: "Updated test pool",
      });

      expect(pool.comment).toEqual("Updated test pool");
    } finally {
      await destroy(scope);

      // Verify pool was deleted
      if (pool?.poolid) {
        try {
          await client.pools.$(pool.poolid).$get();
          throw new Error(`Pool ${pool.poolid} was not deleted`);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });
});
