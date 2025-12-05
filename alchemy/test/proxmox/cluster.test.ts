import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import {
  createProxmoxClient,
  ClusterStatus,
  ClusterOptions,
  ClusterResources,
} from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox Cluster Resources", () => {
  const testId = `${BRANCH_PREFIX}-test-cluster`;

  test("query cluster status", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox ClusterStatus test: credentials not set");
      return;
    }

    try {
      const status = await ClusterStatus(`${testId}-status`, {});

      expect(status.id).toBeTruthy();
      // A single node installation will have at least one node
      expect(status.nodes).toBeDefined();
    } finally {
      await destroy(scope);
    }
  });

  test("query cluster options", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox ClusterOptions test: credentials not set");
      return;
    }

    try {
      const options = await ClusterOptions(`${testId}-options`, {});

      expect(options.id).toBeTruthy();
      // keyboard and language are common datacenter options
    } finally {
      await destroy(scope);
    }
  });

  test("query cluster resources", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox ClusterResources test: credentials not set");
      return;
    }

    try {
      const resources = await ClusterResources(`${testId}-resources`, {});

      expect(resources.id).toBeTruthy();
      expect(resources.resources).toBeDefined();
      expect(Array.isArray(resources.resources)).toBe(true);
      expect(typeof resources.totalVMs).toBe("number");
      expect(typeof resources.totalContainers).toBe("number");
    } finally {
      await destroy(scope);
    }
  });

  test("query cluster resources filtered by type", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox ClusterResources type filter test: credentials not set");
      return;
    }

    try {
      const nodeResources = await ClusterResources(`${testId}-nodes`, {
        type: "node",
      });

      expect(nodeResources.nodes).toBeDefined();
      if (nodeResources.nodes && nodeResources.nodes.length > 0) {
        expect(nodeResources.nodes[0].type).toBe("node");
      }
    } finally {
      await destroy(scope);
    }
  });
});
