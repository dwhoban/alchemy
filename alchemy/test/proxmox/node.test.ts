import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import {
  createProxmoxClient,
  Node,
  NodeNetwork,
  NodeDNS,
  NodeTime,
  NodeSyslog,
} from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox Node Resources", () => {
  const testId = `${BRANCH_PREFIX}-test-node`;

  test("query node status", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox Node test: credentials not set");
      return;
    }

    const node = process.env.PROXMOX_NODE || "pve";

    try {
      const nodeStatus = await Node(`${testId}-status`, {
        node,
      });

      expect(nodeStatus.node).toEqual(node);
      expect(nodeStatus.status).toBeTruthy();
      expect(typeof nodeStatus.uptime).toBe("number");
    } finally {
      await destroy(scope);
    }
  });

  test("query node DNS settings", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox NodeDNS test: credentials not set");
      return;
    }

    const node = process.env.PROXMOX_NODE || "pve";

    try {
      const dns = await NodeDNS(`${testId}-dns`, {
        node,
      });

      expect(dns.node).toEqual(node);
      // DNS1 should be set on most systems
    } finally {
      await destroy(scope);
    }
  });

  test("query node time settings", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox NodeTime test: credentials not set");
      return;
    }

    const node = process.env.PROXMOX_NODE || "pve";

    try {
      // Query current timezone
      const client = await createProxmoxClient();
      const timeInfo = await client.nodes.$(node).time.$get();
      const currentTz = (timeInfo as Record<string, unknown>).timezone as string;

      const time = await NodeTime(`${testId}-time`, {
        node,
        timezone: currentTz || "UTC",
      });

      expect(time.node).toEqual(node);
      expect(time.timezone).toBeTruthy();
    } finally {
      await destroy(scope);
    }
  });

  test("query node syslog", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox NodeSyslog test: credentials not set");
      return;
    }

    const node = process.env.PROXMOX_NODE || "pve";

    try {
      const syslog = await NodeSyslog(`${testId}-syslog`, {
        node,
        limit: 10,
      });

      expect(syslog.node).toEqual(node);
      expect(syslog.entries).toBeDefined();
      expect(Array.isArray(syslog.entries)).toBe(true);
    } finally {
      await destroy(scope);
    }
  });
});
