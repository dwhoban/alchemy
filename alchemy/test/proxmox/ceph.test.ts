import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import {
  CephPool,
  CephMDS,
  CephFS,
} from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox Ceph Resources", () => {
  const testId = `${BRANCH_PREFIX}-test-ceph`.replace(/-/g, "").slice(0, 12);

  // Ceph tests require a Ceph cluster to be configured
  // These tests are skipped by default unless PROXMOX_CEPH_ENABLED is set
  
  test.skip("create and delete Ceph pool", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox CephPool test: credentials not set");
      return;
    }

    if (!process.env.PROXMOX_CEPH_ENABLED) {
      console.log("Skipping Proxmox CephPool test: PROXMOX_CEPH_ENABLED not set");
      return;
    }

    const node = process.env.PROXMOX_NODE || "pve";
    let pool: CephPool | undefined;

    try {
      pool = await CephPool(`${testId}pool`, {
        node,
        name: `${testId}pool`,
        pg_num: 32,
        size: 2,
        min_size: 1,
        delete: true,
      });

      expect(pool.name).toEqual(`${testId}pool`);
      expect(pool.pg_num).toEqual(32);
    } finally {
      await destroy(scope);
    }
  });

  test.skip("create and delete Ceph MDS", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox CephMDS test: credentials not set");
      return;
    }

    if (!process.env.PROXMOX_CEPH_ENABLED) {
      console.log("Skipping Proxmox CephMDS test: PROXMOX_CEPH_ENABLED not set");
      return;
    }

    const node = process.env.PROXMOX_NODE || "pve";
    let mds: CephMDS | undefined;

    try {
      mds = await CephMDS(`${testId}mds`, {
        node,
        name: `${testId}mds`,
        delete: true,
      });

      expect(mds.name).toEqual(`${testId}mds`);
      expect(mds.node).toEqual(node);
    } finally {
      await destroy(scope);
    }
  });

  test.skip("create and delete CephFS", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox CephFS test: credentials not set");
      return;
    }

    if (!process.env.PROXMOX_CEPH_ENABLED) {
      console.log("Skipping Proxmox CephFS test: PROXMOX_CEPH_ENABLED not set");
      return;
    }

    const node = process.env.PROXMOX_NODE || "pve";
    let fs: CephFS | undefined;

    try {
      fs = await CephFS(`${testId}fs`, {
        node,
        name: `${testId}fs`,
        pg_num: 32,
        delete: true,
      });

      expect(fs.name).toEqual(`${testId}fs`);
      expect(fs.node).toEqual(node);
    } finally {
      await destroy(scope);
    }
  });
});
