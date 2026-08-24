import { describe, expect, it } from 'vite-plus/test';

import {
  AGENT_INSTRUCTIONS_MARKER,
  DEVELOPER_RESOURCES_MARKER,
  agentInstructionsSection,
  agentsMdDocument,
  augmentLlmsTxt,
  developerResourcesSection,
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

  it('links the dedicated agents.md instructions file', () => {
    const section = agentInstructionsSection();
    expect(section).toContain('(https://maestria.sznm.dev/agents.md)');
  });
});

describe('developerResourcesSection', () => {
  const section = developerResourcesSection();

  it('is a Developer resources section led by its marker exactly once', () => {
    expect(section.startsWith(DEVELOPER_RESOURCES_MARKER)).toBe(true);
    expect(section).toContain('## Developer resources');
    expect(section.split(DEVELOPER_RESOURCES_MARKER)).toHaveLength(2);
  });

  it('links every developer surface with absolute URLs', () => {
    for (const url of [
      'https://maestria.sznm.dev/',
      'https://maestria.sznm.dev/core/when-to-use/',
      'https://maestria.sznm.dev/cli/getting-started/',
      'https://maestria.sznm.dev/llms-full.txt',
      'https://maestria.sznm.dev/llms-small.txt',
      'https://maestria.sznm.dev/agents.md',
      'https://maestria.sznm.dev/sitemap-index.xml',
      'https://maestria.sznm.dev/robots.txt',
      'https://www.npmjs.com/package/maestria',
      'https://github.com/agustinusnathaniel/maestria',
      'https://github.com/agustinusnathaniel/maestria/issues',
      '<page>.md',
      'https://maestria.sznm.dev/core/when-to-use.md',
    ]) {
      expect(section).toContain(url);
    }
  });

  it('mentions the install command and brands every link label with Maestria', () => {
    expect(section).toContain('npx maestria install <platform>');
    const labels = [...section.matchAll(/\[([^\]]+)\]\(/g)].map((match) => match[1]);
    expect(labels.length).toBeGreaterThanOrEqual(10);
    for (const label of labels) {
      expect(label, `label "${label}" must carry the brand`).toMatch(/Maestria/i);
    }
  });
});

