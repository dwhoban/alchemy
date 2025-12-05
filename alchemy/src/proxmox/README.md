# Proxmox Provider

This provider implements Alchemy resources for [Proxmox VE](https://www.proxmox.com/en/proxmox-virtual-environment/overview), an open-source server virtualization platform.

## Overview

The Proxmox provider uses the [proxmox-api](https://github.com/UrielCh/proxmox-api) SDK to interact with Proxmox VE servers. The SDK provides 100% coverage of the official Proxmox API, enabling complete management of virtualization infrastructure.

## Implementation Status

### ✅ Implemented Resources (59 Total)

| Category | Resource | Description | Status |
|----------|----------|-------------|--------|
| **Compute** | VirtualMachine | QEMU/KVM virtual machines | ✅ Complete |
| **Compute** | Container | LXC containers | ✅ Complete |
| **Storage** | Storage | Storage pools (dir, lvm, nfs, etc.) | ✅ Complete |
| **Storage** | StorageContent | ISO images, templates, backups | ✅ Complete |
| **Access Control** | User | User accounts | ✅ Complete |
| **Access Control** | Group | User groups | ✅ Complete |
| **Access Control** | Role | Permission roles | ✅ Complete |
| **Access Control** | ACL | Access control lists | ✅ Complete |
| **Access Control** | APIToken | API tokens | ✅ Complete |
| **Access Control** | AuthDomain | LDAP, AD, OpenID domains | ✅ Complete |
| **Resource Pools** | Pool | Resource pools | ✅ Complete |
| **Cluster** | ClusterStatus | Cluster status and health | ✅ Complete |
| **Cluster** | ClusterOptions | Datacenter-wide options | ✅ Complete |
| **Cluster** | ClusterResources | Cluster resource summary | ✅ Complete |
| **Cluster** | ClusterJoin | Join nodes to cluster | ✅ Complete |
| **Node** | Node | Node status and metrics | ✅ Complete |
| **Node** | NodeNetwork | Network interfaces | ✅ Complete |
| **Node** | NodeDNS | DNS settings | ✅ Complete |
| **Node** | NodeHosts | /etc/hosts entries | ✅ Complete |
| **Node** | NodeTime | Time zone settings | ✅ Complete |
| **Node** | NodeServices | System services | ✅ Complete |
| **Node** | NodeSubscription | Subscription status | ✅ Complete |
| **Node** | NodeApt | APT repositories | ✅ Complete |
| **Node** | NodeSyslog | Syslog query | ✅ Complete |
| **VM Operations** | VMSnapshot | VM snapshots | ✅ Complete |
| **VM Operations** | VMClone | Clone VMs | ✅ Complete |
| **VM Operations** | VMTemplate | Convert VM to template | ✅ Complete |
| **VM Operations** | VMMigrate | Live migration | ✅ Complete |
| **Container Ops** | ContainerSnapshot | Container snapshots | ✅ Complete |
| **Container Ops** | ContainerClone | Clone containers | ✅ Complete |
| **Container Ops** | ContainerTemplate | Convert to template | ✅ Complete |
| **Container Ops** | ContainerMigrate | Container migration | ✅ Complete |
| **High Availability** | HAGroup | HA failover groups | ✅ Complete |
| **High Availability** | HAResource | HA managed resources | ✅ Complete |
| **Replication** | ReplicationJob | VM/CT replication jobs | ✅ Complete |
| **Firewall** | FirewallClusterRule | Cluster firewall rules | ✅ Complete |
| **Firewall** | FirewallGroup | Security groups | ✅ Complete |
| **Firewall** | FirewallAlias | IP/network aliases | ✅ Complete |
| **Firewall** | FirewallIPSet | IP sets for rules | ✅ Complete |
| **Firewall** | FirewallVMRule | VM firewall rules | ✅ Complete |
| **Firewall** | FirewallNodeRule | Node firewall rules | ✅ Complete |
| **SDN** | SDNZone | Virtual network zones | ✅ Complete |
| **SDN** | SDNVNet | Virtual networks | ✅ Complete |
| **SDN** | SDNSubnet | Network subnets | ✅ Complete |
| **SDN** | SDNController | SDN controllers (BGP, EVPN) | ✅ Complete |
| **SDN** | SDNIPAM | IP address management | ✅ Complete |
| **SDN** | SDNDNS | DNS integration | ✅ Complete |
| **Backup** | BackupJob | Scheduled backup jobs | ✅ Complete |
| **ACME/SSL** | ACMEAccount | Let's Encrypt accounts | ✅ Complete |
| **ACME/SSL** | ACMEPlugin | ACME DNS plugins | ✅ Complete |
| **ACME/SSL** | Certificate | Node SSL certificates | ✅ Complete |
| **Ceph** | CephPool | Ceph storage pools | ✅ Complete |
| **Ceph** | CephOSD | Ceph object storage daemons | ✅ Complete |
| **Ceph** | CephMon | Ceph monitor daemons | ✅ Complete |
| **Ceph** | CephMgr | Ceph manager daemons | ✅ Complete |
| **Ceph** | CephMDS | Ceph metadata server | ✅ Complete |
| **Ceph** | CephFS | CephFS filesystems | ✅ Complete |
| **Disks** | DiskDirectory | Directory storage setup | ✅ Complete |
| **Disks** | DiskLVM | LVM configuration | ✅ Complete |
| **Disks** | DiskLVMThin | LVM thin pool configuration | ✅ Complete |
| **Disks** | DiskZFS | ZFS pool configuration | ✅ Complete |
| **Hardware** | PCIDevice | PCI device passthrough | ✅ Complete |
| **Hardware** | USBDevice | USB device passthrough | ✅ Complete |
| **Notifications** | NotificationEndpoint | Notification endpoints | ✅ Complete |
| **Notifications** | NotificationMatcher | Notification matchers | ✅ Complete |
| **Monitoring** | MetricsServer | InfluxDB/Graphite metrics | ✅ Complete |

## Implementation Progress

### ✅ Phase 1: Core Infrastructure - COMPLETE
1. ✅ VirtualMachine
2. ✅ Container
3. ✅ Storage, StorageContent
4. ✅ User, Group, Role, ACL, APIToken, AuthDomain (Access Control)
5. ✅ Pool (Resource Pools)
6. ✅ Node, NodeNetwork, NodeDNS, NodeHosts, NodeTime, NodeServices, NodeSubscription, NodeApt, NodeSyslog

### ✅ Phase 2: Operations & Lifecycle - COMPLETE
7. ✅ VMSnapshot, ContainerSnapshot
8. ✅ VMClone, ContainerClone
9. ✅ VMTemplate, ContainerTemplate
10. ✅ VMMigrate, ContainerMigrate
11. ✅ BackupJob

### ✅ Phase 3: High Availability & Clustering - COMPLETE
12. ✅ HAGroup, HAResource
13. ✅ ReplicationJob
14. ✅ ClusterStatus, ClusterOptions, ClusterResources, ClusterJoin

### ✅ Phase 4: Networking & Security - COMPLETE
15. ✅ SDNZone, SDNVNet, SDNSubnet, SDNController, SDNIPAM, SDNDNS
16. ✅ FirewallClusterRule, FirewallGroup, FirewallAlias, FirewallIPSet
17. ✅ FirewallVMRule, FirewallNodeRule

### ✅ Phase 5: Advanced Features - COMPLETE
18. ✅ ACMEAccount, ACMEPlugin, Certificate
19. ✅ CephPool, CephOSD, CephMon, CephMgr, CephMDS, CephFS
20. ✅ MetricsServer
21. ✅ DiskDirectory, DiskLVM, DiskLVMThin, DiskZFS
22. ✅ PCIDevice, USBDevice
23. ✅ NotificationEndpoint, NotificationMatcher

## Currently Implemented Resources

### Compute
- **VirtualMachine** - Manage QEMU/KVM virtual machines
- **Container** - Manage LXC containers

### Storage
- **Storage** - Manage storage pools and volumes
- **StorageContent** - Upload/download ISOs, templates, backups

### Access Control
- **User** - Manage user accounts
- **Group** - Manage user groups
- **Role** - Manage permission roles
- **ACL** - Manage access control lists
- **APIToken** - Manage API tokens
- **AuthDomain** - Manage LDAP, AD, OpenID authentication domains

### Resource Management
- **Pool** - Manage resource pools

### Cluster Management
- **ClusterStatus** - Query cluster status and health
- **ClusterOptions** - Configure datacenter-wide options
- **ClusterResources** - Query cluster resource summary
- **ClusterJoin** - Join nodes to cluster

### Node Management
- **Node** - Query node status and metrics
- **NodeNetwork** - Manage network interfaces
- **NodeDNS** - Configure DNS settings
- **NodeHosts** - Manage /etc/hosts entries
- **NodeTime** - Configure time zone
- **NodeServices** - Manage system services
- **NodeSubscription** - Manage subscription status
- **NodeApt** - Manage APT repositories
- **NodeSyslog** - Query syslog entries

### VM Operations
- **VMSnapshot** - Manage VM snapshots
- **VMClone** - Clone virtual machines
- **VMTemplate** - Convert VMs to templates
- **VMMigrate** - Live/offline VM migration

### Container Operations
- **ContainerSnapshot** - Manage container snapshots
- **ContainerClone** - Clone containers
- **ContainerTemplate** - Convert containers to templates
- **ContainerMigrate** - Container migration

### SDN (Software Defined Networking)
- **SDNZone** - Manage SDN zones (VXLAN, EVPN, etc.)
- **SDNVNet** - Manage virtual networks
- **SDNSubnet** - Manage network subnets
- **SDNController** - Manage SDN controllers (BGP, EVPN)
- **SDNIPAM** - Manage IP address management
- **SDNDNS** - Manage DNS integration

### High Availability
- **HAGroup** - Manage HA failover groups
- **HAResource** - Manage HA resources

### Replication
- **ReplicationJob** - Manage replication jobs

### Firewall
- **FirewallClusterRule** - Manage cluster firewall rules
- **FirewallGroup** - Manage firewall security groups
- **FirewallAlias** - Manage IP/network aliases
- **FirewallIPSet** - Manage IP sets for rules
- **FirewallVMRule** - Manage VM-specific firewall rules
- **FirewallNodeRule** - Manage node-specific firewall rules

### Backup
- **BackupJob** - Manage scheduled backup jobs

### ACME/SSL
- **ACMEAccount** - Manage ACME/Let's Encrypt accounts
- **ACMEPlugin** - Manage ACME DNS plugins
- **Certificate** - Order/renew SSL certificates

### Ceph Storage
- **CephPool** - Manage Ceph storage pools
- **CephOSD** - Manage Ceph object storage daemons
- **CephMon** - Manage Ceph monitor daemons
- **CephMgr** - Manage Ceph manager daemons
- **CephMDS** - Manage Ceph metadata servers
- **CephFS** - Manage CephFS filesystems

### Disk Management
- **DiskDirectory** - Create directory storage on disks
- **DiskLVM** - Create LVM volume groups
- **DiskLVMThin** - Create LVM thin pools
- **DiskZFS** - Create ZFS storage pools

### Hardware Passthrough
- **PCIDevice** - Query PCI devices for passthrough
- **USBDevice** - Query USB devices for passthrough

### Notifications
- **NotificationEndpoint** - Manage notification endpoints (sendmail, SMTP, Gotify)
- **NotificationMatcher** - Manage notification routing rules

### Monitoring
- **MetricsServer** - Configure InfluxDB/Graphite metrics export

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
