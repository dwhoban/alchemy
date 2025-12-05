---
title: Proxmox Provider
description: Deploy and manage Proxmox VE resources using Alchemy
---

The Proxmox provider allows you to create, manage, and orchestrate [Proxmox Virtual Environment (PVE)](https://www.proxmox.com/en/proxmox-virtual-environment/overview) resources directly from your Alchemy applications. With this provider, you can create virtual machines, LXC containers, storage pools, and more, all using the familiar Alchemy Resource syntax.

## Resources

The Proxmox provider includes the following resources:

- [VirtualMachine](/providers/proxmox/virtual-machine/) - Create and manage QEMU/KVM virtual machines
- [Container](/providers/proxmox/container/) - Create and manage LXC containers
- [Storage](/providers/proxmox/storage/) - Create and manage storage pools

## Authentication

The provider supports two authentication methods:

### Username/Password

```ts
import { VirtualMachine } from "alchemy/proxmox";

const vm = await VirtualMachine("my-vm", {
  host: "192.168.1.100",
  username: "root@pam",
  password: alchemy.secret.env.PROXMOX_PASSWORD,
  node: "pve",
  memory: 2048,
  cores: 2,
});
```

### API Token

```ts
import { VirtualMachine } from "alchemy/proxmox";

const vm = await VirtualMachine("my-vm", {
  host: "192.168.1.100",
  tokenID: "root@pam!mytoken",
  tokenSecret: alchemy.secret.env.PROXMOX_TOKEN_SECRET,
  node: "pve",
  memory: 2048,
  cores: 2,
});
```

## Environment Variables

The provider looks for the following environment variables when credentials are not explicitly provided:

- `PROXMOX_HOST` - Proxmox server hostname or IP address
- `PROXMOX_USERNAME` - Username (e.g., `root@pam`)
- `PROXMOX_PASSWORD` - Password for username/password auth
- `PROXMOX_TOKEN_ID` - API token ID (e.g., `root@pam!mytoken`)
- `PROXMOX_TOKEN_SECRET` - API token secret

## Example

Here's a complete example of using the Proxmox provider to create a virtual machine and LXC container:

```typescript
import alchemy from "alchemy";
import { VirtualMachine, Container, Storage } from "alchemy/proxmox";

const app = await alchemy("proxmox-example");

// Create a directory storage for backups
const backupStorage = await Storage("backup-storage", {
  storage: "backup",
  type: "dir",
  path: "/mnt/backup",
  content: ["backup", "iso", "vztmpl"],
});

// Create a virtual machine
const webServer = await VirtualMachine("web-server", {
  node: "pve",
  vmid: 100,
  name: "web-server",
  memory: 4096,
  cores: 4,
  sockets: 1,
  ostype: "l26",
  scsi0: "local-lvm:32",
  net0: "virtio,bridge=vmbr0",
  start: true,
});

// Create an LXC container
const appContainer = await Container("app-container", {
  node: "pve",
  vmid: 200,
  hostname: "app-container",
  ostemplate: "local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst",
  memory: 2048,
  cores: 2,
  rootfs: "local-lvm:8",
  net0: "name=eth0,bridge=vmbr0,ip=dhcp",
  start: true,
});

console.log({
  webServerVmid: webServer.vmid,
  appContainerVmid: appContainer.vmid,
  backupStorage: backupStorage.storage,
});

await app.finalize();
```

## Additional Resources

- [Proxmox VE Documentation](https://pve.proxmox.com/pve-docs/)
- [Proxmox VE API Documentation](https://pve.proxmox.com/pve-docs/api-viewer/)
- [proxmox-api SDK](https://github.com/UrielCh/proxmox-api)
