/**
 * Block dangerous git commands.
 *
 * Enforces docs/code-standards.md "Working mode": the agent must not merge,
 * rebase, push, or reset a shared branch (or otherwise destroy history/worktree)
 * without an explicit instruction. Convention alone did not hold — this makes it
 * a hard gate at the tool boundary. In an interactive session the human is asked
 * to confirm; with no UI the command is blocked outright.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const DANGEROUS_PATTERNS: RegExp[] = [
  /\bgit\s+push\b/i,
  /\bgit\s+merge(?![\w-])/i,
  /\bgit\s+rebase\b/i,
  /\bgit\s+reset\b/i,
  /\bgit\s+clean\s+-[a-z]*f/i,
  /\bgit\s+branch\s+-D\b/i,
  /\bgit\s+checkout\s+\./i,
  /\bgit\s+restore\s+\./i,
  /--force\b/i,
];

// biome-ignore lint/style/noDefaultExport: pi loads an extension by its default-exported factory.
export default function (pi: ExtensionAPI) {
  pi.on('tool_call', async (event, ctx) => {
    if (event.toolName !== 'bash') return undefined;

    const command = String(event.input.command ?? '');
    const hit = DANGEROUS_PATTERNS.find((p) => p.test(command));
    if (!hit) return undefined;

    if (!ctx.hasUI) {
      return {
        block: true,
        reason: `Blocked dangerous git command (no UI to confirm): matches ${hit}. Ask the human to run it, or to approve it in an interactive session.`,
      };
    }

    const choice = await ctx.ui.select(
      `⚠️ Dangerous git command (shared-branch / history / worktree):\n\n  ${command}\n\nRun it?`,
      ['No', 'Yes'],
    );

    if (choice !== 'Yes') {
      return { block: true, reason: 'Blocked by human.' };
    }

    return undefined;
  });
}
