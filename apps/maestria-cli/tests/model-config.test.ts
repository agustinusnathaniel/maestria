import { describe, it, expect } from 'vite-plus/test';
import {
  parseOpenCodeModels,
  parsePiModels,
  parseOmpModels,
  parseFrontmatterModel,
  setFrontmatterModel,
  setConfigModelJsonc,
  parseConfigModels,
  parseCursorModels,
  parseCodexAgentModel,
  setCodexAgentModel,
  createCodexAgentConfig,
} from '../src/lib/model-config.js';

describe('parseOpenCodeModels', () => {
  it('parses provider/model lines', () => {
    const out = [
      'opencode/big-pickle',
      'opencode/claude-haiku-4-5',
      'opencode-zen/gpt-5.4-nano',
      '',
      '  opencode-go/deepseek-v4-flash  ',
    ].join('\n');
    expect(parseOpenCodeModels(out)).toEqual([
      'opencode/big-pickle',
      'opencode/claude-haiku-4-5',
      'opencode-zen/gpt-5.4-nano',
      'opencode-go/deepseek-v4-flash',
    ]);
  });

  it('filters out non-model lines', () => {
    expect(parseOpenCodeModels('usage: opencode models\n\nlocal models:\n')).toEqual([]);
  });
});

describe('parsePiModels', () => {
  it('parses the table and skips the header', () => {
    const out = [
      'provider     model              context  max-out  thinking  images',
      'opencode-go  deepseek-v4-flash  1M       384K     yes       no    ',
      'opencode-go  glm-5.2            1M       131.1K   yes       no    ',
      '',
    ].join('\n');
    expect(parsePiModels(out)).toEqual(['opencode-go/deepseek-v4-flash', 'opencode-go/glm-5.2']);
  });
});

describe('parseOmpModels', () => {
  it('maps the selector field', () => {
    const out = JSON.stringify({
      models: [
        {
          provider: 'opencode-go',
          id: 'deepseek-v4-flash',
          selector: 'opencode-go/deepseek-v4-flash',
        },
        { provider: 'opencode-zen', id: 'gpt-5.2', selector: 'opencode-zen/gpt-5.2' },
        { provider: 'x', id: 'y' },
      ],
    });
    expect(parseOmpModels(out)).toEqual(['opencode-go/deepseek-v4-flash', 'opencode-zen/gpt-5.2']);
  });

  it('returns [] on invalid JSON', () => {
    expect(parseOmpModels('not json')).toEqual([]);
  });
});

describe('parseCursorModels', () => {
  it('parses current human-readable model output and removes duplicates', () => {
    const out = [
      'Available models:',
      'auto - Automatic selection',
      'claude-4-sonnet (current)',
      'gpt-5.4',
      'claude-4-sonnet',
    ].join('\n');
    expect(parseCursorModels(out)).toEqual(['auto', 'claude-4-sonnet', 'gpt-5.4']);
  });

  it('accepts JSON model catalogs when the CLI emits them', () => {
    expect(parseCursorModels(JSON.stringify({ models: [{ id: 'gpt-5.4' }, 'auto'] }))).toEqual([
      'gpt-5.4',
      'auto',
    ]);
  });
});

describe('Codex custom-agent TOML', () => {
  it('reads and surgically updates a top-level model', () => {
    const content = [
      'name = "builder"',
      'model = "old/model" # keep this comment',
      'developer_instructions = "Use the builder skill"',
      '',
      '[mcp_servers.example]',
      'url = "https://example.test/mcp"',
      '',
    ].join('\n');
    expect(parseCodexAgentModel(content)).toBe('old/model');
    const next = setCodexAgentModel(content, 'gpt-5.4');
    expect(parseCodexAgentModel(next)).toBe('gpt-5.4');
    expect(next).toContain('model = "gpt-5.4" # keep this comment');
    expect(next).toContain('[mcp_servers.example]');
    expect(setCodexAgentModel(next, '')).not.toContain('model =');
  });

  it('creates a native read-only agent config for restricted roles', () => {
    const config = createCodexAgentConfig('reviewer', 'gpt-5.4');
    expect(config).toContain('name = "reviewer"');
    expect(config).toContain('developer_instructions');
    expect(config).toContain('model = "gpt-5.4"');
    expect(config).toContain('sandbox_mode = "read-only"');
    expect(config).toContain('$maestria:reviewer');
  });
});

