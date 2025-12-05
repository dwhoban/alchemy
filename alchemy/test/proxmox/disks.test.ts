import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import {
  DiskDirectory,
  DiskLVM,
  DiskLVMThin,
  DiskZFS,
} from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox Disk Resources", () => {
  const testId = `${BRANCH_PREFIX}-test-disk`.replace(/-/g, "").slice(0, 12);

  // Disk tests are destructive and require spare disks
  // These tests are skipped by default unless PROXMOX_TEST_DISK is set
  
  test.skip("create directory storage", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox DiskDirectory test: credentials not set");
      return;
    }

    const testDisk = process.env.PROXMOX_TEST_DISK;
    if (!testDisk) {
      console.log("Skipping Proxmox DiskDirectory test: PROXMOX_TEST_DISK not set");
      return;
    }

    const node = process.env.PROXMOX_NODE || "pve";
    let dir: DiskDirectory | undefined;

    try {
      dir = await DiskDirectory(`${testId}dir`, {
        node,
        name: `${testId}dir`,
        device: testDisk,
        filesystem: "ext4",
        add_storage: false,
      });

      expect(dir.name).toEqual(`${testId}dir`);
      expect(dir.device).toEqual(testDisk);
    } finally {
      await destroy(scope);
    }
  });

  test.skip("create LVM storage", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox DiskLVM test: credentials not set");
      return;
    }

    const testDisk = process.env.PROXMOX_TEST_DISK;
    if (!testDisk) {
      console.log("Skipping Proxmox DiskLVM test: PROXMOX_TEST_DISK not set");
      return;
    }

    const node = process.env.PROXMOX_NODE || "pve";
    let lvm: DiskLVM | undefined;

    try {
      lvm = await DiskLVM(`${testId}lvm`, {
        node,
        name: `${testId}lvm`,
        device: testDisk,
        add_storage: false,
      });

      expect(lvm.name).toEqual(`${testId}lvm`);
      expect(lvm.device).toEqual(testDisk);
    } finally {
      await destroy(scope);
    }
  });

  test.skip("create LVM-thin storage", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox DiskLVMThin test: credentials not set");
      return;
    }

    const testDisk = process.env.PROXMOX_TEST_DISK;
    if (!testDisk) {
      console.log("Skipping Proxmox DiskLVMThin test: PROXMOX_TEST_DISK not set");
      return;
    }

    const node = process.env.PROXMOX_NODE || "pve";
    let lvmthin: DiskLVMThin | undefined;

    try {
      lvmthin = await DiskLVMThin(`${testId}thin`, {
        node,
        name: `${testId}thin`,
        device: testDisk,
        add_storage: false,
      });

      expect(lvmthin.name).toEqual(`${testId}thin`);
      expect(lvmthin.device).toEqual(testDisk);
    } finally {
      await destroy(scope);
    }
  });

  test.skip("create ZFS storage", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox DiskZFS test: credentials not set");
      return;
    }

    const testDisk = process.env.PROXMOX_TEST_DISK;
    if (!testDisk) {
      console.log("Skipping Proxmox DiskZFS test: PROXMOX_TEST_DISK not set");
      return;
    }

    const node = process.env.PROXMOX_NODE || "pve";
    let zfs: DiskZFS | undefined;

    try {
      zfs = await DiskZFS(`${testId}zfs`, {
        node,
        name: `${testId}zfs`,
        devices: testDisk,
        raidlevel: "single",
        add_storage: false,
      });

      expect(zfs.name).toEqual(`${testId}zfs`);
      expect(zfs.devices).toEqual(testDisk);
    } finally {
      await destroy(scope);
    }
  });
});
