import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Firewall rule action type
 */
export type FirewallAction = "ACCEPT" | "DROP" | "REJECT";

/**
 * Firewall rule direction
 */
export type FirewallDirection = "IN" | "OUT" | "GROUP";

/**
 * Firewall rule type
 */
export type FirewallRuleType = "in" | "out" | "group";

/**
 * Properties for creating or updating a cluster-level Firewall Rule
 */
export interface FirewallClusterRuleProps extends ProxmoxApiOptions {
  /**
   * Rule action (ACCEPT, DROP, REJECT)
   */
  action: FirewallAction;

  /**
   * Rule type (in, out, group)
   */
  type: FirewallRuleType;

  /**
   * Enable/disable the rule
   * @default true
   */
  enable?: boolean;

  /**
   * Source address/network (CIDR or alias)
   */
  source?: string;

  /**
   * Destination address/network (CIDR or alias)
   */
  dest?: string;

  /**
   * Protocol (tcp, udp, icmp, etc.)
   */
  proto?: string;

  /**
   * Destination port(s) (e.g., '22', '80,443', '1024:65535')
   */
  dport?: string;

  /**
   * Source port(s)
   */
  sport?: string;

  /**
   * Rule comment
   */
  comment?: string;

  /**
   * Log level (emerg, alert, crit, err, warning, notice, info, debug, nolog)
   */
  log?: string;

  /**
   * ICMP type (for icmp protocol)
   */
  icmpType?: string;

  /**
   * Interface name
   */
  iface?: string;

  /**
   * Security group (for type=group)
   */
  macro?: string;

  /**
   * Rule position (0-based)
   */
  pos?: number;

  /**
   * Whether to delete the rule when the resource is destroyed
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after FirewallClusterRule creation/update
 */
export interface FirewallClusterRule {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Rule position
   */
  pos: number;

  /**
   * Rule action
   */
  action: FirewallAction;

  /**
   * Rule type
   */
  type: FirewallRuleType;

  /**
   * Whether rule is enabled
   */
  enable: boolean;

  /**
   * Source address
   */
  source?: string;

  /**
   * Destination address
   */
  dest?: string;

  /**
   * Protocol
   */
  proto?: string;

  /**
   * Destination port(s)
   */
  dport?: string;

  /**
   * Source port(s)
   */
  sport?: string;

  /**
   * Rule comment
   */
  comment?: string;

  /**
   * Log level
   */
  log?: string;

  /**
   * Interface name
   */
  iface?: string;

  /**
   * Security group/macro
   */
  macro?: string;
}

/**
 * Type guard to check if a resource is a FirewallClusterRule
 */
export function isFirewallClusterRule(
  resource: unknown,
): resource is FirewallClusterRule {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::FirewallClusterRule"
  );
}

/**
 * Creates and manages a Proxmox Cluster-level Firewall Rule.
 *
 * @example
 * ## Allow SSH access
 *
 * Create a rule to allow SSH from specific network:
 *
 * ```ts
 * import { FirewallClusterRule } from "alchemy/proxmox";
 *
 * const rule = await FirewallClusterRule("allow-ssh", {
 *   action: "ACCEPT",
 *   type: "in",
 *   source: "10.0.0.0/8",
 *   proto: "tcp",
 *   dport: "22",
 *   comment: "Allow SSH from internal network",
 * });
 * ```
 *
 * @example
 * ## Block all external traffic
 *
 * Create a rule to drop external traffic:
 *
 * ```ts
 * import { FirewallClusterRule } from "alchemy/proxmox";
 *
 * const rule = await FirewallClusterRule("drop-external", {
 *   action: "DROP",
 *   type: "in",
 *   source: "0.0.0.0/0",
 *   comment: "Drop all external traffic by default",
 * });
 * ```
 *
 * @example
 * ## Allow web traffic
 *
 * Create rules for HTTP/HTTPS:
 *
 * ```ts
 * import { FirewallClusterRule } from "alchemy/proxmox";
 *
 * const rule = await FirewallClusterRule("allow-web", {
 *   action: "ACCEPT",
 *   type: "in",
 *   proto: "tcp",
 *   dport: "80,443",
 *   comment: "Allow HTTP and HTTPS",
 * });
 * ```
 */
