// packages/opencode/sync.config.ts
// Sync config: derives opencode agent files from canonical core directives

import type { SyncConfig } from '../core/scripts/lib/config.js';

export default {
  files: {
    'adventurer.md': {
      frontmatter: {
        description: `Codebase reconnaissance agent for deep code understanding.
Maps unknown territory - traces call chains, maps module relationships,
generates structured reports for downstream specialists.
Use for: understanding unfamiliar code, tracing dependencies, gathering
context before implementation, investigating module structures.
One role per session: exploration only - never implement or design.`,
        mode: 'subagent',
        permission: {
          bash: {
            '*': 'ask',
            // Read-only file operations
            'ls*': 'allow',
            'cat*': 'allow',
            'echo*': 'allow',
            'head*': 'allow',
            'tail*': 'allow',
            'grep*': 'allow',
            'rg*': 'allow',
            'wc*': 'allow',
            'which*': 'allow',
            'diff*': 'allow',
            'stat*': 'allow',
            'pwd*': 'allow',
            'cd*': 'allow',
            'find*': 'allow',
            'printf*': 'allow',
            // Git investigation
            'git log*': 'allow',
            'git diff*': 'allow',
            'git status*': 'allow',
            'git show*': 'allow',
            'git branch*': 'allow',
            'git rev-parse*': 'allow',
            'git remote*': 'allow',
            'git stash*': 'allow',
            'git config*': 'allow',
            // Package managers
            'pnpm*': 'allow',
            'npm*': 'allow',
            // Exploration tools
            'opensrc*': 'allow',
            'agent-browser*': 'allow',
            'rtk*': 'allow',
          },
          edit: 'deny',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          read: 'allow',
          skill: 'allow',
          todowrite: 'allow',
          webfetch: 'allow',
          websearch: 'ask',
        },
      },
    },
    'architect.md': {
      frontmatter: {
        description: `Architecture decisions using decision matrices and ADRs.
Evaluates options with weighted criteria, clarifies business context first.
Use for: technology choices, implementation approaches, trade-off analysis.`,
        mode: 'subagent',
        permission: {
          bash: {
            '*': 'ask',
            // Read-only file operations
            'ls*': 'allow',
            'cat*': 'allow',
            'echo*': 'allow',
            'head*': 'allow',
            'tail*': 'allow',
            'grep*': 'allow',
            'rg*': 'allow',
            'wc*': 'allow',
            'which*': 'allow',
            'diff*': 'allow',
            'stat*': 'allow',
            'pwd*': 'allow',
            'cd*': 'allow',
            'find*': 'allow',
            'printf*': 'allow',
            // Git operations
            'git diff*': 'allow',
            'git log*': 'allow',
            'git status*': 'allow',
            'git show*': 'allow',
            'git branch*': 'allow',
            // Package managers
            'opensrc*': 'allow',
            'pnpm*': 'allow',
            'npm*': 'allow',
            'npm view *': 'allow',
          },
          edit: 'deny',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          read: 'allow',
          skill: 'allow',
          webfetch: 'allow',
          websearch: 'ask',
        },
      },
    },
    'builder.md': {
      frontmatter: {
        description: `Focused implementation agent for atomic tasks.
Executes one verifiable unit of work with minimal context.
Use for: targeted fixes, feature implementation, refactors, adding tests.`,
        mode: 'subagent',
        permission: {
          bash: {
            // Read-only file operations (Claude Code baseline)
            'ls*': 'allow',
            'cat*': 'allow',
            'echo*': 'allow',
            'head*': 'allow',
            'tail*': 'allow',
            'grep*': 'allow',
            'rg*': 'allow',
            'wc*': 'allow',
            'which*': 'allow',
            'diff*': 'allow',
            'stat*': 'allow',
            'du*': 'allow',
            'pwd*': 'allow',
            'cd*': 'allow',
            'find*': 'allow',
            'printf*': 'allow',
            'test*': 'allow',
            'sort*': 'allow',
            // Git operations (autonomous commit protocol)
            'git*': 'allow',
            // Package manager (project uses pnpm; npm covered too)
            'pnpm*': 'allow',
            'npm*': 'allow',
            // pnpx/npx-like commands can execute arbitrary code; always ask
            'pnpx*': 'ask',
            // Build, test, lint tools
            'tsc*': 'allow',
            'vitest*': 'allow',
            'vp*': 'allow',
            'rtk*': 'allow',
            'eslint*': 'allow',
            'prettier*': 'allow',
            // Catch-all - unusual/dangerous commands still ask
            '*': 'ask',
          },
          edit: 'allow',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          read: 'allow',
          skill: 'allow',
          todowrite: 'allow',
          webfetch: 'allow',
        },
      },
    },
    'diagnose.md': {
      frontmatter: {
        description: `Systematic 6-step regression tracing.
From error message to root cause to prevention.
Use for: cryptic errors, regressions, production bugs.`,
        mode: 'subagent',
        permission: {
          bash: {
            // Read-only file operations
            'ls*': 'allow',
            'cat*': 'allow',
            'echo*': 'allow',
            'head*': 'allow',
            'tail*': 'allow',
            'grep*': 'allow',
            'rg*': 'allow',
            'wc*': 'allow',
            'which*': 'allow',
            'diff*': 'allow',
            'stat*': 'allow',
            'pwd*': 'allow',
            'cd*': 'allow',
            'find*': 'allow',
            'printf*': 'allow',
            // Git investigation (read-only and historical)
            'git status*': 'allow',
            'git diff*': 'allow',
            'git log*': 'allow',
            'git blame*': 'allow',
            'git show*': 'allow',
            // Environment inspection
            env: 'allow',
            pwd: 'allow',
            // Catch-all - unusual/dangerous commands still ask
            '*': 'ask',
          },
          edit: 'allow',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          read: 'allow',
          skill: 'allow',
          todowrite: 'allow',
          webfetch: 'allow',
          websearch: 'ask',
        },
      },
    },
    'planner.md': {
      frontmatter: {
        description: `Create detailed implementation plans with phased dependencies, timelines, and success criteria.
Breaks down complex features into verifiable milestones.
Use for: complex features requiring multi-phase execution, when the plan needs review before building.`,
        mode: 'subagent',
        permission: {
          bash: {
            '*': 'ask',
            // Read-only file operations
            'ls*': 'allow',
            'cat*': 'allow',
            'echo*': 'allow',
            'head*': 'allow',
            'tail*': 'allow',
            'grep*': 'allow',
            'rg*': 'allow',
            'wc*': 'allow',
            'which*': 'allow',
            'diff*': 'allow',
            'stat*': 'allow',
            'pwd*': 'allow',
            'cd*': 'allow',
            'find*': 'allow',
            'printf*': 'allow',
            // Git operations
            'git status*': 'allow',
            'git diff*': 'allow',
            'git log*': 'allow',
            'git show*': 'allow',
            'git branch*': 'allow',
            'git rev-parse*': 'allow',
            'mkdir*': 'allow',
            // Package managers
            'pnpm*': 'allow',
            'npm*': 'allow',
          },
          edit: 'ask',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          read: 'allow',
          skill: 'allow',
          todowrite: 'allow',
          webfetch: 'allow',
        },
      },
    },
    'reviewer.md': {
      frontmatter: {
        description: `Code review with quality gates.
Reviews code for correctness, edge cases, security, performance, maintainability,
and adherence to conventions. Provides specific, actionable feedback.
Use for: PR review, pre-commit review, architecture document review.`,
        mode: 'subagent',
        permission: {
          bash: {
            '*': 'ask',
            // Read-only file operations
            'ls*': 'allow',
            'cat*': 'allow',
            'echo*': 'allow',
            'head*': 'allow',
            'tail*': 'allow',
            'grep*': 'allow',
            'rg*': 'allow',
            'wc*': 'allow',
            'which*': 'allow',
            'diff*': 'allow',
            'stat*': 'allow',
            'pwd*': 'allow',
            'cd*': 'allow',
            'find*': 'allow',
            'printf*': 'allow',
            // Git operations
            'git status*': 'allow',
            'git diff*': 'allow',
            'git log*': 'allow',
            'git show*': 'allow',
            'git branch*': 'allow',
            'git rev-parse*': 'allow',
            // Package managers
            'pnpm*': 'allow',
            'npm*': 'allow',
            // Build, test, lint tools
            'vp*': 'allow',
            'rtk*': 'allow',
            'node*': 'allow',
          },
          edit: 'deny',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          read: 'allow',
          skill: 'allow',
          webfetch: 'allow',
        },
      },
    },
    'writer.md': {
      frontmatter: {
        description: `Documentation writing following structured patterns.
Creates clear, comprehensive docs for code, APIs, systems.
Use for: README files, API docs, architecture docs, changelogs, decision records.`,
        mode: 'subagent',
        permission: {
          bash: {
            '*': 'ask',
            // Read-only file operations
            'ls*': 'allow',
            'cat*': 'allow',
            'echo*': 'allow',
            'head*': 'allow',
            'tail*': 'allow',
            'grep*': 'allow',
            'rg*': 'allow',
            'wc*': 'allow',
            'which*': 'allow',
            'diff*': 'allow',
            'stat*': 'allow',
            'pwd*': 'allow',
            'cd*': 'allow',
            'find*': 'allow',
            'printf*': 'allow',
            // Git operations
            'git status*': 'allow',
            'git diff*': 'allow',
            'git log*': 'allow',
            'git show*': 'allow',
            'git branch*': 'allow',
            'git rev-parse*': 'allow',
            // Package managers
            'pnpm*': 'allow',
            'npm*': 'allow',
            'npm view *': 'allow',
            // Build, test, lint tools
            'vp*': 'allow',
            'mkdir*': 'allow',
          },
          edit: 'allow',
          glob: 'allow',
          grep: 'allow',
          lsp: 'allow',
          read: 'allow',
          skill: 'allow',
          todowrite: 'allow',
          webfetch: 'allow',
        },
      },
    },
    'orchestrator.md': {
      frontmatter: {
        description: `Manager agent for complex multi-step tasks.
Breaks down work, delegates to specialists, integrates results.
Use for: multi-file features, cross-domain tasks, 3+ step workflows.`,
        mode: 'all',
        permission: {
          bash: {
            '*': 'deny',
            '* npx --yes skills@latest *': 'allow',
          },
          edit: 'deny',
          glob: 'deny',
          grep: 'deny',
          lsp: 'deny',
          question: 'allow',
          read: 'deny',
          skill: 'allow',
          task: {
            '*': 'deny',
            adventurer: 'allow',
            architect: 'allow',
            builder: 'allow',
            diagnose: 'allow',
            planner: 'allow',
            reviewer: 'allow',
            writer: 'allow',
          },
          todowrite: 'allow',
          webfetch: 'deny',
        },
      },
    },
    // NOTE: no body `replace` ops for orchestrator.md. The previous seven
    // body replaces anchored to canonical sentences removed in earlier
    // directive revisions and silently no-op'd (split/join never matches);
    // the canonical orchestrator body is already platform-neutral.
    'commands/fein.md': {
      output: 'commands/fein.md',
      stripFrontmatter: true,
    },
    'commands/sonar.md': {
      output: 'commands/sonar.md',
      stripFrontmatter: true,
    },
    'commands/blitz.md': {
      output: 'commands/blitz.md',
      stripFrontmatter: true,
    },
    'rules.md': {
      output: '../rules/AGENTS.md',
      // NOTE: no replace ops. The previous generic-vocabulary renames
      // ("repo cloning tool", "URL fetch", "web search", ...) anchored to
      // canonical sentences that no longer exist; the canonical rules body
      // is already tool-neutral.
    },
  },
  output: 'agents',
  source: '../core/agent-directives/specialists',
} satisfies SyncConfig;
