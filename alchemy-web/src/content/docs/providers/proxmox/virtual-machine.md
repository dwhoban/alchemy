---
title: VirtualMachine
description: Learn how to create, configure, and manage Proxmox QEMU/KVM virtual machines using Alchemy.
---

The VirtualMachine resource lets you create and manage [Proxmox QEMU/KVM](https://pve.proxmox.com/wiki/Qemu/KVM_Virtual_Machines) virtual machines.

## Minimal Example

Create a basic virtual machine with default settings:

```ts
import { VirtualMachine } from "alchemy/proxmox";

const vm = await VirtualMachine("my-vm", {
  node: "pve",
  name: "my-vm",
});
```

## With Memory and CPU

Create a VM with specific memory and CPU configuration:

```ts
import { VirtualMachine } from "alchemy/proxmox";

const vm = await VirtualMachine("web-server", {
  node: "pve",
  vmid: 100,
  name: "web-server",
  memory: 4096,
  cores: 4,
  sockets: 1,
});
```

## With Disk and Network

Create a VM with storage and networking configured:

```ts
import { VirtualMachine } from "alchemy/proxmox";

const vm = await VirtualMachine("app-server", {
  node: "pve",
  vmid: 101,
  name: "app-server",
  memory: 4096,
  cores: 4,
  sockets: 1,
  ostype: "l26",
  scsi0: "local-lvm:32",
  net0: "virtio,bridge=vmbr0",
  start: true,
});
```

## With ISO Boot

Create a VM that boots from an ISO image for OS installation:

```ts
import { VirtualMachine } from "alchemy/proxmox";

const vm = await VirtualMachine("installer", {
  node: "pve",
  vmid: 102,
  name: "installer",
  memory: 2048,
  cores: 2,
  scsi0: "local-lvm:20",
  ide2: "local:iso/debian-12.iso,media=cdrom",
  boot: "order=ide2;scsi0",
});
```

## With UEFI Boot

Create a VM with UEFI boot (required for modern operating systems):

```ts
import { VirtualMachine } from "alchemy/proxmox";

const vm = await VirtualMachine("uefi-vm", {
  node: "pve",
  vmid: 103,
  name: "uefi-vm",
  memory: 4096,
  cores: 2,
  bios: "ovmf",
  scsi0: "local-lvm:32",
  net0: "virtio,bridge=vmbr0",
});
```

## With QEMU Agent

Create a VM with QEMU agent enabled for better host-guest communication:

```ts
import { VirtualMachine } from "alchemy/proxmox";

const vm = await VirtualMachine("managed-vm", {
  node: "pve",
  vmid: 104,
  name: "managed-vm",
  memory: 2048,
  cores: 2,
  agent: true,
  onboot: true,
  start: true,
});
```

## With API Token Authentication

Use API token authentication instead of username/password:

```ts
import { VirtualMachine } from "alchemy/proxmox";

const vm = await VirtualMachine("secure-vm", {
  host: "192.168.1.100",
  tokenID: "root@pam!mytoken",
  tokenSecret: alchemy.secret.env.PROXMOX_TOKEN_SECRET,
  node: "pve",
  name: "secure-vm",
  memory: 2048,
  cores: 2,
});
```

## Properties

### Required Properties

| Property | Type | Description |
|----------|------|-------------|
| `node` | `string` | The Proxmox node name where the VM will be created |

### Optional Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `vmid` | `number` | Auto-generated | The VM ID (100-999999999) |
| `name` | `string` | `${app}-${stage}-${id}` | Name of the virtual machine |
| `memory` | `number` | `512` | Memory size in MB |
| `cores` | `number` | `1` | Number of cores per socket |
| `sockets` | `number` | `1` | Number of CPU sockets |
| `cpu` | `string` | - | CPU type (e.g., 'host', 'kvm64') |
| `ostype` | `string` | - | Guest OS type (e.g., 'l26', 'win10') |
| `scsi0` | `string` | - | SCSI disk configuration |
| `ide2` | `string` | - | IDE disk configuration (for CD-ROM) |
| `net0` | `string` | - | Network interface configuration |
| `bios` | `"seabios" \| "ovmf"` | `"seabios"` | BIOS type |
| `boot` | `string` | - | Boot order |
| `agent` | `boolean` | `false` | Enable QEMU agent |
| `onboot` | `boolean` | `false` | Start on boot |
| `start` | `boolean` | `false` | Start VM after creation |
| `description` | `string` | - | Description/notes |
| `tags` | `string` | - | Tags (comma-separated) |
| `scsihw` | `string` | `"virtio-scsi-pci"` | SCSI controller type |

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
| `vmid` | `number` | The Proxmox VM ID |
| `node` | `string` | The Proxmox node |
| `name` | `string` | Name of the VM |
| `status` | `string` | Current VM status |
| `memory` | `number` | Memory size in MB |
| `cores` | `number` | Number of cores |
| `sockets` | `number` | Number of sockets |
| `template` | `boolean` | Whether VM is a template |
| `uptime` | `number` | VM uptime in seconds |
| `cpuUsage` | `number` | Current CPU usage (0-1) |
| `memoryUsage` | `number` | Memory usage in bytes |
| `maxMemory` | `number` | Maximum memory in bytes |
| `diskUsage` | `number` | Disk usage in bytes |
| `maxDisk` | `number` | Maximum disk size in bytes |
| `netIn` | `number` | Network received bytes |
| `netOut` | `number` | Network sent bytes |
