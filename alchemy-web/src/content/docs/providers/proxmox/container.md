---
title: Container
description: Learn how to create, configure, and manage Proxmox LXC containers using Alchemy.
---

The Container resource lets you create and manage [Proxmox LXC containers](https://pve.proxmox.com/wiki/Linux_Container).

## Minimal Example

Create a basic container with default settings:

```ts
import { Container } from "alchemy/proxmox";

const ct = await Container("my-container", {
  node: "pve",
  hostname: "my-container",
  ostemplate: "local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst",
});
```

## With Memory and CPU

Create a container with specific memory and CPU configuration:

```ts
import { Container } from "alchemy/proxmox";

const ct = await Container("web-container", {
  node: "pve",
  vmid: 200,
  hostname: "web-container",
  ostemplate: "local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst",
  memory: 2048,
  swap: 512,
  cores: 4,
});
```

## With Storage and Network

Create a container with rootfs and network configured:

```ts
import { Container } from "alchemy/proxmox";

const ct = await Container("app-container", {
  node: "pve",
  vmid: 201,
  hostname: "app-container",
  ostemplate: "local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst",
  memory: 2048,
  cores: 4,
  rootfs: "local-lvm:16",
  net0: "name=eth0,bridge=vmbr0,ip=dhcp",
  start: true,
});
```

## With Docker Support

Create an unprivileged container with nesting enabled for running Docker:

```ts
import { Container } from "alchemy/proxmox";

const ct = await Container("docker-host", {
  node: "pve",
  vmid: 202,
  hostname: "docker-host",
  ostemplate: "local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst",
  memory: 4096,
  cores: 4,
  rootfs: "local-lvm:32",
  net0: "name=eth0,bridge=vmbr0,ip=dhcp",
  features: "nesting=1",
  unprivileged: true,
  start: true,
});
```

## With SSH Keys

Create a container with SSH public keys for root access:

```ts
import { Container } from "alchemy/proxmox";

const ct = await Container("secure-container", {
  node: "pve",
  hostname: "secure-container",
  ostemplate: "local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst",
  memory: 2048,
  cores: 2,
  rootfs: "local-lvm:8",
  net0: "name=eth0,bridge=vmbr0,ip=dhcp",
  sshPublicKeys: "ssh-rsa AAAA... user@host",
  start: true,
});
```

## With Additional Mount Point

Create a container with an additional mount point for data:

```ts
import { Container } from "alchemy/proxmox";

const ct = await Container("data-container", {
  node: "pve",
  hostname: "data-container",
  ostemplate: "local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst",
  memory: 2048,
  cores: 2,
  rootfs: "local-lvm:8",
  mp0: "local-lvm:16,mp=/data",
  net0: "name=eth0,bridge=vmbr0,ip=dhcp",
  start: true,
});
```

## With API Token Authentication

Use API token authentication instead of username/password:

```ts
import { Container } from "alchemy/proxmox";

const ct = await Container("secure-ct", {
  host: "192.168.1.100",
  tokenID: "root@pam!mytoken",
  tokenSecret: alchemy.secret.env.PROXMOX_TOKEN_SECRET,
  node: "pve",
  hostname: "secure-ct",
  ostemplate: "local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst",
  memory: 2048,
  cores: 2,
});
```

## Properties

### Required Properties

| Property | Type | Description |
|----------|------|-------------|
| `node` | `string` | The Proxmox node name where the container will be created |
| `ostemplate` | `string` | OS template to use (e.g., 'local:vztmpl/debian-12.tar.zst') |

### Optional Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `vmid` | `number` | Auto-generated | The container ID (100-999999999) |
| `hostname` | `string` | `${app}-${stage}-${id}` | Hostname of the container |
| `memory` | `number` | `512` | Memory size in MB |
| `swap` | `number` | `512` | Swap size in MB |
| `cores` | `number` | `1` | Number of CPU cores |
| `rootfs` | `string` | - | Root filesystem configuration |
| `net0` | `string` | - | Network interface configuration |
| `mp0` | `string` | - | Additional mount point |
| `password` | `string` | - | Root password |
| `sshPublicKeys` | `string` | - | SSH public keys for root |
| `unprivileged` | `boolean` | `true` | Use unprivileged container |
| `onboot` | `boolean` | `false` | Start on boot |
| `start` | `boolean` | `false` | Start container after creation |
| `description` | `string` | - | Description/notes |
| `tags` | `string` | - | Tags (semicolon-separated) |
| `features` | `string` | - | Features (e.g., 'nesting=1') |

### Authentication Properties

| Property | Type | Description |
|----------|------|-------------|
| `host` | `string` | Proxmox server hostname (default: `PROXMOX_HOST` env var) |
| `port` | `number` | Proxmox server port (default: `8006`) |
| `username` | `string` | Username for auth (default: `PROXMOX_USERNAME` env var) |
| `password` | `string \| Secret` | Password for auth (default: `PROXMOX_PASSWORD` env var) |
| `tokenID` | `string` | API token ID (default: `PROXMOX_TOKEN_ID` env var) |
| `tokenSecret` | `string \| Secret` | API token secret (default: `PROXMOX_TOKEN_SECRET` env var) |
| `rejectUnauthorized` | `boolean` | Reject self-signed certificates (default: `true`) |

## Output Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | The Alchemy resource ID |
| `vmid` | `number` | The Proxmox container ID |
| `node` | `string` | The Proxmox node |
| `hostname` | `string` | Hostname of the container |
| `status` | `string` | Current container status |
| `memory` | `number` | Memory size in MB |
| `swap` | `number` | Swap size in MB |
| `cores` | `number` | Number of cores |
| `ostemplate` | `string` | OS template used |
| `unprivileged` | `boolean` | Whether container is unprivileged |
| `uptime` | `number` | Container uptime in seconds |
| `cpuUsage` | `number` | Current CPU usage (0-1) |
| `memoryUsage` | `number` | Memory usage in bytes |
| `maxMemory` | `number` | Maximum memory in bytes |
| `diskUsage` | `number` | Disk usage in bytes |
| `maxDisk` | `number` | Maximum disk size in bytes |
| `netIn` | `number` | Network received bytes |
| `netOut` | `number` | Network sent bytes |
