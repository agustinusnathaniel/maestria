import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vite-plus/test';

import {
  codexManagedAgentFileName,
  codexManagedAgentName,
  mergeCodexAgentSettings,
  parseCodexTopLevelString,
  setCodexTopLevelString,
} from '@/lib/codex-agent-files.js';

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

  it('preserves runtime settings outside the instructions in all generated profiles', async () => {
    const profiles = await Promise.all(
      ['adventurer', 'architect', 'builder', 'reviewer'].map(async (agent) => ({
        agent,
        bundled: await readFile(
          new URL(`../../../packages/agent-plugins/agents/maestria-${agent}.toml`, import.meta.url),
          'utf-8',
        ),
      })),
    );
    for (const { agent, bundled } of profiles) {
      const settings =
        'model = "gpt-6-luna"\nmodel_reasoning_effort = "high"\nservice_tier = "fast"\n';
      for (const existing of [settings + bundled, bundled + settings]) {
        const next = mergeCodexAgentSettings(bundled, existing);
        expect(next, agent).toContain(bundled);
        expect(next, agent).toContain(settings);
        expect(parseCodexTopLevelString(next, 'model'), agent).toBe('gpt-6-luna');
        expect(parseCodexTopLevelString(next, 'model_reasoning_effort'), agent).toBe('high');
      }
    }
  });

  it('ignores settings and table headings inside basic and literal multiline strings', () => {
    const content = [
      'developer_instructions = """',
      'model = "prompt-only"',
      '[Entry]',
      String.raw`Escaped closing quotes: \""" and an escaped slash: \\`,
      '""" # prompt comment',
      "notes = '''",
      "model = 'also-prompt-only'",
      '[Another heading]',
      "'''",
      'model = "real/model" # selected model',
      '[tools]',
      'model = "table-only"',
      '',
    ].join('\n');

    expect(parseCodexTopLevelString(content, 'model')).toBe('real/model');
    const next = setCodexTopLevelString(content, 'model', 'updated/model');
    expect(next).toBe(content.replace('model = "real/model"', 'model = "updated/model"'));
    expect(setCodexTopLevelString(content, 'model', undefined)).toBe(
      content.replace('model = "real/model" # selected model\n', ''),
    );
    const promptOnly = content.replace('model = "real/model" # selected model\n', '');
    expect(parseCodexTopLevelString(promptOnly, 'model')).toBeUndefined();
    expect(setCodexTopLevelString(promptOnly, 'model', 'new/model')).toBe(
      promptOnly.replace('[tools]', 'model = "new/model"\n[tools]'),
    );
  });

  it('skips multiline array values and comments when finding the root table boundary', () => {
    const content = [
      '# triple quotes in comments: """',
      'examples = [',
      '  """',
      'model = "example-only"',
      '[Example table]',
      '  """,',
      '  ["nested"], # comment with triple quotes: """',
      ']',
      'label = "literal # hash with \\\" quote"',
      'model = "real/#model" # retain this comment',
      '',
      '[[tools]]',
      'model = "tool-only"',
    ].join('\r\n');

    expect(parseCodexTopLevelString(content, 'model')).toBe('real/#model');
    expect(setCodexTopLevelString(content, 'model', 'new/#model')).toBe(
      content.replace('model = "real/#model"', 'model = "new/#model"'),
    );
    expect(setCodexTopLevelString(content, 'model_reasoning_effort', 'high')).toBe(
      content.replace('[[tools]]', 'model_reasoning_effort = "high"\r\n[[tools]]'),
    );
  });

  it('replaces complete multiline settings and preserves their trailing comments', () => {
    const content = 'model = """\nold/model""" # user choice\nservice_tier = "fast"\n';
    expect(parseCodexTopLevelString(content, 'model')).toBe('old/model');
    expect(setCodexTopLevelString(content, 'model', 'new/model')).toBe(
      'model = "new/model" # user choice\nservice_tier = "fast"\n',
    );
    expect(setCodexTopLevelString(content, 'model', undefined)).toBe('service_tier = "fast"\n');
    expect(parseCodexTopLevelString('model = "quoted # model" # comment\n', 'model')).toBe(
      'quoted # model',
    );
    expect(setCodexTopLevelString('model = "quoted # model" # comment\n', 'model', 'new')).toBe(
      'model = "new" # comment\n',
    );
  });

  it('reads TOML string forms and changes quoted root keys without touching their formatting', () => {
    const content = [
      '"model"  = """',
      `${String.raw`gpt\u002D6\U0000002Dluna`}\\`,
      '    """ # selected model',
      "'service_tier' = '''fast''' # selected tier",
      '',
    ].join('\n');
    expect(parseCodexTopLevelString(content, 'model')).toBe('gpt-6-luna');
    expect(parseCodexTopLevelString(content, 'service_tier')).toBe('fast');
    expect(setCodexTopLevelString(content, 'model', 'new/model')).toBe(
      "\"model\"  = \"new/model\" # selected model\n'service_tier' = '''fast''' # selected tier\n",
    );
  });
});
