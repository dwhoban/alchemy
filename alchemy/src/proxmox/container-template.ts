import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for converting a Container to a template
 */
export interface ContainerTemplateProps extends ProxmoxApiOptions {
  /**
   * Node name where the container is located
   */
  node: string;

  /**
   * Container ID to convert to template
   */
  vmid: number;

  /**
   * Whether to delete the template when the resource is destroyed
   * @default false
   */
  delete?: boolean;
}

/**
 * Output returned after Container Template conversion
 */
export interface ContainerTemplate {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Template container ID
   */
  vmid: number;

  /**
   * Whether the container is now a template
   */
  isTemplate: boolean;
}

/**
 * Type guard to check if a resource is a ContainerTemplate
 */
export function isContainerTemplate(
  resource: unknown,
): resource is ContainerTemplate {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::ContainerTemplate"
  );
}

/**
 * Converts a Proxmox Container to a template.
 *
 * @example
 * ## Convert container to template
 *
 * Convert a container to a reusable template:
 *
 * ```ts
 * import { ContainerTemplate } from "alchemy/proxmox";
 *
 * const template = await ContainerTemplate("base-ct", {
 *   node: "pve",
 *   vmid: 9100,
 * });
 * ```
 *
 * @see Use with ContainerClone to create containers from templates
 */
export const ContainerTemplate = Resource(
  "proxmox::ContainerTemplate",
  async function (
    this: Context<ContainerTemplate>,
    id: string,
    props: ContainerTemplateProps,
  ): Promise<ContainerTemplate> {
    const client = await createProxmoxClient(props);
    const { node, vmid } = props;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.vmid) {
          try {
            // Delete the template container
            await client.nodes.$(node).lxc.$(this.output.vmid).$delete();
            await waitForTask(client, node);
          } catch (error: unknown) {
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create":
      case "update": {
        // Convert container to template
        await client.nodes.$(node).lxc.$(vmid).template.$post();

        // Wait for template conversion
        await waitForTask(client, node);

        // Verify template status
        const config = await client.nodes.$(node).lxc.$(vmid).config.$get();

        return {
          id,
          node,
          vmid,
          isTemplate: Boolean((config as Record<string, unknown>).template),
        };
      }
    }
  },
);

/**
 * Wait for any running task to complete
 * @internal
 */
async function waitForTask(
  client: ProxmoxClient,
  node: string,
  timeoutMs = 300000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const tasks = await client.nodes.$(node).tasks.$get({ running: 1 });
      if (!tasks || (tasks as Array<unknown>).length === 0) {
        return;
      }
    } catch {
      // Tasks endpoint might fail, continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

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
