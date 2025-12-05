import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for querying USB devices
 */
export interface USBDeviceProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

  /**
   * USB device path to query (optional)
   */
  devicePath?: string;
}

/**
 * USB device information
 */
export interface USBDeviceInfo {
  /**
   * Bus number
   */
  busnum: number;

  /**
   * Device number
   */
  devnum: number;

  /**
   * USB level
   */
  level: number;

  /**
   * USB port
   */
  port: number;

  /**
   * USB class
   */
  class?: number;

  /**
   * Vendor ID
   */
  vendid?: string;

  /**
   * Product ID
   */
  prodid?: string;

  /**
   * Manufacturer
   */
  manufacturer?: string;

  /**
   * Product name
   */
  product?: string;

  /**
   * Serial number
   */
  serial?: string;

  /**
   * USB speed
   */
  speed?: string;

  /**
   * USB path
   */
  usbpath?: string;
}

/**
 * Output returned after USBDevice query
 */
export interface USBDevice {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * Queried device path
   */
  devicePath?: string;

  /**
   * Available USB devices
   */
  devices: USBDeviceInfo[];
}

/**
 * Type guard to check if a resource is a USBDevice
 */
export function isUSBDevice(resource: unknown): resource is USBDevice {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::USBDevice"
  );
}

/**
 * Queries USB devices on a Proxmox node for passthrough configuration.
 *
 * @example
 * ## List USB devices
 *
 * Query all USB devices on a node:
 *
 * ```ts
 * import { USBDevice } from "alchemy/proxmox";
 *
 * const usb = await USBDevice("usb-list", {
 *   node: "pve",
 * });
 * for (const device of usb.devices) {
 *   console.log(`${device.manufacturer} ${device.product}`);
 * }
 * ```
 *
 * @example
 * ## Find specific USB device
 *
 * Find USB device by vendor/product:
 *
 * ```ts
 * import { USBDevice } from "alchemy/proxmox";
 *
 * const usb = await USBDevice("yubikey", {
 *   node: "pve",
 * });
 * const yubikey = usb.devices.find(d =>
 *   d.manufacturer?.includes("Yubico")
 * );
 * if (yubikey) {
 *   console.log(`Found: ${yubikey.vendid}:${yubikey.prodid}`);
 * }
 * ```
 *
 * @example
 * ## Get USB passthrough string
 *
 * Generate USB passthrough config:
 *
 * ```ts
 * import { USBDevice } from "alchemy/proxmox";
 *
 * const usb = await USBDevice("devices", {
 *   node: "pve",
 * });
 * const device = usb.devices[0];
 * const config = `host=${device.vendid}:${device.prodid}`;
 * console.log(`USB passthrough: ${config}`);
 * ```
 */
export const USBDevice = Resource(
  "proxmox::USBDevice",
  async function (
    this: Context<USBDevice>,
    id: string,
    props: USBDeviceProps,
  ): Promise<USBDevice> {
    const client = await createProxmoxClient(props);
    const { node, devicePath } = props;

    // This is a read-only resource for device discovery
    if (this.phase === "delete") {
      return this.destroy();
    }

    // Get USB devices list
    const devices = await client.nodes.$(node).hardware.usb.$get();
    const devicesArray = devices as Array<Record<string, unknown>>;

    const mappedDevices: USBDeviceInfo[] = devicesArray.map((d) => ({
      busnum: d.busnum as number,
      devnum: d.devnum as number,
      level: d.level as number,
      port: d.port as number,
      class: d.class as number | undefined,
      vendid: d.vendid as string | undefined,
      prodid: d.prodid as string | undefined,
      manufacturer: d.manufacturer as string | undefined,
      product: d.product as string | undefined,
      serial: d.serial as string | undefined,
      speed: d.speed as string | undefined,
      usbpath: d.usbpath as string | undefined,
    }));

    return {
      id,
      node,
      devicePath,
      devices: mappedDevices,
    };
  },
);
