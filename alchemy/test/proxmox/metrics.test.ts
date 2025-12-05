import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import {
  createProxmoxClient,
  MetricsServer,
} from "../../src/proxmox/index.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Proxmox Metrics Resources", () => {
  const testId = `${BRANCH_PREFIX}-test-metrics`;

  test("create, update, and delete metrics server", async (scope) => {
    if (
      !process.env.PROXMOX_HOST ||
      (!process.env.PROXMOX_PASSWORD && !process.env.PROXMOX_TOKEN_SECRET)
    ) {
      console.log("Skipping Proxmox MetricsServer test: credentials not set");
      return;
    }

    const client = await createProxmoxClient();
    let metrics: MetricsServer | undefined;

    try {
      // Create a test metrics server (disabled for safety)
      metrics = await MetricsServer(`${testId}`, {
        id: `testmetrics${testId.replace(/-/g, "")}`.slice(0, 20),
        type: "influxdb",
        server: "localhost",
        port: 8086,
        disable: true, // Disabled for safety
      });

      expect(metrics.serverId).toBeTruthy();
      expect(metrics.type).toEqual("influxdb");
      expect(metrics.disable).toBe(true);

      // Update the metrics server
      metrics = await MetricsServer(`${testId}`, {
        id: `testmetrics${testId.replace(/-/g, "")}`.slice(0, 20),
        type: "influxdb",
        server: "localhost",
        port: 8087,
        disable: true,
      });

      expect(metrics.port).toEqual(8087);
    } finally {
      await destroy(scope);

      // Verify metrics server was deleted
      if (metrics?.serverId) {
        try {
          await client.cluster.metrics.server.$(metrics.serverId).$get();
          throw new Error(`Metrics Server ${metrics.serverId} was not deleted`);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes("was not deleted")) {
            throw error;
          }
        }
      }
    }
  });
});
