import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for creating or updating a Proxmox Virtual Machine
 */
export interface VirtualMachineProps extends ProxmoxApiOptions {
  /**
   * The Proxmox node name where the VM will be created
   */
  node: string;

  /**
   * The VM ID (100-999999999)
   * If not provided, the next available ID will be used
   */
  vmid?: number;

  /**
   * Name of the virtual machine
   * @default ${app}-${stage}-${id}
   */
  name?: string;

  /**
   * Memory size in MB
   * @default 512
   */
  memory?: number;

  /**
   * Number of cores per socket
   * @default 1
   */
  cores?: number;

  /**
   * Number of CPU sockets
   * @default 1
   */
  sockets?: number;

  /**
   * CPU type (e.g., 'host', 'kvm64', 'qemu64')
   */
  cpu?: string;

  /**
   * Guest OS type (e.g., 'l26' for Linux 2.6+, 'win10', 'win11')
   */
  ostype?: string;

  /**
   * SCSI disk configuration (e.g., 'local-lvm:32' for 32GB disk)
   */
  scsi0?: string;

  /**
   * IDE disk configuration for CD-ROM (e.g., 'local:iso/ubuntu.iso,media=cdrom')
   */
  ide2?: string;

  /**
   * Network interface configuration (e.g., 'virtio,bridge=vmbr0')
   */
  net0?: string;

  /**
   * BIOS type ('seabios' or 'ovmf')
   * @default 'seabios'
   */
  bios?: "seabios" | "ovmf";

  /**
   * Boot order (e.g., 'order=scsi0;ide2;net0')
   */
  boot?: string;

  /**
   * Enable/disable QEMU agent
   * @default false
   */
  agent?: boolean;

  /**
   * Enable/disable start on boot
   * @default false
   */
  onboot?: boolean;

  /**
   * Start the VM after creation
   * @default false
   */
  start?: boolean;

  /**
   * Description/notes for the VM
   */
  description?: string;

  /**
   * Tags for the VM (comma-separated)
   */
  tags?: string;

  /**
   * Storage controller type for SCSI
   * @default 'virtio-scsi-pci'
   */
  scsihw?: string;

  /**
   * Additional VM configuration options passed directly to the Proxmox API.
   * Use this for advanced configuration not covered by the typed properties.
   * Parameters are passed directly to the Proxmox API without validation.
   * @see https://pve.proxmox.com/pve-docs/api-viewer/#/nodes/{node}/qemu
   */
  additionalConfig?: Record<string, string | number | boolean>;
}

/**
 * Output returned after Virtual Machine creation/update
 */
export interface VirtualMachine {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * The Proxmox VM ID
   */
  vmid: number;

  /**
   * The Proxmox node where the VM is located
   */
  node: string;

  /**
   * Name of the virtual machine
   */
  name: string;

  /**
   * Current status of the VM
   */
  status: string;

  /**
   * Memory size in MB
   */
  memory: number;

  /**
   * Number of cores
   */
  cores: number;

  /**
   * Number of sockets
   */
  sockets: number;

  /**
   * CPU type
   */
  cpu?: string;

  /**
   * Guest OS type
   */
  ostype?: string;

  /**
   * Whether the VM is a template
   */
  template: boolean;

  /**
   * VM uptime in seconds
   */
  uptime: number;

  /**
   * Current CPU usage (0-1)
   */
  cpuUsage: number;

  /**
   * Current memory usage in bytes
   */
  memoryUsage: number;

  /**
   * Maximum memory in bytes
   */
  maxMemory: number;

  /**
   * Current disk usage in bytes
   */
  diskUsage: number;

  /**
   * Maximum disk size in bytes
   */
  maxDisk: number;

  /**
   * Network received bytes
   */
  netIn: number;

  /**
   * Network sent bytes
   */
  netOut: number;
}

/**
 * Type guard to check if a resource is a VirtualMachine
 */
export function isVirtualMachine(resource: unknown): resource is VirtualMachine {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::VirtualMachine"
  );
}

