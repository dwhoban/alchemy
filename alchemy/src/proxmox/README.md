# Proxmox Provider

This provider implements Alchemy resources for [Proxmox VE](https://www.proxmox.com/en/proxmox-virtual-environment/overview), an open-source server virtualization platform.

## Overview

The Proxmox provider uses the [proxmox-api](https://github.com/UrielCh/proxmox-api) SDK to interact with Proxmox VE servers. The SDK provides 100% coverage of the official Proxmox API, enabling complete management of virtualization infrastructure.

## Implementation Status

### ✅ Implemented Resources

| Resource | Description | Status |
|----------|-------------|--------|
| VirtualMachine | QEMU/KVM virtual machines | ✅ Complete |
| Container | LXC containers | ✅ Complete |
| Storage | Storage pools (dir, lvm, nfs, etc.) | ✅ Complete |

### 🚧 Planned Resources - Full API Coverage

Based on the [Proxmox VE API](https://pve.proxmox.com/pve-docs/api-viewer/), the following resources are planned for implementation:

#### Cluster Management (`/cluster`)

| Resource | Description | Priority |
|----------|-------------|----------|
| ClusterConfig | Cluster-wide configuration | High |
| ClusterStatus | Cluster status and health | High |
| ClusterResources | Cluster resource summary | High |
| ClusterOptions | Datacenter-wide options | Medium |
| ClusterJoin | Join nodes to cluster | Medium |

#### High Availability (`/cluster/ha`)

| Resource | Description | Priority |
|----------|-------------|----------|
| HAGroup | HA failover groups | High |
| HAResource | HA managed resources (VMs/CTs) | High |
| HAStatus | HA manager status | Medium |

#### Replication (`/cluster/replication`)

| Resource | Description | Priority |
|----------|-------------|----------|
| ReplicationJob | VM/CT replication jobs | High |

#### Backup (`/cluster/backup` & `/nodes/{node}/vzdump`)

| Resource | Description | Priority |
|----------|-------------|----------|
| BackupJob | Scheduled backup jobs | High |
| Backup | Manual backup operations | High |
| BackupConfig | Backup job configuration | Medium |

#### Firewall (`/cluster/firewall` & `/nodes/{node}/firewall`)

| Resource | Description | Priority |
|----------|-------------|----------|
| FirewallClusterRules | Cluster-wide firewall rules | High |
| FirewallClusterOptions | Cluster firewall options | Medium |
| FirewallGroup | Security groups | High |
| FirewallAlias | IP/network aliases | Medium |
| FirewallIPSet | IP sets for rules | Medium |
| FirewallNodeRules | Node-specific firewall rules | Medium |
| FirewallVMRules | VM/CT firewall rules | Medium |

#### ACME/SSL (`/cluster/acme` & `/nodes/{node}/certificates`)

| Resource | Description | Priority |
|----------|-------------|----------|
| ACMEAccount | Let's Encrypt accounts | Medium |
| ACMEPlugin | ACME DNS plugins | Medium |
| Certificate | Node SSL certificates | Medium |
| ACMEChallenge | Certificate challenges | Low |

#### SDN - Software Defined Networking (`/cluster/sdn`)

| Resource | Description | Priority |
|----------|-------------|----------|
| SDNZone | Virtual network zones | High |
| SDNVNet | Virtual networks | High |
| SDNSubnet | Network subnets | High |
| SDNController | SDN controllers | Medium |
| SDNIPAM | IP address management | Medium |
| SDNDNS | DNS integration | Medium |

#### Access Control (`/access`)

| Resource | Description | Priority |
|----------|-------------|----------|
| User | User accounts | High |
| Group | User groups | High |
| Role | Permission roles | High |
| ACL | Access control lists | High |
| AuthDomain | Authentication domains (LDAP, AD, PAM) | Medium |
| APIToken | API tokens | High |
| TFA | Two-factor authentication | Medium |
| Password | User password management | Low |

#### Resource Pools (`/pools`)

| Resource | Description | Priority |
|----------|-------------|----------|
| Pool | Resource pools | High |

#### Node Management (`/nodes/{node}`)

| Resource | Description | Priority |
|----------|-------------|----------|
| Node | Node configuration and status | High |
| NodeNetwork | Network interfaces | High |
| NodeDNS | DNS settings | Medium |
| NodeHosts | /etc/hosts entries | Low |
| NodeTime | Time zone settings | Low |
| NodeSyslog | Syslog configuration | Low |
| NodeServices | System services | Medium |
| NodeSubscription | Subscription status | Low |
| NodeApt | APT repositories | Low |

#### Node Hardware (`/nodes/{node}/hardware`)

| Resource | Description | Priority |
|----------|-------------|----------|
| PCIDevice | PCI device passthrough | Medium |
| USBDevice | USB device passthrough | Medium |

#### Node Disks (`/nodes/{node}/disks`)

| Resource | Description | Priority |
|----------|-------------|----------|
| DiskDirectory | Directory storage setup | Medium |
| DiskLVM | LVM configuration | Medium |
| DiskLVMThin | LVM thin pool configuration | Medium |
| DiskZFS | ZFS pool configuration | Medium |

#### Ceph (`/nodes/{node}/ceph`)

| Resource | Description | Priority |
|----------|-------------|----------|
| CephConfig | Ceph configuration | Medium |
| CephMon | Ceph monitor daemons | Medium |
| CephMgr | Ceph manager daemons | Medium |
| CephOSD | Ceph object storage daemons | Medium |
| CephMDS | Ceph metadata server | Medium |
| CephPool | Ceph storage pools | High |
| CephFS | CephFS filesystems | Medium |

#### VM Operations (`/nodes/{node}/qemu/{vmid}`)

| Resource | Description | Priority |
|----------|-------------|----------|
| VMSnapshot | VM snapshots | High |
| VMClone | Clone VMs | High |
| VMTemplate | Convert VM to template | High |
| VMMigrate | Live migration | High |
| VMBackup | VM backup operations | High |
| VMFirewall | VM firewall rules | Medium |
| VMCloudInit | Cloud-init configuration | High |
| VMAgent | QEMU guest agent | Medium |
| VMPendingChanges | Pending config changes | Low |

#### Container Operations (`/nodes/{node}/lxc/{vmid}`)

| Resource | Description | Priority |
|----------|-------------|----------|
| ContainerSnapshot | Container snapshots | High |
| ContainerClone | Clone containers | High |
| ContainerTemplate | Convert to template | High |
| ContainerMigrate | Container migration | High |
| ContainerBackup | Container backup | High |
| ContainerFirewall | Container firewall rules | Medium |

#### Storage Content (`/nodes/{node}/storage/{storage}`)

| Resource | Description | Priority |
|----------|-------------|----------|
| StorageContent | Storage content/volumes | High |
| ISOImage | ISO images | Medium |
| ContainerTemplate | CT templates | Medium |
| VZDump | Backup files | Medium |

#### Metrics & Monitoring (`/cluster/metrics`)

| Resource | Description | Priority |
|----------|-------------|----------|
| MetricsServer | External metrics servers | Low |

#### Notifications (`/cluster/notifications`)

| Resource | Description | Priority |
|----------|-------------|----------|
| NotificationEndpoint | Notification endpoints | Low |
| NotificationMatcher | Notification matchers | Low |
| NotificationTarget | Notification targets | Low |

## Implementation Priority

The implementation will follow this priority order:

### Phase 1: Core Infrastructure (Current + Next)
1. ✅ VirtualMachine
2. ✅ Container
3. ✅ Storage
4. 🔜 User, Group, Role, ACL (Access Control)
5. 🔜 Pool (Resource Pools)
6. 🔜 Node, NodeNetwork

### Phase 2: Operations & Lifecycle
7. VMSnapshot, ContainerSnapshot
8. VMClone, ContainerClone
9. VMTemplate, ContainerTemplate
10. VMMigrate, ContainerMigrate
11. BackupJob, Backup

### Phase 3: High Availability & Clustering
12. HAGroup, HAResource
13. ReplicationJob
14. ClusterConfig, ClusterStatus

### Phase 4: Networking & Security
15. SDNZone, SDNVNet, SDNSubnet
16. FirewallClusterRules, FirewallGroup
17. FirewallVMRules, FirewallNodeRules

### Phase 5: Advanced Features
18. ACMEAccount, ACMEPlugin, Certificate
19. CephPool, CephOSD, CephMon
20. VMCloudInit, VMAgent
21. Remaining resources

## Resources (Currently Implemented)

- **VirtualMachine** - Manage QEMU/KVM virtual machines
- **Container** - Manage LXC containers
- **Storage** - Manage storage pools and volumes

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