export const FirewallClusterRule = Resource(
  "proxmox::FirewallClusterRule",
  async function (
    this: Context<FirewallClusterRule>,
    id: string,
    props: FirewallClusterRuleProps,
  ): Promise<FirewallClusterRule> {
    const client = await createProxmoxClient(props);

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.pos !== undefined) {
          try {
            await client.cluster.firewall.rules
              .$(this.output.pos)
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
        const createParams = buildFirewallParams(props);

        await client.cluster.firewall.rules.$post(
          createParams as Parameters<
            typeof client.cluster.firewall.rules.$post
          >[0],
        );

        // Find the newly created rule by matching properties
        const rules = await client.cluster.firewall.rules.$get();
        const newRule = findMatchingRule(
          rules as Array<Record<string, unknown>>,
          props,
        );

        const pos = newRule?.pos ?? props.pos ?? 0;

        return buildFirewallOutput(id, pos, props, newRule);
      }

      case "update": {
        const updateParams = buildFirewallParams(props);
        const pos = this.output?.pos ?? props.pos ?? 0;

        await client.cluster.firewall.rules
          .$(pos)
          .$put(
            updateParams as Parameters<
              (typeof client.cluster.firewall.rules.$get)[0]["$put"]
            >[0],
          );

        const rules = await client.cluster.firewall.rules.$get();
        const updatedRule = (rules as Array<Record<string, unknown>>).find(
          (r) => r.pos === pos,
        );

        return buildFirewallOutput(id, pos, props, updatedRule);
      }
    }
  },
);

/**
 * Build firewall rule parameters
 * @internal
 */
function buildFirewallParams(
  props: FirewallClusterRuleProps,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    action: props.action,
    type: props.type,
  };

  if (props.enable !== undefined) params.enable = props.enable ? 1 : 0;
  if (props.source) params.source = props.source;
  if (props.dest) params.dest = props.dest;
  if (props.proto) params.proto = props.proto;
  if (props.dport) params.dport = props.dport;
  if (props.sport) params.sport = props.sport;
  if (props.comment) params.comment = props.comment;
  if (props.log) params.log = props.log;
  if (props.icmpType) params["icmp-type"] = props.icmpType;
  if (props.iface) params.iface = props.iface;
  if (props.macro) params.macro = props.macro;
  if (props.pos !== undefined) params.pos = props.pos;

  return params;
}

/**
 * Find a matching rule in the rules list
 * @internal
 */
function findMatchingRule(
  rules: Array<Record<string, unknown>>,
  props: FirewallClusterRuleProps,
): Record<string, unknown> | undefined {
  return rules.find(
    (r) =>
      r.action === props.action &&
      r.type === props.type &&
      (r.source ?? "") === (props.source ?? "") &&
      (r.dest ?? "") === (props.dest ?? "") &&
      (r.proto ?? "") === (props.proto ?? "") &&
      (r.dport ?? "") === (props.dport ?? ""),
  );
}

/**
 * Build firewall rule output
 * @internal
 */
function buildFirewallOutput(
  id: string,
  pos: number,
  props: FirewallClusterRuleProps,
  ruleInfo?: Record<string, unknown>,
): FirewallClusterRule {
  return {
    id,
    pos: (ruleInfo?.pos as number) ?? pos,
    action: (ruleInfo?.action as FirewallAction) ?? props.action,
    type: (ruleInfo?.type as FirewallRuleType) ?? props.type,
    enable: ruleInfo ? Boolean(ruleInfo.enable) : props.enable !== false,
    source: (ruleInfo?.source as string) ?? props.source,
    dest: (ruleInfo?.dest as string) ?? props.dest,
    proto: (ruleInfo?.proto as string) ?? props.proto,
    dport: (ruleInfo?.dport as string) ?? props.dport,
    sport: (ruleInfo?.sport as string) ?? props.sport,
    comment: (ruleInfo?.comment as string) ?? props.comment,
    log: (ruleInfo?.log as string) ?? props.log,
    iface: (ruleInfo?.iface as string) ?? props.iface,
    macro: (ruleInfo?.macro as string) ?? props.macro,
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
