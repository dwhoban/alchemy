import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createProxmoxClient,
  type ProxmoxApiOptions,
  type ProxmoxClient,
} from "./client.ts";

/**
 * Properties for creating or updating a Proxmox LXC Container
 */
export interface ContainerProps extends ProxmoxApiOptions {
  /**
   * The Proxmox node name where the container will be created
   */
  node: string;

  /**
   * The container ID (100-999999999)
   * If not provided, the next available ID will be used
   */
  vmid?: number;

  /**
   * Hostname of the container
   * @default ${app}-${stage}-${id}
   */
  hostname?: string;

  /**
   * OS template to use (e.g., 'local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst')
   */
  ostemplate: string;

  /**
   * Memory size in MB
   * @default 512
   */
  memory?: number;

  /**
   * Swap size in MB
   * @default 512
   */
  swap?: number;

  /**
   * Number of CPU cores
   * @default 1
   */
  cores?: number;

  /**
   * Root filesystem configuration (e.g., 'local-lvm:8' for 8GB disk)
   */
  rootfs?: string;

  /**
   * Network interface configuration (e.g., 'name=eth0,bridge=vmbr0,ip=dhcp')
   */
  net0?: string;

  /**
   * Additional mount points (e.g., 'local-lvm:4,mp=/data')
   */
  mp0?: string;

  /**
   * Root password for the container
   */
  password?: string;

  /**
   * SSH public keys for root user
   */
  sshPublicKeys?: string;

  /**
   * Enable/disable unprivileged container
   * @default true
   */
  unprivileged?: boolean;

  /**
   * Enable/disable start on boot
   * @default false
   */
  onboot?: boolean;

  /**
   * Start the container after creation
   * @default false
   */
  start?: boolean;

  /**
   * Description/notes for the container
   */
  description?: string;

  /**
   * Tags for the container (semicolon-separated)
   */
  tags?: string;

  /**
   * Enable/disable nesting feature (required for Docker inside LXC)
   * @default false
   */
  features?: string;

  /**
   * Additional container configuration options
   */
  additionalConfig?: Record<string, string | number | boolean>;
}

/**
 * Output returned after Container creation/update
 */
export interface Container {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * The Proxmox container ID
   */
  vmid: number;

  /**
   * The Proxmox node where the container is located
   */
  node: string;

  /**
   * Hostname of the container
   */
  hostname: string;

  /**
   * Current status of the container
   */
  status: string;

  /**
   * Memory size in MB
   */
  memory: number;

  /**
   * Swap size in MB
   */
  swap: number;

  /**
   * Number of cores
   */
  cores: number;

  /**
   * OS template used
   */
  ostemplate: string;

  /**
   * Whether the container is unprivileged
   */
  unprivileged: boolean;

  /**
   * Container uptime in seconds
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
 * Type guard to check if a resource is a Container
 */
export function isContainer(resource: unknown): resource is Container {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::Container"
  );
}

/**
 * Creates and manages a Proxmox LXC Container.
 *
 * @example
 * ## Create a basic container
 *
 * Create a container with minimal configuration:
 *
 * ```ts
 * import { Container } from "alchemy/proxmox";
 *
 * const ct = await Container("web-container", {
 *   node: "pve",
 *   vmid: 200,
 *   hostname: "web-container",
 *   ostemplate: "local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst",
 *   memory: 1024,
 *   cores: 2,
 * });
 * ```
 *
 * @example
 * ## Create a container with storage and network
 *
 * Create a container with rootfs and network configured:
 *
 * ```ts
 * import { Container } from "alchemy/proxmox";
 *
 * const ct = await Container("app-container", {
 *   node: "pve",
 *   vmid: 201,
 *   hostname: "app-container",
 *   ostemplate: "local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst",
 *   memory: 2048,
 *   cores: 4,
 *   rootfs: "local-lvm:16",
 *   net0: "name=eth0,bridge=vmbr0,ip=dhcp",
 *   start: true,
 * });
 * ```
 *
 * @example
 * ## Create a container with Docker support
 *
 * Create an unprivileged container with nesting enabled for Docker:
 *
 * ```ts
 * import { Container } from "alchemy/proxmox";
 *
 * const ct = await Container("docker-host", {
 *   node: "pve",
 *   vmid: 202,
 *   hostname: "docker-host",
 *   ostemplate: "local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst",
 *   memory: 4096,
 *   cores: 4,
 *   rootfs: "local-lvm:32",
 *   net0: "name=eth0,bridge=vmbr0,ip=dhcp",
 *   features: "nesting=1",
 *   unprivileged: true,
 *   start: true,
 * });
 * ```
 */
