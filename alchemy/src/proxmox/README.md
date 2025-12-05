# Proxmox Provider

This provider implements Alchemy resources for [Proxmox VE](https://www.proxmox.com/en/proxmox-virtual-environment/overview), an open-source server virtualization platform.

## Overview

The Proxmox provider uses the [proxmox-api](https://github.com/UrielCh/proxmox-api) SDK to interact with Proxmox VE servers. It supports managing virtual machines, containers, storage, and networking.

## Resources

- **VirtualMachine** - Manage QEMU/KVM virtual machines
- **Container** - Manage LXC containers
- **Storage** - Manage storage pools and volumes
- **Network** - Manage network bridges and interfaces

## Authentication

The provider supports two authentication methods:

### Username/Password

```ts
const vm = await VirtualMachine("my-vm", {
  host: "192.168.1.100",
  username: "root@pam",
  password: alchemy.secret.env.PROXMOX_PASSWORD,
  // ...
});
```

### API Token

```ts
const vm = await VirtualMachine("my-vm", {
  host: "192.168.1.100",
  tokenID: "root@pam!mytoken",
  tokenSecret: alchemy.secret.env.PROXMOX_TOKEN_SECRET,
  // ...
});
```

## Environment Variables

The provider looks for the following environment variables when credentials are not explicitly provided:

- `PROXMOX_HOST` - Proxmox server hostname or IP address
- `PROXMOX_USERNAME` - Username (e.g., `root@pam`)
- `PROXMOX_PASSWORD` - Password for username/password auth
- `PROXMOX_TOKEN_ID` - API token ID (e.g., `root@pam!mytoken`)
- `PROXMOX_TOKEN_SECRET` - API token secret

## Usage

### Create a Virtual Machine

```ts
import { VirtualMachine } from "alchemy/proxmox";

const vm = await VirtualMachine("web-server", {
  node: "pve",
  vmid: 100,
  name: "web-server",
  memory: 4096,
  cores: 2,
  sockets: 1,
  ostype: "l26",
  scsi0: "local-lvm:32",
  net0: "virtio,bridge=vmbr0",
  ide2: "local:iso/debian-12.iso,media=cdrom",
});
```

### Create a Container

```ts
import { Container } from "alchemy/proxmox";

const ct = await Container("app-container", {
  node: "pve",
  vmid: 200,
  hostname: "app-container",
  memory: 2048,
  cores: 2,
  ostemplate: "local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst",
  rootfs: "local-lvm:8",
  net0: "name=eth0,bridge=vmbr0,ip=dhcp",
});
```

## SSL/TLS Configuration

By default, self-signed certificates are not trusted. Set `rejectUnauthorized: false` or configure `NODE_TLS_REJECT_UNAUTHORIZED=0` environment variable for self-signed certificates.

## API Reference

- [Proxmox VE API Documentation](https://pve.proxmox.com/pve-docs/api-viewer/)
- [proxmox-api SDK](https://github.com/UrielCh/proxmox-api)
