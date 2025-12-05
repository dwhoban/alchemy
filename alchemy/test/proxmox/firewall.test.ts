import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import {
  createProxmoxClient,
  FirewallClusterRule,
  FirewallGroup,
  FirewallAlias,
  FirewallIPSet,
} from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox Firewall Resources", () => {
  const testId = `${BRANCH_PREFIX}-test-fw`;

  test("create, update, and delete firewall alias", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox FirewallAlias test: credentials not set");
      return;
    }

    const client = await createProxmoxClient();
    let alias: FirewallAlias | undefined;

    try {
      // Create a test firewall alias
      alias = await FirewallAlias(`${testId}-alias`, {
        name: `testalias_${testId.replace(/-/g, "_")}`,
        cidr: "192.168.1.0/24",
        comment: "Test alias created by Alchemy",
      });

      expect(alias.name).toContain("testalias");
      expect(alias.cidr).toEqual("192.168.1.0/24");

      // Update the alias
      alias = await FirewallAlias(`${testId}-alias`, {
        name: `testalias_${testId.replace(/-/g, "_")}`,
        cidr: "10.0.0.0/8",
        comment: "Updated test alias",
      });

      expect(alias.cidr).toEqual("10.0.0.0/8");
    } finally {
      await destroy(scope);

      // Verify alias was deleted
      if (alias?.name) {
        try {
          await client.cluster.firewall.aliases.$(alias.name).$get();
          throw new Error(`Alias ${alias.name} was not deleted`);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });

  test("create, update, and delete firewall group", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox FirewallGroup test: credentials not set");
      return;
    }

    const client = await createProxmoxClient();
    let group: FirewallGroup | undefined;

    try {
      // Create a test firewall group
      group = await FirewallGroup(`${testId}-group`, {
        group: `testgroup_${testId.replace(/-/g, "_")}`,
        comment: "Test firewall group created by Alchemy",
      });

      expect(group.group).toContain("testgroup");

      // Update the group
      group = await FirewallGroup(`${testId}-group`, {
        group: `testgroup_${testId.replace(/-/g, "_")}`,
        comment: "Updated test firewall group",
      });

      expect(group.comment).toEqual("Updated test firewall group");
    } finally {
      await destroy(scope);

      // Verify group was deleted
      if (group?.group) {
        try {
          await client.cluster.firewall.groups.$(group.group).$get();
          throw new Error(`Group ${group.group} was not deleted`);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });

  test("create, update, and delete firewall IPSet", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox FirewallIPSet test: credentials not set");
      return;
    }

    const client = await createProxmoxClient();
    let ipset: FirewallIPSet | undefined;

    try {
      // Create a test IPSet
      ipset = await FirewallIPSet(`${testId}-ipset`, {
        name: `testipset_${testId.replace(/-/g, "_")}`,
        comment: "Test IPSet created by Alchemy",
      });

      expect(ipset.name).toContain("testipset");

      // Update the IPSet
      ipset = await FirewallIPSet(`${testId}-ipset`, {
        name: `testipset_${testId.replace(/-/g, "_")}`,
        comment: "Updated test IPSet",
      });

      expect(ipset.comment).toEqual("Updated test IPSet");
    } finally {
      await destroy(scope);

      // Verify IPSet was deleted
      if (ipset?.name) {
        try {
          await client.cluster.firewall.ipset.$(ipset.name).$get();
          throw new Error(`IPSet ${ipset.name} was not deleted`);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });

  test("create and delete cluster firewall rule", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox FirewallClusterRule test: credentials not set");
      return;
    }

    let rule: FirewallClusterRule | undefined;

    try {
      // Create a test cluster firewall rule
      rule = await FirewallClusterRule(`${testId}-rule`, {
        action: "ACCEPT",
        type: "in",
        source: "192.168.1.0/24",
        dest: "192.168.2.0/24",
        proto: "tcp",
        dport: "22",
        comment: "Test rule created by Alchemy",
        enable: false, // Disabled for safety
      });

      expect(rule.action).toEqual("ACCEPT");
      expect(rule.type).toEqual("in");
      expect(rule.enable).toBe(false);
    } finally {
      await destroy(scope);
    }
  });
});