/**
 * Creates and manages a Proxmox QEMU/KVM Virtual Machine.
 *
 * @example
 * ## Create a basic VM
 *
 * Create a virtual machine with minimal configuration:
 *
 * ```ts
 * import { VirtualMachine } from "alchemy/proxmox";
 *
 * const vm = await VirtualMachine("web-server", {
 *   node: "pve",
 *   vmid: 100,
 *   name: "web-server",
 *   memory: 2048,
 *   cores: 2,
 * });
 * ```
 *
 * @example
 * ## Create a VM with disk and network
 *
 * Create a VM with storage and networking configured:
 *
 * ```ts
 * import { VirtualMachine } from "alchemy/proxmox";
 *
 * const vm = await VirtualMachine("app-server", {
 *   node: "pve",
 *   vmid: 101,
 *   name: "app-server",
 *   memory: 4096,
 *   cores: 4,
 *   sockets: 1,
 *   ostype: "l26",
 *   scsi0: "local-lvm:32",
 *   net0: "virtio,bridge=vmbr0",
 *   start: true,
 * });
 * ```
 *
 * @example
 * ## Create a VM with ISO boot
 *
 * Create a VM that boots from an ISO image:
 *
 * ```ts
 * import { VirtualMachine } from "alchemy/proxmox";
 *
 * const vm = await VirtualMachine("installer", {
 *   node: "pve",
 *   vmid: 102,
 *   name: "installer",
 *   memory: 2048,
 *   cores: 2,
 *   scsi0: "local-lvm:20",
 *   ide2: "local:iso/debian-12.iso,media=cdrom",
 *   boot: "order=ide2;scsi0",
 * });
 * ```
 */
