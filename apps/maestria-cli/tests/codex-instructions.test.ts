import { describe, expect, it } from 'vite-plus/test';
import {
  CODEX_MANAGED_INSTRUCTIONS_END,
  CODEX_MANAGED_INSTRUCTIONS_START,
  removeCodexManagedInstructions,
  upsertCodexManagedInstructions,
} from '@/lib/codex-instructions.js';

const BLOCK = `${CODEX_MANAGED_INSTRUCTIONS_START}\nmanaged\n${CODEX_MANAGED_INSTRUCTIONS_END}`;

describe('Codex managed orchestration instructions', () => {
  it('appends and refreshes one managed block without duplicating it', () => {
    const existing = '# User instructions\n';
    const installed = upsertCodexManagedInstructions(existing, BLOCK);
    expect(installed).toContain('# User instructions');
    expect(installed.match(/maestria:codex-orchestrator:start/g)).toHaveLength(1);
    expect(upsertCodexManagedInstructions(installed, `${BLOCK}\nupdated`)).toContain('managed');
    expect(
      upsertCodexManagedInstructions(installed, `${BLOCK}\nupdated`).match(
        /maestria:codex-orchestrator:start/g,
      ),
    ).toHaveLength(1);
  });

  it('removes only the managed block and restores the surrounding content', () => {
    const existing = '# User instructions\n';
    const installed = upsertCodexManagedInstructions(existing, BLOCK);
    expect(removeCodexManagedInstructions(installed)).toBe(existing);
  });

  it('rejects malformed or duplicated markers', () => {
    expect(() => {
      return upsertCodexManagedInstructions(`${CODEX_MANAGED_INSTRUCTIONS_START}\n`, BLOCK);
    }).toThrow(/malformed|duplicated/i);
    expect(() => {
      return upsertCodexManagedInstructions(`${BLOCK}\n${BLOCK}`, BLOCK);
    }).toThrow(/malformed|duplicated/i);
  });
});
