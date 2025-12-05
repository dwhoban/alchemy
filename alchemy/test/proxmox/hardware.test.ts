import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import {
  PCIDevice,
  USBDevice,
} from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox Hardware Resources", () => {
  const testId = `${BRANCH_PREFIX}-test-hw`;

  test("query PCI devices", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox PCIDevice test: credentials not set");
      return;
    }

    const node = process.env.PROXMOX_NODE || "pve";

    try {
      // Query PCI devices on the node
      const pci = await PCIDevice(`${testId}-pci`, {
        node,
        deviceId: "0000:00:00.0", // Host bridge is usually present
      });

      expect(pci.node).toEqual(node);
      expect(pci.availableDevices).toBeDefined();
      expect(Array.isArray(pci.availableDevices)).toBe(true);
      
      // There should be at least some PCI devices
      if (pci.availableDevices && pci.availableDevices.length > 0) {
        expect(pci.availableDevices[0].id).toBeTruthy();
        expect(pci.availableDevices[0].vendor).toBeTruthy();
      }
    } finally {
      await destroy(scope);
    }
  });

  test("query USB devices", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox USBDevice test: credentials not set");
      return;
    }

    const node = process.env.PROXMOX_NODE || "pve";

    try {
      // Query USB devices on the node
      const usb = await USBDevice(`${testId}-usb`, {
        node,
      });

      expect(usb.node).toEqual(node);
      expect(usb.devices).toBeDefined();
      expect(Array.isArray(usb.devices)).toBe(true);
      
      // USB devices list might be empty on some systems
      // but the array should exist
    } finally {
      await destroy(scope);
    }
  });
});
