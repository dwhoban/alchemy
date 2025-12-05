import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating a VM Firewall Rule
 */
export interface FirewallVMRuleProps extends ProxmoxApiOptions {
  /**
   * Node name where the VM is located
   */
  node: string;

  /**
   * VM ID
   */
  vmid: number;

  /**
   * Rule action (ACCEPT, DROP, REJECT)
   */
  action: "ACCEPT" | "DROP" | "REJECT";

  /**
   * Rule type (in, out, group)
   */
  type: "in" | "out" | "group";

  /**
   * Rule position (optional, added at end if not specified)
   */
  pos?: number;

  /**
   * Enable the rule
   * @default true
   */
  enable?: boolean;

  /**
   * Source address (CIDR, alias, or IPSet)
   */
  source?: string;

  /**
   * Destination address (CIDR, alias, or IPSet)
   */
  dest?: string;

  /**
   * Protocol (tcp, udp, icmp, etc.)
   */
  proto?: string;

  /**
   * Source port or port range
   */
  sport?: string;

  /**
   * Destination port or port range
   */
  dport?: string;

  /**
   * Network interface
   */
  iface?: string;

  /**
   * Log level (emerg, alert, crit, err, warning, notice, info, debug, nolog)
   */
  log?: string;

  /**
   * ICMP type
   */
  icmp_type?: string;

  /**
   * Macro name (predefined rule templates)
   */
  macro?: string;

  /**
   * Rule comment
   */
  comment?: string;

  /**
   * Whether to delete the rule when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after FirewallVMRule creation
 */
export interface FirewallVMRule {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

  /**
   * VM ID
   */
  vmid: number;

  /**
   * Rule position
   */
  pos: number;

  /**
   * Rule action
   */
  action: string;

  /**
   * Rule type
   */
  type: string;

  /**
   * Whether the rule is enabled
   */
  enable: boolean;

  /**
   * Rule comment
   */
  comment?: string;
}

/**
 * Type guard to check if a resource is a FirewallVMRule
 */
export function isFirewallVMRule(
  resource: unknown,
): resource is FirewallVMRule {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::FirewallVMRule"
  );
}

/**
 * Creates and manages a Proxmox VM Firewall Rule.
 *
 * @example
 * ## Allow SSH access
 *
 * Create a rule to allow SSH:
 *
 * ```ts
 * import { FirewallVMRule } from "alchemy/proxmox";
 *
 * const rule = await FirewallVMRule("allow-ssh", {
 *   node: "pve",
 *   vmid: 100,
 *   action: "ACCEPT",
 *   type: "in",
 *   proto: "tcp",
 *   dport: "22",
 *   comment: "Allow SSH access",
 * });
 * ```
 *
 * @example
 * ## Allow web traffic
 *
 * Create rules for HTTP/HTTPS:
 *
 * ```ts
 * import { FirewallVMRule } from "alchemy/proxmox";
 *
 * const httpRule = await FirewallVMRule("allow-http", {
 *   node: "pve",
 *   vmid: 100,
 *   action: "ACCEPT",
 *   type: "in",
 *   proto: "tcp",
 *   dport: "80,443",
 *   comment: "Allow HTTP/HTTPS",
 * });
 * ```
 *
 * @example
 * ## Use a macro
 *
 * Use predefined macro rules:
 *
 * ```ts
 * import { FirewallVMRule } from "alchemy/proxmox";
 *
 * const rule = await FirewallVMRule("allow-ping", {
 *   node: "pve",
 *   vmid: 100,
 *   action: "ACCEPT",
 *   type: "in",
 *   macro: "Ping",
 *   comment: "Allow ICMP ping",
 * });
 * ```
 */
export const FirewallVMRule = Resource(
  "proxmox::FirewallVMRule",
  async function (
    this: Context<FirewallVMRule>,
    id: string,
    props: FirewallVMRuleProps,
  ): Promise<FirewallVMRule> {
    const client = await createProxmoxClient(props);
    const { node, vmid } = props;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.pos !== undefined) {
          try {
            await client.nodes
              .$(node)
              .qemu.$(vmid)
              .firewall.rules.$(this.output.pos)
              .$delete();
          } catch (error: unknown) {
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        }
        return this.destroy();
      }

      case "create": {
        const createParams: Record<string, unknown> = {
          action: props.action,
          type: props.type,
        };

        if (props.pos !== undefined) createParams.pos = props.pos;
        if (props.enable !== undefined)
          createParams.enable = props.enable ? 1 : 0;
        if (props.source) createParams.source = props.source;
        if (props.dest) createParams.dest = props.dest;
        if (props.proto) createParams.proto = props.proto;
        if (props.sport) createParams.sport = props.sport;
        if (props.dport) createParams.dport = props.dport;
        if (props.iface) createParams.iface = props.iface;
        if (props.log) createParams.log = props.log;
        if (props.icmp_type) createParams.icmp_type = props.icmp_type;
        if (props.macro) createParams.macro = props.macro;
        if (props.comment) createParams.comment = props.comment;

        await client.nodes
          .$(node)
          .qemu.$(vmid)
          .firewall.rules.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["qemu"]["$get"][0]["firewall"]["rules"]["$post"]
            >[0],
          );

        return fetchVMRuleInfo(client, id, node, vmid, props);
      }

      case "update": {
        if (this.output?.pos !== undefined) {
          const updateParams: Record<string, unknown> = {};

          if (props.action) updateParams.action = props.action;
          if (props.enable !== undefined)
            updateParams.enable = props.enable ? 1 : 0;
          if (props.source) updateParams.source = props.source;
          if (props.dest) updateParams.dest = props.dest;
          if (props.proto) updateParams.proto = props.proto;
          if (props.sport) updateParams.sport = props.sport;
          if (props.dport) updateParams.dport = props.dport;
          if (props.iface) updateParams.iface = props.iface;
          if (props.log) updateParams.log = props.log;
          if (props.comment) updateParams.comment = props.comment;

          await client.nodes
            .$(node)
            .qemu.$(vmid)
            .firewall.rules.$(this.output.pos)
            .$put(
              updateParams as Parameters<
                (typeof client.nodes.$get)[0]["qemu"]["$get"][0]["firewall"]["rules"]["$get"][0]["$put"]
              >[0],
            );
        }

        return fetchVMRuleInfo(client, id, node, vmid, props);
      }
    }
  },
);

/**
 * Fetch VM firewall rule information
 * @internal
 */
async function fetchVMRuleInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
  vmid: number,
  props: FirewallVMRuleProps,
): Promise<FirewallVMRule> {
  const rules = await client.nodes.$(node).qemu.$(vmid).firewall.rules.$get();
  const rulesArray = rules as Array<Record<string, unknown>>;

  // Find rule by matching properties
  const ruleInfo = rulesArray.find(
    (r) => r.action === props.action && r.type === props.type,
  );

  const pos =
    props.pos ?? (ruleInfo?.pos as number | undefined) ?? rulesArray.length - 1;

  return {
    id,
    node,
    vmid,
    pos,
    action: (ruleInfo?.action as string) ?? props.action,
    type: (ruleInfo?.type as string) ?? props.type,
    enable: ruleInfo?.enable !== 0,
    comment: (ruleInfo?.comment as string) ?? props.comment,
  };
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
