import { describe, expect, it } from 'vite-plus/test';
import {
  codexManagedAgentFileName,
  codexManagedAgentName,
  mergeCodexAgentSettings,
  parseCodexTopLevelString,
  setCodexTopLevelString,
} from '../src/lib/codex-agent-files.js';

describe('Codex native agent files', () => {
  it('uses a collision-resistant native role name', () => {
    expect(codexManagedAgentName('builder')).toBe('maestria-builder');
    expect(codexManagedAgentFileName('builder')).toBe('maestria-builder.toml');
  });

  it('reads and edits only top-level TOML settings', () => {
    const content = [
      'name = "maestria-builder"',
      'model = "old/model" # user choice',
      '',
      '[mcp_servers.docs]',
      'url = "https://example.test/mcp"',
      'model = "not-a-role-model"',
      '',
    ].join('\n');

    expect(parseCodexTopLevelString(content, 'model')).toBe('old/model');
    const next = setCodexTopLevelString(content, 'model_reasoning_effort', 'high');
    expect(next).toContain('model_reasoning_effort = "high"');
    expect(next).toContain('model = "not-a-role-model"');
  });

  it('refreshes managed instructions while preserving user runtime settings', () => {
    const bundled = [
      'name = "maestria-reviewer"',
      'description = "new description"',
      'developer_instructions = "new instructions"',
      'sandbox_mode = "read-only"',
      '',
    ].join('\n');
    const existing = [
      'name = "maestria-reviewer"',
      'description = "old description"',
      'developer_instructions = "old instructions"',
      'model = "gpt-5.6-terra"',
      'model_reasoning_effort = "high"',
      'service_tier = "fast"',
      '',
    ].join('\n');

    const next = mergeCodexAgentSettings(bundled, existing);
    expect(next).toContain('description = "new description"');
    expect(next).toContain('developer_instructions = "new instructions"');
    expect(next).toContain('model = "gpt-5.6-terra"');
    expect(next).toContain('model_reasoning_effort = "high"');
    expect(next).toContain('service_tier = "fast"');
    expect(next).not.toContain('old instructions');
  });
});
