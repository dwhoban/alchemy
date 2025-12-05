import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Container, createProxmoxClient } from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
// must import this or else alchemy.test won't exist
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox Container Resource", () => {
  // Use BRANCH_PREFIX for deterministic, non-colliding resource names
  const testId = `${BRANCH_PREFIX}-test-proxmox-ct`;

  test("create, update, and delete container", async (scope) => {
    // Skip test if Proxmox credentials are not available
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log(
        "Skipping Proxmox Container test: PROXMOX_HOST and authentication credentials not set",
      );
      return;
    }

    // Skip test if no template is configured
    if (!process.env.PROXMOX_TEMPLATE) {
      console.log(
        "Skipping Proxmox Container test: PROXMOX_TEMPLATE environment variable not set",
      );
      return;
    }

    const client = await createProxmoxClient();
    const node = process.env.PROXMOX_NODE || "pve";
    const ostemplate = process.env.PROXMOX_TEMPLATE;

    let ct: Container | undefined;
    try {
      // Create a test container with basic settings
      ct = await Container(testId, {
        node,
        hostname: `test-ct-${testId}`,
        ostemplate,
        memory: 512,
        swap: 256,
        cores: 1,
      });

      expect(ct.vmid).toBeTruthy();
      expect(ct.hostname).toEqual(`test-ct-${testId}`);
      expect(ct.node).toEqual(node);
      expect(ct.memory).toEqual(512);
      expect(ct.swap).toEqual(256);
      expect(ct.cores).toEqual(1);

      // Verify container was created by querying the API directly
      const nodeApi = client.nodes.$(node);
      const ctStatus = await nodeApi.lxc.$(ct.vmid).status.current.$get();
      expect(ctStatus.status).toBeTruthy();

      // Update the container
      ct = await Container(testId, {
        node,
        hostname: `test-ct-${testId}`,
        ostemplate,
        memory: 1024,
        swap: 512,
        cores: 2,
      });

      expect(ct.memory).toEqual(1024);
      expect(ct.swap).toEqual(512);
      expect(ct.cores).toEqual(2);

      // Verify container was updated
      const ctConfig = await nodeApi.lxc.$(ct.vmid).config.$get();
      expect(ctConfig.memory).toEqual(1024);
      expect(ctConfig.swap).toEqual(512);
      expect(ctConfig.cores).toEqual(2);
    } finally {
      // Always clean up, even if test assertions fail
      await destroy(scope);

      // Verify container was deleted
      if (ct?.vmid) {
        try {
          const nodeApi = client.nodes.$(node);
          await nodeApi.lxc.$(ct.vmid).status.current.$get();
          // If we get here, the container still exists (which is an error)
          throw new Error(`Container ${ct.vmid} was not deleted`);
        } catch (error: unknown) {
          // Expected - container should not exist
          if (
            error instanceof Error &&
            !error.message.includes("not found") &&
            !error.message.includes("404") &&
            !error.message.includes("does not exist")
          ) {
            throw error;
          }
        }
      }
    }
  });
});
