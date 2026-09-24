/**
 * Block dangerous git commands.
 *
 * Enforces docs/code-standards.md "Working mode": the agent must not merge,
 * rebase, push, or reset a shared branch (or otherwise destroy history/worktree)
 * without an explicit instruction. Convention alone did not hold — this makes it
 * a hard gate at the tool boundary. In an interactive session the human is asked
 * to confirm; with no UI the command is blocked outright.
 *
 * `git commit` is a softer, second category: a *review gate*, not history
 * destruction. The human wants to eyeball every diff before it is committed —
 * even on a working branch, per .pi/prompts/branch-hitl.md. A review needs a
 * human, so a commit only prompts when there is a UI; with no UI (background /
 * AFK subagents, e.g. the research flow committing to a throwaway branch) it is
 * allowed through rather than blocked outright.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

// History/worktree destruction: confirm with a human, block outright with no UI.
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

// Review gate: confirm with a human when there is a UI; allow with no UI.
const REVIEW_PATTERNS: RegExp[] = [/\bgit\s+commit\b/i];

// biome-ignore lint/style/noDefaultExport: pi loads an extension by its default-exported factory.
export default function (pi: ExtensionAPI) {
  pi.on('tool_call', async (event, ctx) => {
    if (event.toolName !== 'bash') return undefined;

    const command = String(event.input.command ?? '');

    const dangerous = DANGEROUS_PATTERNS.find((p) => p.test(command));
    if (dangerous) {
      if (!ctx.hasUI) {
        return {
          block: true,
          reason: `Blocked dangerous git command (no UI to confirm): matches ${dangerous}. Ask the human to run it, or to approve it in an interactive session.`,
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
    }

    const review = REVIEW_PATTERNS.find((p) => p.test(command));
    if (review) {
      // No human present to review — let background / AFK agents commit.
      if (!ctx.hasUI) return undefined;

      const choice = await ctx.ui.select(
        `📝 Commit — review the diff first (branch-hitl):\n\n  ${command}\n\nCommit now?`,
        ['No', 'Yes'],
      );

      if (choice !== 'Yes') {
        return { block: true, reason: 'Blocked by human — review the diff before committing.' };
      }
    }

    return undefined;
  });
}
