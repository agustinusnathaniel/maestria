import { describe, expect, it } from 'vite-plus/test';

import {
  AGENT_INSTRUCTIONS_MARKER,
  agentInstructionsSection,
  augmentLlmsTxt,
} from '../src/lib/llms-augment.ts';

const SAMPLE =
  '# Maestria\n\n> Portable AI engineering praxis plugins.\n\n- [Core](https://maestria.sznm.dev/core/)\n';

describe('augmentLlmsTxt', () => {
  it('appends the Agent instructions section after the original content', () => {
    const result = augmentLlmsTxt(SAMPLE);
    expect(result).toContain('## Agent instructions');
    expect(result.indexOf('## Agent instructions')).toBeGreaterThan(SAMPLE.length - 1);
    expect(result).toContain(AGENT_INSTRUCTIONS_MARKER);
  });

  it('preserves the original verbatim as a prefix', () => {
    const withNewline = augmentLlmsTxt(SAMPLE);
    expect(withNewline.startsWith(SAMPLE)).toBe(true);

    const noTrailingNewline = SAMPLE.trimEnd();
    expect(augmentLlmsTxt(noTrailingNewline).startsWith(noTrailingNewline)).toBe(true);
  });

  it('is idempotent: re-running does not duplicate the section', () => {
    const once = augmentLlmsTxt(SAMPLE);
    const twice = augmentLlmsTxt(once);
    expect(twice).toBe(once);
    expect(once.split(AGENT_INSTRUCTIONS_MARKER)).toHaveLength(2);
  });

  it('states when an agent should use Maestria', () => {
    const section = agentInstructionsSection();
    expect(section.toLowerCase()).toContain('use maestria when');
    for (const platform of [
      'OpenCode',
      'Kimi Code',
      'Pi',
      'Hermes',
      'Claude Code',
      'Codex CLI',
      'Cursor',
      'prime-agent',
      'OMP',
    ]) {
      expect(section).toContain(platform);
    }
    expect(section.toLowerCase()).toContain('maker/checker');
    expect(section.toLowerCase()).toContain('specialist dispatch');
  });

  it('documents every consumption surface', () => {
    const section = agentInstructionsSection();
    expect(section).toContain('/llms-full.txt');
    expect(section).toContain('/llms-small.txt');
    expect(section).toContain('/sitemap-index.xml');
    expect(section).toContain('<page>.md');
    expect(section).toContain('https://github.com/agustinusnathaniel/maestria');
    expect(section).toContain('npx maestria install');
  });
});
