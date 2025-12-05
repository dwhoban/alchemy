import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createProxmoxClient, type ProxmoxApiOptions } from "./client.ts";

/**
 * Properties for creating a Node Firewall Rule
 */
export interface FirewallNodeRuleProps extends ProxmoxApiOptions {
  /**
   * Node name
   */
  node: string;

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
   * Log level
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
 * Output returned after FirewallNodeRule creation
 */
export interface FirewallNodeRule {
  /**
   * The Alchemy resource ID
   */
  id: string;

  /**
   * Node name
   */
  node: string;

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
 * Type guard to check if a resource is a FirewallNodeRule
 */
export function isFirewallNodeRule(
  resource: unknown,
): resource is FirewallNodeRule {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "proxmox::FirewallNodeRule"
  );
}

/**
 * Creates and manages a Proxmox Node Firewall Rule.
 *
 * @example
 * ## Allow Proxmox web UI access
 *
 * Create a rule to allow web UI:
 *
 * ```ts
 * import { FirewallNodeRule } from "alchemy/proxmox";
 *
 * const rule = await FirewallNodeRule("allow-webui", {
 *   node: "pve",
 *   action: "ACCEPT",
 *   type: "in",
 *   proto: "tcp",
 *   dport: "8006",
 *   comment: "Allow Proxmox web UI",
 * });
 * ```
 *
 * @example
 * ## Allow SSH to node
 *
 * Create a rule for SSH access:
 *
 * ```ts
 * import { FirewallNodeRule } from "alchemy/proxmox";
 *
 * const rule = await FirewallNodeRule("allow-ssh", {
 *   node: "pve",
 *   action: "ACCEPT",
 *   type: "in",
 *   proto: "tcp",
 *   dport: "22",
 *   source: "192.168.1.0/24",
 *   comment: "Allow SSH from internal network",
 * });
 * ```
 */
export const FirewallNodeRule = Resource(
  "proxmox::FirewallNodeRule",
  async function (
    this: Context<FirewallNodeRule>,
    id: string,
    props: FirewallNodeRuleProps,
  ): Promise<FirewallNodeRule> {
    const client = await createProxmoxClient(props);
    const { node } = props;

    switch (this.phase) {
      case "delete": {
        if (props.delete !== false && this.output?.pos !== undefined) {
          try {
            await client.nodes
              .$(node)
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
          .firewall.rules.$post(
            createParams as Parameters<
              (typeof client.nodes.$get)[0]["firewall"]["rules"]["$post"]
            >[0],
          );

        return fetchNodeRuleInfo(client, id, node, props);
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
            .firewall.rules.$(this.output.pos)
            .$put(
              updateParams as Parameters<
                (typeof client.nodes.$get)[0]["firewall"]["rules"]["$get"][0]["$put"]
              >[0],
            );
        }

        return fetchNodeRuleInfo(client, id, node, props);
      }
    }
  },
);

/**
 * Fetch node firewall rule information
 * @internal
 */
async function fetchNodeRuleInfo(
  client: Awaited<ReturnType<typeof createProxmoxClient>>,
  id: string,
  node: string,
  props: FirewallNodeRuleProps,
): Promise<FirewallNodeRule> {
  const rules = await client.nodes.$(node).firewall.rules.$get();
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
