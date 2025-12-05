import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import {
  createProxmoxClient,
  NotificationEndpoint,
  NotificationMatcher,
} from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox Notification Resources", () => {
  const testId = `${BRANCH_PREFIX}-test-notif`.replace(/-/g, "").slice(0, 15);

  test("create, update, and delete notification endpoint", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox NotificationEndpoint test: credentials not set");
      return;
    }

    const client = await createProxmoxClient();
    let endpoint: NotificationEndpoint | undefined;

    try {
      // Create a test sendmail endpoint (disabled)
      endpoint = await NotificationEndpoint(`${testId}ep`, {
        name: `${testId}ep`,
        type: "sendmail",
        mailto: ["test@example.com"],
        comment: "Test endpoint created by Alchemy",
        disable: true, // Disabled for safety
      });

      expect(endpoint.name).toEqual(`${testId}ep`);
      expect(endpoint.type).toEqual("sendmail");
      expect(endpoint.disable).toBe(true);

      // Update the endpoint
      endpoint = await NotificationEndpoint(`${testId}ep`, {
        name: `${testId}ep`,
        type: "sendmail",
        mailto: ["updated@example.com"],
        comment: "Updated test endpoint",
        disable: true,
      });

      expect(endpoint.comment).toEqual("Updated test endpoint");
    } finally {
      await destroy(scope);

      // Verify endpoint was deleted
      if (endpoint?.name) {
        try {
          await client.cluster.notifications.endpoints.sendmail.$(endpoint.name).$get();
          throw new Error(`Endpoint ${endpoint.name} was not deleted`);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });

  test("create, update, and delete notification matcher", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox NotificationMatcher test: credentials not set");
      return;
    }

    const client = await createProxmoxClient();
    let matcher: NotificationMatcher | undefined;

    try {
      // Create a test matcher (disabled)
      matcher = await NotificationMatcher(`${testId}match`, {
        name: `${testId}match`,
        comment: "Test matcher created by Alchemy",
        disable: true, // Disabled for safety
      });

      expect(matcher.name).toEqual(`${testId}match`);
      expect(matcher.disable).toBe(true);

      // Update the matcher
      matcher = await NotificationMatcher(`${testId}match`, {
        name: `${testId}match`,
        comment: "Updated test matcher",
        disable: true,
      });

      expect(matcher.comment).toEqual("Updated test matcher");
    } finally {
      await destroy(scope);

      // Verify matcher was deleted
      if (matcher?.name) {
        try {
          await client.cluster.notifications.matchers.$(matcher.name).$get();
          throw new Error(`Matcher ${matcher.name} was not deleted`);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });
});
