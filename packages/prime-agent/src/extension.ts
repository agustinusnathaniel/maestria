// packages/prime-agent/src/extension.ts
// Prime Agent extension entry point (default-export factory).
//
// Compiled to `dist/extension.mjs` and declared in package.json under
// `pi.extensions`; Prime loads it with its extension loader (pinned fork
// 7787f07415d843b9a800f6a4720e0c739bd608e5, loader.ts: a jiti import of the
// declared path calling the default export with the live ExtensionAPI).
//
// Verified subset (public Prime/Pi extension API only, see src/pi-api.ts):
//   - slash commands /fein /sonar /blitz /mode-clear and /maestria-status
//   - before_agent_start mode prompt injection (systemPrompt chaining)
//   - session-scoped mode state via custom session entries, restored on
//     session_start (reload/resume/fork) and session_tree (branch navigation)
//
// NOT provided (explicitly deferred, documented in README/INSTALL/ADR-CORE-014):
// native recursive-subagent (`rlm`) dispatch - the pinned fork exposes no
// public JS extension bridge for it (it is an IPython-side tool) - and
// JSON/RPC headless mode integration. No tool interception is installed and no
// sandbox/enforcement claim is made. This extension writes no files (no
// `~/.pi`, no `.prime/agent` writes): state rides on host session entries.

import { resolve } from 'node:path';

import { createModePromptHandler, installCommands } from './modes.js';
import type { ExtensionAPI } from './pi-api.js';
import { createInitialState, restoreModeState } from './state.js';

/**
 * Resolve the package's generated `skills/` directory. When running from the
 * built `dist/extension.mjs`, this is `<packageRoot>/skills`; when running from
 * source (tests), it is the same package-relative location.
 */
function resolveSkillsDir(): string {
  const moduleDir = import.meta.dirname;
  return resolve(moduleDir, '../skills');
}

export default function (pi: ExtensionAPI): void {
  const state = createInitialState();
  const skillsDir = resolveSkillsDir();

  // Mode commands + status command (session-scoped state, persisted via
  // pi.appendEntry custom entries).
  installCommands(pi, state);

  // Mode prompt injection on the next agent turn.
  pi.on('before_agent_start', createModePromptHandler(state, skillsDir));

  // Restore the active mode when a session starts, is reloaded, resumed, or
  // forked, and when navigating the session tree to a different branch.
  pi.on('session_start', (_event, ctx) => {
    restoreModeState(state, ctx.sessionManager.getBranch());
  });

  pi.on('session_tree', (_event, ctx) => {
    restoreModeState(state, ctx.sessionManager.getBranch());
  });
}
