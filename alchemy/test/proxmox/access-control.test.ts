import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { createProxmoxClient, User, Group, Role, ACL, APIToken } from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox Access Control Resources", () => {
  const testId = `${BRANCH_PREFIX}-test-access`;

  test("create, update, and delete user", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox User test: credentials not set");
      return;
    }

    const client = await createProxmoxClient();
    let user: User | undefined;

    try {
      // Create a test user
      user = await User(`${testId}-user`, {
        userid: `testuser-${testId}@pve`,
        comment: "Test user created by Alchemy",
        enable: true,
      });

      expect(user.userid).toEqual(`testuser-${testId}@pve`);
      expect(user.enable).toBe(true);

      // Update the user
      user = await User(`${testId}-user`, {
        userid: `testuser-${testId}@pve`,
        comment: "Updated test user",
        enable: false,
      });

      expect(user.enable).toBe(false);
    } finally {
      await destroy(scope);

      // Verify user was deleted
      if (user?.userid) {
        try {
          await client.access.users.$(user.userid).$get();
          throw new Error(`User ${user.userid} was not deleted`);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });

  test("create, update, and delete group", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox Group test: credentials not set");
      return;
    }

    const client = await createProxmoxClient();
    let group: Group | undefined;

    try {
      // Create a test group
      group = await Group(`${testId}-group`, {
        groupid: `testgroup-${testId}`,
        comment: "Test group created by Alchemy",
      });

      expect(group.groupid).toEqual(`testgroup-${testId}`);

      // Update the group
      group = await Group(`${testId}-group`, {
        groupid: `testgroup-${testId}`,
        comment: "Updated test group",
      });

      expect(group.comment).toEqual("Updated test group");
    } finally {
      await destroy(scope);

      // Verify group was deleted
      if (group?.groupid) {
        try {
          await client.access.groups.$(group.groupid).$get();
          throw new Error(`Group ${group.groupid} was not deleted`);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });

  test("create, update, and delete role", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox Role test: credentials not set");
      return;
    }

    const client = await createProxmoxClient();
    let role: Role | undefined;

    try {
      // Create a test role
      role = await Role(`${testId}-role`, {
        roleid: `TestRole-${testId}`,
        privs: ["VM.Audit", "VM.Console"],
      });

      expect(role.roleid).toEqual(`TestRole-${testId}`);
      expect(role.privs).toContain("VM.Audit");

      // Update the role
      role = await Role(`${testId}-role`, {
        roleid: `TestRole-${testId}`,
        privs: ["VM.Audit", "VM.Console", "VM.PowerMgmt"],
      });

      expect(role.privs).toContain("VM.PowerMgmt");
    } finally {
      await destroy(scope);

      // Verify role was deleted
      if (role?.roleid) {
        try {
          await client.access.roles.$(role.roleid).$get();
          throw new Error(`Role ${role.roleid} was not deleted`);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });

  test("create and delete ACL", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox ACL test: credentials not set");
      return;
    }

    let acl: ACL | undefined;

    try {
      // Create a test ACL (requires an existing user/group and role)
      acl = await ACL(`${testId}-acl`, {
        path: "/vms",
        roles: ["PVEVMUser"],
        users: ["root@pam"],
        propagate: true,
      });

      expect(acl.path).toEqual("/vms");
      expect(acl.roles).toContain("PVEVMUser");
    } finally {
      await destroy(scope);
    }
  });
});
