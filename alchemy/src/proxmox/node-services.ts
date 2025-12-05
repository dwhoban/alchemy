import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Service command type
 */
export type ServiceCommand = "start" | "stop" | "restart" | "reload";

/**
 * Properties for managing a node service
 */
export interface NodeServiceProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * Service name (e.g., "pveproxy", "pvedaemon", "ceph-mon", "corosync")
   */
  service: string;

  /**
   * Service command to execute
   */
  command?: ServiceCommand;

  /**
   * Desired service state
   * @default "running"
   */
  state?: "running" | "stopped";
}

/**
 * Output returned after NodeService query/update
 */
export interface NodeService {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Service name
   */
  service: string;

  /**
   * Service state (running, stopped)
   */
  state: string;

  /**
   * Service description
   */
  description?: string;

  /**
   * Unit file state
   */
  unitFileState?: string;

  /**
   * Active state
   */
  activeState?: string;

  /**
   * Sub state
   */
  subState?: string;
}

/**
 * Type guard to check if a resource is a NodeService
 */
export function isNodeService(resource: unknown): resource is NodeService {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::NodeService"
  );
}

/**
 * Manages Proxmox node system services.
 *
 * @example
 * ## Query service status
 *
 * Get current service status:
 *
 * ```ts
 * import { NodeService } from "alchemy/proxmox";
 *
 * const service = await NodeService("pveproxy", {
 *   node: "pve",
 *   service: "pveproxy",
 * });
 * console.log(`Status: ${service.state}`);
 * ```
 *
 * @example
 * ## Restart a service
 *
 * Restart the Proxmox proxy service:
 *
 * ```ts
 * import { NodeService } from "alchemy/proxmox";
 *
 * const service = await NodeService("restart-proxy", {
 *   node: "pve",
 *   service: "pveproxy",
 *   command: "restart",
 * });
 * ```
 *
 * @example
 * ## Ensure service is running
 *
 * Start a service if stopped:
 *
 * ```ts
 * import { NodeService } from "alchemy/proxmox";
 *
 * const service = await NodeService("ceph-mon", {
 *   node: "pve",
 *   service: "ceph-mon",
 *   state: "running",
 * });
 * ```
 */
export const NodeService = Resource(
  "proxmox::NodeService",
  async function (
    this: Context<NodeService>,
    id: string,
    props: NodeServiceProps,
  ): Promise<NodeService> {
    const client = await createProxmoxClient(props);
    const { node, service } = props;

    // This is a service management resource, delete just means stop managing
    if (this.phase === "delete") {
      return this.destroy();
    }

    // Execute command if specified
    if (props.command) {
      await client.nodes
        .$(node)
        .services.$(service)
        .$post({
          command: props.command,
        } as Parameters<
          (typeof client.nodes.$get)[0]["services"]["$get"][0]["$post"]
        >[0]);

      // Wait a bit for command to take effect
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Get current state
    const serviceInfo = await client.nodes.$(node).services.$(service).$get();
    const serviceObj = serviceInfo as Record<string, unknown>;

    // If desired state specified, ensure it
    if (props.state && !props.command) {
      const currentState = serviceObj.state as string;
      const isRunning = currentState === "running";

      if (props.state === "running" && !isRunning) {
        await client.nodes
          .$(node)
          .services.$(service)
          .$post({
            command: "start",
          } as Parameters<
            (typeof client.nodes.$get)[0]["services"]["$get"][0]["$post"]
          >[0]);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else if (props.state === "stopped" && isRunning) {
        await client.nodes
          .$(node)
          .services.$(service)
          .$post({
            command: "stop",
          } as Parameters<
            (typeof client.nodes.$get)[0]["services"]["$get"][0]["$post"]
          >[0]);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Fetch final state
    const finalInfo = await client.nodes.$(node).services.$(service).$get();
    const finalObj = finalInfo as Record<string, unknown>;

    return {
      id,
      node,
      service,
      state: (finalObj.state as string) ?? "unknown",
      description: finalObj.desc as string | undefined,
      unitFileState: finalObj["unit-file-state"] as string | undefined,
      activeState: finalObj["active-state"] as string | undefined,
      subState: finalObj["sub-state"] as string | undefined,
    };
  },
);