describe('augmentLlmsTxt ordering and per-marker idempotency', () => {
  it('appends the Developer resources section before the Agent instructions section', () => {
    const result = augmentLlmsTxt(SAMPLE);
    expect(result.indexOf('## Developer resources')).toBeGreaterThan(SAMPLE.length - 1);
    expect(result.indexOf('## Developer resources')).toBeLessThan(
      result.indexOf('## Agent instructions'),
    );
    expect(result.indexOf(DEVELOPER_RESOURCES_MARKER)).toBeLessThan(
      result.indexOf(AGENT_INSTRUCTIONS_MARKER),
    );
  });

  it('is idempotent across both markers: re-running changes nothing', () => {
    const once = augmentLlmsTxt(SAMPLE);
    expect(augmentLlmsTxt(once)).toBe(once);
    expect(once.split(DEVELOPER_RESOURCES_MARKER)).toHaveLength(2);
    expect(once.split(AGENT_INSTRUCTIONS_MARKER)).toHaveLength(2);
  });

  it('returns the input unchanged when both markers are already present', () => {
    const complete = [
      SAMPLE,
      `${DEVELOPER_RESOURCES_MARKER}`,
      `${AGENT_INSTRUCTIONS_MARKER}`,
      '',
    ].join('\n');
    expect(augmentLlmsTxt(complete)).toBe(complete);
  });

  it('inserts Developer resources above an existing Agent instructions section', () => {
    const instructionsOnly = `${SAMPLE}\n\n${agentInstructionsSection()}`;
    const filled = augmentLlmsTxt(instructionsOnly);

    expect(filled.indexOf(DEVELOPER_RESOURCES_MARKER)).toBeLessThan(
      filled.indexOf(AGENT_INSTRUCTIONS_MARKER),
    );
    expect(filled.split(DEVELOPER_RESOURCES_MARKER)).toHaveLength(2);
    expect(filled.split(AGENT_INSTRUCTIONS_MARKER)).toHaveLength(2);
    // Append-path blank-line spacing on both sides of the inserted section.
    expect(filled).toContain(`\n\n${DEVELOPER_RESOURCES_MARKER}`);
    expect(filled).toContain(`\n\n${AGENT_INSTRUCTIONS_MARKER}`);
    // Idempotent: re-running on the filled document changes nothing.
    expect(augmentLlmsTxt(filled)).toBe(filled);
  });

  it('appends Agent instructions after existing Developer resources', () => {
    const resourcesOnly = `${SAMPLE}\n\n${developerResourcesSection()}`;
    const filled = augmentLlmsTxt(resourcesOnly);

    expect(filled.indexOf(AGENT_INSTRUCTIONS_MARKER)).toBeGreaterThan(
      filled.indexOf(DEVELOPER_RESOURCES_MARKER),
    );
    expect(filled.split(DEVELOPER_RESOURCES_MARKER)).toHaveLength(2);
    expect(filled.split(AGENT_INSTRUCTIONS_MARKER)).toHaveLength(2);
  });

  it('fills in only the missing section when one marker already exists', () => {
    const onlyResources = `\n${DEVELOPER_RESOURCES_MARKER}\n\n## Developer resources\n\nbody\n`;
    const filled = augmentLlmsTxt(onlyResources);
    expect(filled.split(DEVELOPER_RESOURCES_MARKER)).toHaveLength(2);
    expect(filled).toContain('## Agent instructions');

    const onlyInstructions = `\n${AGENT_INSTRUCTIONS_MARKER}\n\n## Agent instructions\n\nbody\n`;
    const refilled = augmentLlmsTxt(onlyInstructions);
    expect(refilled.split(AGENT_INSTRUCTIONS_MARKER)).toHaveLength(2);
    expect(refilled).toContain('## Developer resources');
  });
});

describe('agentsMdDocument', () => {
  const doc = agentsMdDocument();

  it('opens with the agent instructions title', () => {
    expect(doc.startsWith('# Maestria agent instructions')).toBe(true);
  });

  it('states explicitly when to use Maestria', () => {
    expect(doc).toContain('## When to use Maestria');
    expect(doc.toLowerCase()).toContain('use maestria when');
    for (const platform of ['OpenCode', 'Kimi Code', 'Pi', 'Claude Code', 'Codex CLI']) {
      expect(doc).toContain(platform);
    }
  });

  it('explains how to call Maestria with the install example', () => {
    expect(doc).toContain('## How to call Maestria');
    expect(doc).toContain('npx maestria install <platform>');
    expect(doc).toContain('npx maestria install opencode');
  });

  it('lists the consumption surfaces', () => {
    for (const surface of [
      'https://maestria.sznm.dev/llms-full.txt',
      'https://maestria.sznm.dev/llms-small.txt',
      '<page>.md',
      'https://maestria.sznm.dev/core/when-to-use.md',
      'https://maestria.sznm.dev/sitemap-index.xml',
      'https://github.com/agustinusnathaniel/maestria',
    ]) {
      expect(doc).toContain(surface);
    }
  });

  it('shares its prose with the llms.txt sections (no duplicated drift)', () => {
    const instructions = agentInstructionsSection();
    expect(instructions.toLowerCase()).toContain('use maestria when');
    // The summary paragraph and when-to-use bullets come from the same
    // shared line builders.
    const summaryLine =
      'Maestria is portable AI engineering praxis: installable plugins that wire a';
    expect(doc).toContain(summaryLine);
    expect(instructions).toContain(summaryLine);
  });

  it.each([agentsMdDocument(), agentInstructionsSection(), developerResourcesSection()])(
    'generated output contains no em dash (U+2014)',
    (output) => {
      // Escape-sequence form keeps the authored source ASCII-only.
      expect(output.includes('\u2014')).toBe(false);
    },
  );
});
