import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for converting a VM to a template
 */
export interface VMTemplateProps extends ProxmoxApiOptions {
  /**
   * Node name where the VM is located
   */
  node: string;

  /**
   * VM ID to convert to template
   */
  vmid: number;

  /**
   * Disk to use as template disk (optional, defaults to all disks)
   */
  disk?: string;

  /**
   * Whether to delete the template when the resource is destroyed
   * @default false
   */
  delete?: boolean;
}

/**
 * Output returned after VM Template conversion
 */
export interface VMTemplate {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Template VM ID
   */
  vmid: number;

  /**
   * Whether the VM is now a template
   */
  isTemplate: boolean;
}

/**
 * Type guard to check if a resource is a VMTemplate
 */
export function isVMTemplate(resource: unknown): resource is VMTemplate {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::VMTemplate"
  );
}

/**
 * Converts a Proxmox Virtual Machine to a template.
 *
 * @example
 * ## Convert VM to template
 *
 * Convert a VM to a reusable template:
 *
 * ```ts
 * import { VMTemplate } from "alchemy/proxmox";
 *
 * const template = await VMTemplate("base-image", {
 *   node: "pve",
 *   vmid: 9000,
 * });
 * ```
 *
 * @example
 * ## Convert specific disk to template
 *
 * Convert only a specific disk:
 *
 * ```ts
 * import { VMTemplate } from "alchemy/proxmox";
 *
 * const template = await VMTemplate("base-image", {
 *   node: "pve",
 *   vmid: 9000,
 *   disk: "scsi0",
 * });
 * ```
 *
 * @see Use with VMClone to create VMs from templates
 */
export const VMTemplate = Resource(
  "proxmox::VMTemplate",
  async function (
    this: Context<VMTemplate>,
    id: string,
    props: VMTemplateProps,
  ): Promise<VMTemplate> {
    const client = await createProxmoxClient(props);
    const { node, vmid } = props;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.vmid) {
          try {
            // Delete the template VM
            await client.nodes.$(node).qemu.$(this.output.vmid).$delete();
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
        // Convert VM to template
        const templateParams: Record<string, unknown> = {};
        if (props.disk) templateParams.disk = props.disk;

        await client.nodes
          .$(node)
          .qemu.$(vmid)
          .template.$post(
            templateParams as Parameters<
              (typeof client.nodes.$get)[0]["qemu"]["$get"][0]["template"]["$post"]
            >[0],
          );

        // Wait for template conversion
        await waitForTask(client, node);

        // Verify template status
        const config = await client.nodes.$(node).qemu.$(vmid).config.$get();

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
