import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import {
  createProxmoxClient,
  ACMEAccount,
} from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox ACME Resources", () => {
  const testId = `${BRANCH_PREFIX}-test-acme`;

  test("create and delete ACME account", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox ACMEAccount test: credentials not set");
      return;
    }

    // Skip if no email is configured for ACME
    if (!process.env.PROXMOX_ACME_EMAIL) {
      console.log("Skipping Proxmox ACMEAccount test: PROXMOX_ACME_EMAIL not set");
      return;
    }

    const client = await createProxmoxClient();
    let account: ACMEAccount | undefined;

    try {
      // Create a test ACME account with staging directory
      account = await ACMEAccount(`${testId}`, {
        name: `testacme${testId.replace(/-/g, "")}`.slice(0, 20),
        contact: process.env.PROXMOX_ACME_EMAIL,
        directory: "https://acme-staging-v02.api.letsencrypt.org/directory",
        tos: true,
      });

      expect(account.name).toBeTruthy();
      expect(account.contact).toContain(process.env.PROXMOX_ACME_EMAIL);
    } finally {
      await destroy(scope);

      // Verify account was deleted
      if (account?.name) {
        try {
          await client.cluster.acme.account.$(account.name).$get();
          throw new Error(`ACME Account ${account.name} was not deleted`);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });
});