export const Container = Resource(
  "proxmox::Container",
  async function (
    this: Context<Container>,
    id: string,
    props: ContainerProps,
  ): Promise<Container> {
    const client = await createProxmoxClient(props);
    const hostname =
      props.hostname ??
      this.output?.hostname ??
      this.scope.createPhysicalName(id);
    const node = props.node;

    switch (this.phase) {
      case "delete": {
        if (this.output?.vmid) {
          try {
            const nodeApi = client.nodes.$(node);

            // Stop the container first if it's running
            try {
              await nodeApi.lxc.$(this.output.vmid).status.stop.$post();
              // Wait for container to stop
              await waitForContainerStatus(
                client,
                node,
                this.output.vmid,
                "stopped",
              );
            } catch {
              // Container might already be stopped
            }

            // Delete the container
            await nodeApi.lxc.$(this.output.vmid).$delete();
          } catch (error: unknown) {
            // Ignore 404 errors (container already deleted)
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
          hostname,
          ostemplate: props.ostemplate,
          memory: props.memory ?? 512,
          swap: props.swap ?? 512,
          cores: props.cores ?? 1,
          unprivileged: props.unprivileged !== false ? 1 : 0,
        };

        if (props.rootfs) createParams.rootfs = props.rootfs;
        if (props.net0) createParams.net0 = props.net0;
        if (props.mp0) createParams.mp0 = props.mp0;
        if (props.password) createParams.password = props.password;
        if (props.sshPublicKeys)
          createParams["ssh-public-keys"] = props.sshPublicKeys;
        if (props.onboot !== undefined)
          createParams.onboot = props.onboot ? 1 : 0;
        if (props.description) createParams.description = props.description;
        if (props.tags) createParams.tags = props.tags;
        if (props.features) createParams.features = props.features;

        // Merge additional config
        if (props.additionalConfig) {
          Object.assign(createParams, props.additionalConfig);
        }

        // Create the container
        await nodeApi.lxc.$post(
          createParams as Parameters<typeof nodeApi.lxc.$post>[0],
        );

        // Wait for container to be created
        await waitForContainerStatus(client, node, vmid, "stopped", 120000);

        // Start the container if requested
        if (props.start) {
          await nodeApi.lxc.$(vmid).status.start.$post();
          await waitForContainerStatus(client, node, vmid, "running");
        }

        // Fetch the current container status
        const ctStatus = await nodeApi.lxc.$(vmid).status.current.$get();
        const ctConfig = await nodeApi.lxc.$(vmid).config.$get();

        return {
          id,
          vmid,
          node,
          hostname: (ctConfig.hostname as string) ?? hostname,
          status: ctStatus.status as string,
          memory: (ctConfig.memory as number) ?? props.memory ?? 512,
          swap: (ctConfig.swap as number) ?? props.swap ?? 512,
          cores: (ctConfig.cores as number) ?? props.cores ?? 1,
          ostemplate: props.ostemplate,
          unprivileged: Boolean(ctConfig.unprivileged),
          uptime: (ctStatus.uptime as number) ?? 0,
          cpuUsage: (ctStatus.cpu as number) ?? 0,
          memoryUsage: (ctStatus.mem as number) ?? 0,
          maxMemory: (ctStatus.maxmem as number) ?? 0,
          diskUsage: (ctStatus.disk as number) ?? 0,
          maxDisk: (ctStatus.maxdisk as number) ?? 0,
          netIn: (ctStatus.netin as number) ?? 0,
          netOut: (ctStatus.netout as number) ?? 0,
        };
      }

      case "update": {
        const vmid = this.output.vmid;
        const nodeApi = client.nodes.$(node);

        // Update existing container configuration
        const updateParams: Record<string, unknown> = {
          hostname,
          memory: props.memory ?? this.output.memory,
          swap: props.swap ?? this.output.swap,
          cores: props.cores ?? this.output.cores,
        };

        if (props.description) updateParams.description = props.description;
        if (props.tags) updateParams.tags = props.tags;
        if (props.onboot !== undefined)
          updateParams.onboot = props.onboot ? 1 : 0;
        if (props.features) updateParams.features = props.features;

        // Merge additional config
        if (props.additionalConfig) {
          Object.assign(updateParams, props.additionalConfig);
        }

        await nodeApi.lxc
          .$(vmid)
          .config.$put(
            updateParams as Parameters<
              (typeof nodeApi.lxc.$get)[0]["config"]["$put"]
            >[0],
          );

        // Fetch the current container status
        const ctStatus = await nodeApi.lxc.$(vmid).status.current.$get();
        const ctConfig = await nodeApi.lxc.$(vmid).config.$get();

        return {
          id,
          vmid,
          node,
          hostname: (ctConfig.hostname as string) ?? hostname,
          status: ctStatus.status as string,
          memory: (ctConfig.memory as number) ?? props.memory ?? 512,
          swap: (ctConfig.swap as number) ?? props.swap ?? 512,
          cores: (ctConfig.cores as number) ?? props.cores ?? 1,
          ostemplate: props.ostemplate,
          unprivileged: Boolean(ctConfig.unprivileged),
          uptime: (ctStatus.uptime as number) ?? 0,
          cpuUsage: (ctStatus.cpu as number) ?? 0,
          memoryUsage: (ctStatus.mem as number) ?? 0,
          maxMemory: (ctStatus.maxmem as number) ?? 0,
          diskUsage: (ctStatus.disk as number) ?? 0,
          maxDisk: (ctStatus.maxdisk as number) ?? 0,
          netIn: (ctStatus.netin as number) ?? 0,
          netOut: (ctStatus.netout as number) ?? 0,
        };
      }
    }
  },
);

/**
 * Wait for a container to reach a specific status
 * @internal
 */
async function waitForContainerStatus(
  client: ProxmoxClient,
  node: string,
  vmid: number,
  targetStatus: string,
  timeoutMs = 60000,
): Promise<void> {
  const startTime = Date.now();
  const nodeApi = client.nodes.$(node);

  while (Date.now() - startTime < timeoutMs) {
    try {
      const status = await nodeApi.lxc.$(vmid).status.current.$get();
      if (status.status === targetStatus) {
        return;
      }
    } catch {
      // Container might not exist yet during creation
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(
    `Timeout waiting for container ${vmid} to reach status ${targetStatus}`,
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
