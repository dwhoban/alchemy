import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for configuring a Metrics Server
 */
export interface MetricsServerProps extends ProxmoxApiOptions {
  /**
   * Metrics server name/ID
   */
  name: string;

  /**
   * Server type (influxdb, graphite)
   */
  type: "influxdb" | "graphite";

  /**
   * Server hostname or IP
   */
  server: string;

  /**
   * Server port
   */
  port: number;

  /**
   * Enable/disable the server
   * @default true
   */
  disable?: boolean;

  /**
   * Maximum transmission unit
   */
  mtu?: number;

  /**
   * Timeout for sending metrics
   */
  timeout?: number;

  // InfluxDB specific
  /**
   * InfluxDB protocol (udp, http, https)
   */
  protocol?: "udp" | "http" | "https";

  /**
   * InfluxDB organization (for v2)
   */
  organization?: string;

  /**
   * InfluxDB bucket (for v2)
   */
  bucket?: string;

  /**
   * InfluxDB token (for v2)
   */
  token?: string;

  /**
   * InfluxDB API path prefix
   */
  apiPathPrefix?: string;

  /**
   * Verify SSL certificate
   * @default true
   */
  verifyCertificate?: boolean;

  /**
   * InfluxDB version (1 or 2)
   */
  influxdbVersion?: 1 | 2;

  /**
   * Whether to delete the server when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after MetricsServer creation/update
 */
export interface MetricsServer {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Server name/ID
   */
  name: string;

  /**
   * Server type
   */
  type: string;

  /**
   * Server hostname
   */
  server: string;

  /**
   * Server port
   */
  port: number;

  /**
   * Whether the server is disabled
   */
  disable: boolean;
}

/**
 * Type guard to check if a resource is a MetricsServer
 */
export function isMetricsServer(resource: unknown): resource is MetricsServer {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::MetricsServer"
  );
}

/**
 * Configures a Proxmox Metrics Server for external monitoring.
 *
 * @example
 * ## Configure InfluxDB v2
 *
 * Send metrics to InfluxDB v2:
 *
 * ```ts
 * import { MetricsServer } from "alchemy/proxmox";
 *
 * const influx = await MetricsServer("influxdb", {
 *   name: "influxdb",
 *   type: "influxdb",
 *   server: "influxdb.example.com",
 *   port: 8086,
 *   protocol: "https",
 *   organization: "myorg",
 *   bucket: "proxmox",
 *   token: alchemy.secret.env.INFLUXDB_TOKEN,
 *   influxdbVersion: 2,
 * });
 * ```
 *
 * @example
 * ## Configure Graphite
 *
 * Send metrics to Graphite:
 *
 * ```ts
 * import { MetricsServer } from "alchemy/proxmox";
 *
 * const graphite = await MetricsServer("graphite", {
 *   name: "graphite",
 *   type: "graphite",
 *   server: "graphite.example.com",
 *   port: 2003,
 * });
 * ```
 */
export const MetricsServer = Resource(
  "proxmox::MetricsServer",
  async function (
    this: Context<MetricsServer>,
    id: string,
    props: MetricsServerProps,
  ): Promise<MetricsServer> {
    const client = await createProxmoxClient(props);
    const name = props.name;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.name) {
          try {
            await client.cluster.metrics.server.$(this.output.name).$delete();
          } catch (error: unknown) {
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create": {
        const createParams: Record<string, unknown> = {
          id: name,
          type: props.type,
          server: props.server,
          port: props.port,
        };

        if (props.disable !== undefined)
          createParams.disable = props.disable ? 1 : 0;
        if (props.mtu) createParams.mtu = props.mtu;
        if (props.timeout) createParams.timeout = props.timeout;

        // InfluxDB specific
        if (props.protocol) createParams.protocol = props.protocol;
        if (props.organization) createParams.organization = props.organization;
        if (props.bucket) createParams.bucket = props.bucket;
        if (props.token) createParams.token = props.token;
        if (props.apiPathPrefix)
          createParams["api-path-prefix"] = props.apiPathPrefix;
        if (props.verifyCertificate !== undefined)
          createParams["verify-certificate"] = props.verifyCertificate ? 1 : 0;
        if (props.influxdbVersion)
          createParams["influxdbproto"] =
            props.influxdbVersion === 2 ? "http" : "udp";

        await client.cluster.metrics.server.$post(
          createParams as Parameters<
            typeof client.cluster.metrics.server.$post
          >[0],
        );

        return {
          id,
          name,
          type: props.type,
          server: props.server,
          port: props.port,
          disable: props.disable ?? false,
        };
      }

      case "update": {
        const updateParams: Record<string, unknown> = {
          server: props.server,
          port: props.port,
        };

        if (props.disable !== undefined)
          updateParams.disable = props.disable ? 1 : 0;
        if (props.mtu) updateParams.mtu = props.mtu;
        if (props.timeout) updateParams.timeout = props.timeout;

        // InfluxDB specific
        if (props.protocol) updateParams.protocol = props.protocol;
        if (props.organization) updateParams.organization = props.organization;
        if (props.bucket) updateParams.bucket = props.bucket;
        if (props.token) updateParams.token = props.token;

        await client.cluster.metrics.server
          .$(name)
          .$put(
            updateParams as Parameters<
              (typeof client.cluster.metrics.server.$get)[0]["$put"]
            >[0],
          );

        return {
          id,
          name,
          type: props.type,
          server: props.server,
          port: props.port,
          disable: props.disable ?? false,
        };
      }
    }
  },
);

/**
 * Check if an error is a 404 not found error
 * @internal
 */
function isNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("404") || error.message.includes("not found");
  }
  return false;
}
