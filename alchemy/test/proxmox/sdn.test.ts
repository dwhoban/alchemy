import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import {
  createProxmoxClient,
  SDNZone,
  SDNVNet,
  SDNSubnet,
} from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox SDN Resources", () => {
  const testId = `${BRANCH_PREFIX}-test-sdn`.replace(/-/g, "").slice(0, 8);

  test("create, update, and delete SDN zone", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox SDNZone test: credentials not set");
      return;
    }

    // SDN requires Proxmox VE 7.0+ and proper configuration
    // Skip if SDN is not available
    const client = await createProxmoxClient();
    let zone: SDNZone | undefined;

    try {
      // Check if SDN is available
      try {
        await client.cluster.sdn.zones.$get();
      } catch {
        console.log("Skipping SDN test: SDN not available on this cluster");
        return;
      }

      // Create a test simple zone
      zone = await SDNZone(`${testId}zone`, {
        zone: `${testId}zone`,
        type: "simple",
      });

      expect(zone.zone).toEqual(`${testId}zone`);
      expect(zone.type).toEqual("simple");
    } finally {
      await destroy(scope);

      // Verify zone was deleted
      if (zone?.zone) {
        try {
          await client.cluster.sdn.zones.$(zone.zone).$get();
          throw new Error(`Zone ${zone.zone} was not deleted`);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });

  test("create SDN zone, vnet, and subnet", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox SDN full test: credentials not set");
      return;
    }

    const client = await createProxmoxClient();
    let zone: SDNZone | undefined;
    let vnet: SDNVNet | undefined;
    let subnet: SDNSubnet | undefined;

    try {
      // Check if SDN is available
      try {
        await client.cluster.sdn.zones.$get();
      } catch {
        console.log("Skipping SDN test: SDN not available on this cluster");
        return;
      }

      // Create zone
      zone = await SDNZone(`${testId}z2`, {
        zone: `${testId}z2`,
        type: "simple",
      });

      expect(zone.zone).toEqual(`${testId}z2`);

      // Create vnet in the zone
      vnet = await SDNVNet(`${testId}vnet`, {
        vnet: `${testId}vnet`,
        zone: zone.zone,
      });

      expect(vnet.vnet).toEqual(`${testId}vnet`);
      expect(vnet.zone).toEqual(zone.zone);

      // Create subnet in the vnet
      subnet = await SDNSubnet(`${testId}sub`, {
        subnet: "10.100.0.0/24",
        vnet: vnet.vnet,
        type: "subnet",
        gateway: "10.100.0.1",
      });

      expect(subnet.subnet).toEqual("10.100.0.0/24");
      expect(subnet.vnet).toEqual(vnet.vnet);
    } finally {
      await destroy(scope);
    }
  });
});
