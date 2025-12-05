---
title: Storage
description: Learn how to create, configure, and manage Proxmox storage pools using Alchemy.
---

The Storage resource lets you create and manage [Proxmox storage pools](https://pve.proxmox.com/wiki/Storage).

## Minimal Example

Create a basic directory storage pool:

```ts
import { Storage } from "alchemy/proxmox";

const storage = await Storage("my-storage", {
  storage: "my-storage",
  type: "dir",
  path: "/mnt/data",
});
```

## Directory Storage

Create a directory-based storage pool for backups and ISOs:

```ts
import { Storage } from "alchemy/proxmox";

const storage = await Storage("backup-storage", {
  storage: "backup",
  type: "dir",
  path: "/mnt/backup",
  content: ["backup", "iso", "vztmpl"],
});
```

## NFS Storage

Create an NFS-mounted storage pool:

```ts
import { Storage } from "alchemy/proxmox";

const storage = await Storage("nfs-storage", {
  storage: "nfs-share",
  type: "nfs",
  server: "192.168.1.10",
  export: "/export/proxmox",
  content: ["images", "rootdir", "backup"],
  shared: true,
});
```

## LVM Storage

Create an LVM storage pool:

```ts
import { Storage } from "alchemy/proxmox";

const storage = await Storage("lvm-storage", {
  storage: "lvm-pool",
  type: "lvm",
  vgname: "vg-data",
  content: ["images", "rootdir"],
});
```

## LVM Thin Storage

Create an LVM thin-provisioned storage pool:

```ts
import { Storage } from "alchemy/proxmox";

const storage = await Storage("thin-storage", {
  storage: "thin-pool",
  type: "lvmthin",
  vgname: "pve",
  thinpool: "data",
  content: ["images", "rootdir"],
});
```

## ZFS Storage

Create a ZFS pool storage:

```ts
import { Storage } from "alchemy/proxmox";

const storage = await Storage("zfs-storage", {
  storage: "zfs-pool",
  type: "zfspool",
  pool: "rpool/data",
  content: ["images", "rootdir"],
});
```

## CIFS/SMB Storage

Create a CIFS/SMB network storage:

```ts
import { Storage } from "alchemy/proxmox";

const storage = await Storage("smb-storage", {
  storage: "smb-share",
  type: "cifs",
  server: "192.168.1.10",
  share: "proxmox",
  content: ["backup", "iso"],
  shared: true,
});
```

## Node-Specific Storage

Create storage available only on specific nodes:

```ts
import { Storage } from "alchemy/proxmox";

const storage = await Storage("local-fast", {
  storage: "local-fast",
  type: "dir",
  path: "/mnt/nvme",
  content: ["images", "rootdir"],
  nodes: ["pve1", "pve2"],
});
```

## With Conditional Deletion

Create storage that won't be deleted when removed from Alchemy:

```ts
import { Storage } from "alchemy/proxmox";

const storage = await Storage("persistent-storage", {
  storage: "persistent",
  type: "dir",
  path: "/mnt/important-data",
  content: ["backup"],
  delete: false,
});
```

## Properties

### Required Properties

| Property | Type | Description |
|----------|------|-------------|
| `type` | `StorageType` | Storage type (see below) |

### Storage Types

The `type` property accepts the following values:

- `dir` - Directory-based storage
- `lvm` - LVM volume group
- `lvmthin` - LVM thin-provisioned pool
- `nfs` - NFS mount
- `cifs` - CIFS/SMB share
- `glusterfs` - GlusterFS
- `iscsi` - iSCSI target
- `iscsidirect` - iSCSI direct
- `rbd` - Ceph RBD
- `cephfs` - Ceph Filesystem
- `zfspool` - ZFS pool
- `btrfs` - Btrfs
- `pbs` - Proxmox Backup Server

### Optional Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `storage` | `string` | `${app}-${stage}-${id}` | Storage pool identifier |
| `path` | `string` | - | Path for directory-based storage |
| `vgname` | `string` | - | Volume group name (lvm, lvmthin) |
| `thinpool` | `string` | - | Thin pool name (lvmthin) |
| `server` | `string` | - | Server address (nfs, cifs) |
| `export` | `string` | - | NFS export path |
| `pool` | `string` | - | ZFS pool name |
| `content` | `StorageContent[]` | - | Content types to allow |
| `nodes` | `string \| string[]` | - | Nodes where storage is available |
| `disable` | `boolean` | `false` | Disable the storage |
| `shared` | `boolean` | `false` | Mark as shared storage |
| `delete` | `boolean` | `true` | Delete storage when removed |

### Content Types

The `content` property accepts an array of:

- `images` - VM disk images
- `rootdir` - Container root directories
- `vztmpl` - Container templates
- `backup` - Backup files
- `iso` - ISO images
- `snippets` - Snippets

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
| `storage` | `string` | The storage pool identifier |
| `type` | `StorageType` | Storage type |
| `path` | `string \| undefined` | Path for directory-based storage |
| `content` | `string[]` | Content types available |
| `nodes` | `string[] \| undefined` | Nodes where available |
| `enabled` | `boolean` | Whether storage is enabled |
| `shared` | `boolean` | Whether storage is shared |
| `total` | `number` | Total space in bytes |
| `used` | `number` | Used space in bytes |
| `available` | `number` | Available space in bytes |
| `active` | `boolean` | Whether storage is active |
