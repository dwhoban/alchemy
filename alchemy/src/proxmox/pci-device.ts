import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for managing PCI device passthrough
 */
export interface PCIDeviceProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * VM ID to attach the device to
   */
  vmid?: number;

  /**
   * PCI device ID (e.g., "0000:01:00.0")
   */
  deviceId: string;

  /**
   * Host PCI device (for VM configuration)
   * Format: HOSTPCIID[;HOSTPCIID2...]
   */
  hostpci?: string;

  /**
   * PCI express device
   * @default false
   */
  pcie?: boolean;

  /**
   * ROMBAR memory mapping
   * @default true
   */
  rombar?: boolean;

  /**
   * X-VGPU argument for VGPU
   */
  xvga?: boolean;

  /**
   * Mediated device type
   */
  mdev?: string;
}

/**
 * PCI device vendor/device information
 */
export interface PCIDeviceInfo {
  /**
   * PCI device ID
   */
  id: string;

  /**
   * Vendor ID
   */
  vendor: string;

  /**
   * Vendor name
   */
  vendorName?: string;

  /**
   * Device ID (hex)
   */
  device: string;

  /**
   * Device name
   */
  deviceName?: string;

  /**
   * PCI class
   */
  class?: string;

  /**
   * IOMMU group
   */
  iommugroup?: number;

  /**
   * Subsystem vendor
   */
  subsystemVendor?: string;

  /**
   * Subsystem device
   */
  subsystemDevice?: string;

  /**
   * Whether MDEV types are available
   */
  mdev?: boolean;
}

/**
 * Output returned after PCIDevice query
 */
export interface PCIDevice {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * PCI device ID
   */
  deviceId: string;

  /**
   * Device info
   */
  deviceInfo?: PCIDeviceInfo;

  /**
   * Available devices on node
   */
  availableDevices?: PCIDeviceInfo[];

  /**
   * MDEV types if available
   */
  mdevTypes?: Array<{
    type: string;
    description?: string;
    available: number;
  }>;
}

/**
 * Type guard to check if a resource is a PCIDevice
 */
export function isPCIDevice(resource: unknown): resource is PCIDevice {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::PCIDevice"
  );
}

/**
 * Queries PCI devices on a Proxmox node for passthrough configuration.
 *
 * @example
 * ## List PCI devices
 *
 * Query available PCI devices:
 *
 * ```ts
 * import { PCIDevice } from "alchemy/proxmox";
 *
 * const pci = await PCIDevice("gpu", {
 *   node: "pve",
 *   deviceId: "0000:01:00.0",
 * });
 * console.log(`Device: ${pci.deviceInfo?.deviceName}`);
 * console.log(`IOMMU Group: ${pci.deviceInfo?.iommugroup}`);
 * ```
 *
 * @example
 * ## Find GPU for passthrough
 *
 * Find NVIDIA GPU devices:
 *
 * ```ts
 * import { PCIDevice } from "alchemy/proxmox";
 *
 * const pci = await PCIDevice("nvidia", {
 *   node: "pve",
 *   deviceId: "0000:01:00.0",
 * });
 * if (pci.deviceInfo?.vendorName?.includes("NVIDIA")) {
 *   console.log("NVIDIA GPU found");
 * }
 * ```
 *
 * @example
 * ## Check MDEV support
 *
 * Check for mediated device support (VGPU):
 *
 * ```ts
 * import { PCIDevice } from "alchemy/proxmox";
 *
 * const pci = await PCIDevice("vgpu", {
 *   node: "pve",
 *   deviceId: "0000:01:00.0",
 * });
 * if (pci.mdevTypes && pci.mdevTypes.length > 0) {
 *   console.log("MDEV types:", pci.mdevTypes);
 * }
 * ```
 */
export const PCIDevice = Resource(
  "proxmox::PCIDevice",
  async function (
    this: Context<PCIDevice>,
    id: string,
    props: PCIDeviceProps,
  ): Promise<PCIDevice> {
    const client = await createProxmoxClient(props);
    const { node, deviceId } = props;

    // This is a read-only resource for device discovery
    if (this.phase === "delete") {
      return this.destroy();
    }

    // Get PCI devices list
    const devices = await client.nodes.$(node).hardware.pci.$get();
    const devicesArray = devices as Array<Record<string, unknown>>;

    // Find the specific device
    const deviceData = devicesArray.find(
      (d) => d.id === deviceId || d.id === deviceId.replace(/^0000:/, ""),
    );

    let deviceInfo: PCIDeviceInfo | undefined;
    if (deviceData) {
      deviceInfo = {
        id: deviceData.id as string,
        vendor: deviceData.vendor as string,
        vendorName: deviceData.vendor_name as string | undefined,
        device: deviceData.device as string,
        deviceName: deviceData.device_name as string | undefined,
        class: deviceData.class as string | undefined,
        iommugroup: deviceData.iommugroup as number | undefined,
        subsystemVendor: deviceData.subsystem_vendor as string | undefined,
        subsystemDevice: deviceData.subsystem_device as string | undefined,
        mdev: deviceData.mdev as boolean | undefined,
      };
    }

    // Map all available devices
    const availableDevices = devicesArray.map((d) => ({
      id: d.id as string,
      vendor: d.vendor as string,
      vendorName: d.vendor_name as string | undefined,
      device: d.device as string,
      deviceName: d.device_name as string | undefined,
      class: d.class as string | undefined,
      iommugroup: d.iommugroup as number | undefined,
      subsystemVendor: d.subsystem_vendor as string | undefined,
      subsystemDevice: d.subsystem_device as string | undefined,
      mdev: d.mdev as boolean | undefined,
    }));

    // Get MDEV types if available
    let mdevTypes:
      | Array<{ type: string; description?: string; available: number }>
      | undefined;
    if (deviceInfo?.mdev) {
      try {
        const mdevInfo = await client.nodes
          .$(node)
          .hardware.pci.$(deviceId)
          .mdev.$get();
        const mdevArray = mdevInfo as Array<Record<string, unknown>>;
        mdevTypes = mdevArray.map((m) => ({
          type: m.type as string,
          description: m.description as string | undefined,
          available: m.available as number,
        }));
      } catch {
        // MDEV endpoint might not be available
      }
    }

    return {
      id,
      node,
      deviceId,
      deviceInfo,
      availableDevices,
      mdevTypes,
    };
  },
);