export const VirtualMachine = Resource(
  "proxmox::VirtualMachine",
  async function (
    this: Context<VirtualMachine>,
    id: string,
    props: VirtualMachineProps,
  ): Promise<VirtualMachine> {
    const client = await createProxmoxClient(props);
    const name =
      props.name ?? this.output?.name ?? this.scope.createPhysicalName(id);
    const node = props.node;

    switch (this.phase) {
      case "delete": {
        if (this.output?.vmid) {
          try {
            const nodeApi = client.nodes.$(node);

            // Stop the VM first if it's running
            try {
              await nodeApi.qemu.$(this.output.vmid).status.stop.$post();
              // Wait for VM to stop
              await waitForVmStatus(client, node, this.output.vmid, "stopped");
            } catch {
              // VM might already be stopped
            }

            // Delete the VM
            await nodeApi.qemu.$(this.output.vmid).$delete();
          } catch (error: unknown) {
            // Ignore 404 errors (VM already deleted)
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create": {
        // Determine vmid
        let vmid: number;
        if (props.vmid) {
          vmid = props.vmid;
        } else {
          // Get next available vmid
          const clusterVmid = await client.cluster.nextid.$get();
          vmid =
            typeof clusterVmid === "number"
              ? clusterVmid
              : Number.parseInt(clusterVmid as string, 10);
        }

        const nodeApi = client.nodes.$(node);

        // Build creation parameters
        const createParams: Record<string, unknown> = {
          vmid,
          name,
          memory: props.memory ?? 512,
          cores: props.cores ?? 1,
          sockets: props.sockets ?? 1,
        };

        if (props.cpu) createParams.cpu = props.cpu;
        if (props.ostype) createParams.ostype = props.ostype;
        if (props.scsi0) createParams.scsi0 = props.scsi0;
        if (props.ide2) createParams.ide2 = props.ide2;
        if (props.net0) createParams.net0 = props.net0;
        if (props.bios) createParams.bios = props.bios;
        if (props.boot) createParams.boot = props.boot;
        if (props.agent !== undefined) createParams.agent = props.agent ? 1 : 0;
        if (props.onboot !== undefined)
          createParams.onboot = props.onboot ? 1 : 0;
        if (props.description) createParams.description = props.description;
        if (props.tags) createParams.tags = props.tags;
        if (props.scsihw) createParams.scsihw = props.scsihw;

        // Merge additional config
        if (props.additionalConfig) {
          Object.assign(createParams, props.additionalConfig);
        }

        // Create the VM
        await nodeApi.qemu.$post(
          createParams as Parameters<typeof nodeApi.qemu.$post>[0],
        );

        // Start the VM if requested
        if (props.start) {
          await nodeApi.qemu.$(vmid).status.start.$post();
          await waitForVmStatus(client, node, vmid, "running");
        }

        // Fetch the current VM status
        const vmStatus = await nodeApi.qemu.$(vmid).status.current.$get();
        const vmConfig = await nodeApi.qemu.$(vmid).config.$get();

        return {
          id,
          vmid,
          node,
          name: (vmConfig.name as string) ?? name,
          status: vmStatus.status as string,
          memory: (vmConfig.memory as number) ?? props.memory ?? 512,
          cores: (vmConfig.cores as number) ?? props.cores ?? 1,
          sockets: (vmConfig.sockets as number) ?? props.sockets ?? 1,
          cpu: vmConfig.cpu as string | undefined,
          ostype: vmConfig.ostype as string | undefined,
          template: Boolean(vmStatus.template),
          uptime: (vmStatus.uptime as number) ?? 0,
          cpuUsage: (vmStatus.cpu as number) ?? 0,
          memoryUsage: (vmStatus.mem as number) ?? 0,
          maxMemory: (vmStatus.maxmem as number) ?? 0,
          diskUsage: (vmStatus.disk as number) ?? 0,
          maxDisk: (vmStatus.maxdisk as number) ?? 0,
          netIn: (vmStatus.netin as number) ?? 0,
          netOut: (vmStatus.netout as number) ?? 0,
        };
      }

      case "update": {
        const vmid = this.output.vmid;
        const nodeApi = client.nodes.$(node);

        // Update existing VM configuration
        const updateParams: Record<string, unknown> = {
          name,
          memory: props.memory ?? this.output.memory,
          cores: props.cores ?? this.output.cores,
          sockets: props.sockets ?? this.output.sockets,
        };

        if (props.cpu) updateParams.cpu = props.cpu;
        if (props.ostype) updateParams.ostype = props.ostype;
        if (props.description) updateParams.description = props.description;
        if (props.tags) updateParams.tags = props.tags;
        if (props.agent !== undefined) updateParams.agent = props.agent ? 1 : 0;
        if (props.onboot !== undefined)
          updateParams.onboot = props.onboot ? 1 : 0;

        // Merge additional config
        if (props.additionalConfig) {
          Object.assign(updateParams, props.additionalConfig);
        }

        await nodeApi.qemu
          .$(vmid)
          .config.$put(
            updateParams as Parameters<
              (typeof nodeApi.qemu.$get)[0]["config"]["$put"]
            >[0],
          );

        // Fetch the current VM status
        const vmStatus = await nodeApi.qemu.$(vmid).status.current.$get();
        const vmConfig = await nodeApi.qemu.$(vmid).config.$get();

        return {
          id,
          vmid,
          node,
          name: (vmConfig.name as string) ?? name,
          status: vmStatus.status as string,
          memory: (vmConfig.memory as number) ?? props.memory ?? 512,
          cores: (vmConfig.cores as number) ?? props.cores ?? 1,
          sockets: (vmConfig.sockets as number) ?? props.sockets ?? 1,
          cpu: vmConfig.cpu as string | undefined,
          ostype: vmConfig.ostype as string | undefined,
          template: Boolean(vmStatus.template),
          uptime: (vmStatus.uptime as number) ?? 0,
          cpuUsage: (vmStatus.cpu as number) ?? 0,
          memoryUsage: (vmStatus.mem as number) ?? 0,
          maxMemory: (vmStatus.maxmem as number) ?? 0,
          diskUsage: (vmStatus.disk as number) ?? 0,
          maxDisk: (vmStatus.maxdisk as number) ?? 0,
          netIn: (vmStatus.netin as number) ?? 0,
          netOut: (vmStatus.netout as number) ?? 0,
        };
      }
    }
  },
);

/**
 * Wait for a VM to reach a specific status
 * @internal
 */
async function waitForVmStatus(
  client: ProxmoxClient,
  node: string,
  vmid: number,
  targetStatus: string,
  timeoutMs = 60000,
): Promise<void> {
  const startTime = Date.now();
  const nodeApi = client.nodes.$(node);

  while (Date.now() - startTime < timeoutMs) {
    const status = await nodeApi.qemu.$(vmid).status.current.$get();
    if (status.status === targetStatus) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(
    `Timeout waiting for VM ${vmid} to reach status ${targetStatus}`,
  );
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
