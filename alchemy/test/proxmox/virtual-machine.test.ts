import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import {
  createProxmoxClient,
  VirtualMachine,
} from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
// must import this or else alchemy.test won't exist
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox VirtualMachine Resource", () => {
  // Use BRANCH_PREFIX for deterministic, non-colliding resource names
  const testId = `${BRANCH_PREFIX}-test-proxmox-vm`;

  test("create, update, and delete virtual machine", async (scope) => {
    // Skip test if Proxmox credentials are not available
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log(
        "Skipping Proxmox VM test: PROXMOX_HOST and authentication credentials not set",
      );
      return;
    }

    const client = await createProxmoxClient();
    const node = process.env.PROXMOX_NODE || "pve";

    let vm: VirtualMachine | undefined;
    try {
      // Create a test VM with basic settings
      vm = await VirtualMachine(testId, {
        node,
        name: `test-vm-${testId}`,
        memory: 512,
        cores: 1,
        sockets: 1,
      });

      expect(vm.vmid).toBeTruthy();
      expect(vm.name).toEqual(`test-vm-${testId}`);
      expect(vm.node).toEqual(node);
      expect(vm.memory).toEqual(512);
      expect(vm.cores).toEqual(1);
      expect(vm.sockets).toEqual(1);

      // Verify VM was created by querying the API directly
      const nodeApi = client.nodes.$(node);
      const vmStatus = await nodeApi.qemu.$(vm.vmid).status.current.$get();
      expect(vmStatus.status).toBeTruthy();

      // Update the VM
      vm = await VirtualMachine(testId, {
        node,
        name: `test-vm-${testId}`,
        memory: 1024,
        cores: 2,
        sockets: 1,
      });

      expect(vm.memory).toEqual(1024);
      expect(vm.cores).toEqual(2);

      // Verify VM was updated
      const vmConfig = await nodeApi.qemu.$(vm.vmid).config.$get();
      expect(vmConfig.memory).toEqual(1024);
      expect(vmConfig.cores).toEqual(2);
    } finally {
      // Always clean up, even if test assertions fail
      await destroy(scope);

      // Verify VM was deleted
      if (vm?.vmid) {
        try {
          const nodeApi = client.nodes.$(node);
          await nodeApi.qemu.$(vm.vmid).status.current.$get();
          // If we get here, the VM still exists (which is an error)
          throw new Error(`VM ${vm.vmid} was not deleted`);
        } catch (error: unknown) {
          // Expected - VM should not exist
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