describe('frontmatter', () => {
  const sample = `---
description: Codebase reconnaissance specialist.
tools: read, bash, grep, find, ls, glob
prompt_mode: append
inherit_context: true
---


<!-- Auto-generated from @maestria/core. Do not edit directly. -->

You are a codebase reconnaissance agent.
`;

  it('parses an existing model', () => {
    const content = '---\ndescription: x\nmodel: opencode-go/deepseek-v4-flash\n---\nbody\n';
    expect(parseFrontmatterModel(content)).toBe('opencode-go/deepseek-v4-flash');
  });

  it('returns undefined when no model is set', () => {
    expect(parseFrontmatterModel(sample)).toBeUndefined();
  });

  it('ignores model-like lines in the body', () => {
    const content = '---\ndescription: x\n---\n\nmodel: not-a-frontmatter\n';
    expect(parseFrontmatterModel(content)).toBeUndefined();
  });

  it('adds a model line, preserving everything else', () => {
    const next = setFrontmatterModel(sample, 'opencode-go/deepseek-v4-flash');
    expect(parseFrontmatterModel(next)).toBe('opencode-go/deepseek-v4-flash');
    expect(next).toContain('tools: read, bash, grep, find, ls, glob');
    expect(next).toContain('You are a codebase reconnaissance agent.');
    expect(next.endsWith(sample.slice(-50))).toBe(true);
  });

  it('replaces an existing model line', () => {
    const content = '---\ndescription: x\nmodel: old/model\n---\nbody\n';
    const next = setFrontmatterModel(content, 'new/model');
    expect(parseFrontmatterModel(next)).toBe('new/model');
    expect(next).not.toContain('old/model');
    expect(next).toContain('description: x');
    expect(next).toContain('body');
  });

  it('removes the model line when given an empty string', () => {
    const content = '---\ndescription: x\nmodel: old/model\n---\nbody\n';
    const next = setFrontmatterModel(content, '');
    expect(parseFrontmatterModel(next)).toBeUndefined();
    expect(next).toContain('description: x');
    expect(next).toContain('body');
  });

  it('prepends frontmatter when the file has none', () => {
    const content = 'no frontmatter here';
    const next = setFrontmatterModel(content, 'opencode-go/deepseek-v4-flash');
    expect(parseFrontmatterModel(next)).toBe('opencode-go/deepseek-v4-flash');
    expect(next).toContain('no frontmatter here');
  });
});

describe('jsonc config edits', () => {
  const config = `{
  "$schema": "https://opencode.ai/config.json",
  // maestria plugin
  "plugin": ["@maestria/opencode@latest"],
  "agent": {
    "adventurer": { "model": "old/model" },
  },
  "theme": "catppuccin-macchiato"
}`;

  it('updates an existing agent model and preserves comments', () => {
    const next = setConfigModelJsonc(config, 'adventurer', 'opencode-go/deepseek-v4-flash');
    expect(parseConfigModels(next).adventurer).toBe('opencode-go/deepseek-v4-flash');
    expect(next).toContain('// maestria plugin');
    expect(next).toContain('"plugin": ["@maestria/opencode@latest"]');
    expect(next).toContain('catppuccin-macchiato');
  });

  it('creates a new agent entry', () => {
    const next = setConfigModelJsonc(config, 'builder', 'opencode-go/deepseek-v4-pro');
    expect(parseConfigModels(next).builder).toBe('opencode-go/deepseek-v4-pro');
    expect(parseConfigModels(next).adventurer).toBe('old/model');
  });

  it('removes the model when given an empty string', () => {
    const next = setConfigModelJsonc(config, 'adventurer', '');
    expect(parseConfigModels(next).adventurer).toBeUndefined();
  });

  it('is a no-op when removing a model that does not exist', () => {
    // jsonc-parser >= 3.3 throws "Can not delete in empty document" here
    const next = setConfigModelJsonc(config, 'reviewer', '');
    expect(next).toBe(config);
    expect(parseConfigModels(next).reviewer).toBeUndefined();
  });

  it('creates the agent object in an empty file', () => {
    const next = setConfigModelJsonc('{}', 'adventurer', 'opencode-go/deepseek-v4-flash');
    expect(parseConfigModels(next).adventurer).toBe('opencode-go/deepseek-v4-flash');
  });

  it('parses a model-less config as empty', () => {
    expect(parseConfigModels('{\n  "theme": "x"\n}')).toEqual({});
    expect(parseConfigModels('not json')).toEqual({});
  });
});
