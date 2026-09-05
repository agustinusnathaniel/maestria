import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  SkillCandidate,
  SkillDefinition,
  SkillInvocationPolicy,
  SkillLookupOptions,
  SkillProvider,
  SkillProviderControl,
} from '@deepseek-ai/dsh-skill';

/**
 * Ranking used for all Maestria provider skills. It sits below the filesystem
 * roots that a user can edit directly (project `.dsh`/`.agents` roots, custom
 * dirs, and the harness/agents home roots at 100-500) and above the bundled
 * root (600), so local copies always win over the package-provided ones.
 */
export const MAESTRIA_SKILL_RANK = 550;

export interface ParsedSkillFile {
  readonly name: string;
  readonly description: string;
  readonly content: string;
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Parse a generated `SKILL.md`: a `---` frontmatter block of `key: value`
 * lines followed by the instruction body. The sync pipeline emits flat
 * frontmatter only, so a line parser is sufficient; a missing block is a
 * loud failure because every generated skill carries one.
 */
export const parseSkillFile = (text: string, source: string): ParsedSkillFile => {
  const lines = text.split(/\r?\n/u);
  if (lines[0]?.trim() !== '---') {
    throw new Error(`maestria skill is missing frontmatter: ${source}`);
  }
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (close < 1) {
    throw new Error(`maestria skill has unterminated frontmatter: ${source}`);
  }

  const metadata: Record<string, string> = {};
  for (const line of lines.slice(1, close)) {
    const match = /^(?<key>[A-Za-z][A-Za-z0-9_-]*):\s*(?<value>.*)$/u.exec(line);
    const groups = match?.groups;
    if (groups !== undefined) {
      const { key, value } = groups;
      metadata[key] = value.trim();
    }
  }

  const { description = '', name = '' } = metadata;
  if (name === '' || description === '') {
    throw new Error(`maestria skill frontmatter requires name and description: ${source}`);
  }

  // The generated provenance banner is file metadata, not instruction content;
  // strip it so prompt sections, personas, and loaded skill bodies stay clean.
  const body = lines.slice(close + 1).join('\n');
  const content = body.replace(/^(?:\s|<!--[\s\S]*?-->)+/u, '').trim();
  if (content === '') {
    throw new Error(`maestria skill has an empty instruction body: ${source}`);
  }

  return { content, description, metadata, name };
};

const isSkillDirectory = (entry: string): boolean => /^[a-z0-9][a-z0-9-]*$/u.test(entry);

const invocationPolicy = (metadata: Readonly<Record<string, string>>): SkillInvocationPolicy => ({
  modelInvocable: metadata['disable-model-invocation'] !== 'true',
  userInvocable: metadata['user-invocable'] !== 'false',
});

const readSkill = async (skillDir: string): Promise<ParsedSkillFile> => {
  const skillPath = path.join(skillDir, 'SKILL.md');
  const text = await readFile(skillPath, 'utf-8');
  return parseSkillFile(text, skillPath);
};

const loadCandidate = async (
  skillDir: string,
  providerName: string,
): Promise<SkillCandidate | undefined> => {
  try {
    const parsed = await readSkill(skillDir);
    return {
      description: parsed.description,
      invocation: invocationPolicy(parsed.metadata),
      locator: skillDir,
      metadata: parsed.metadata,
      name: parsed.name,
      path: path.join(skillDir, 'SKILL.md'),
      provider: providerName,
      rank: MAESTRIA_SKILL_RANK,
      source: 'runtime',
    };
  } catch {
    // A damaged skill directory is skipped rather than failing discovery
    // for the whole provider; the sync pipeline and tests gate integrity.
    return undefined;
  }
};

const loadDefinition = async (
  candidate: SkillCandidate,
  providerName: string,
): Promise<SkillDefinition | undefined> => {
  const { locator } = candidate;
  if (typeof locator !== 'string') {
    return undefined;
  }
  try {
    const parsed = await readSkill(locator);
    return {
      content: parsed.content,
      description: parsed.description,
      invocation: invocationPolicy(parsed.metadata),
      metadata: parsed.metadata,
      name: parsed.name,
      path: path.join(locator, 'SKILL.md'),
      provider: providerName,
      resourceBase: { kind: 'directory', path: locator },
      source: 'runtime',
    };
  } catch {
    return undefined;
  }
};

/**
 * Provider whose `list` returns the complete-array shorthand the registry
 * accepts. Narrower than `SkillProvider`, so it is directly assignable where
 * a `SkillProvider` is expected while keeping static call sites exact.
 */
export interface MaestriaSkillProvider extends Omit<SkillProvider, 'list'> {
  readonly list: (options: SkillLookupOptions) => Promise<readonly SkillCandidate[]>;
}

/**
 * Build the `ctx.skills` provider that exposes the package's generated
 * `skills/<name>/SKILL.md` tree. The provider reads the directory on every
 * `list()` call so filesystem edits are picked up without a plugin reload,
 * matching the shipped filesystem provider's discovery behavior.
 */
export const createMaestriaSkillProvider = (
  skillsDir: string,
  providerName: string,
): ((control: SkillProviderControl) => MaestriaSkillProvider) => {
  const list = async (): Promise<readonly SkillCandidate[]> => {
    const entries = await readdir(skillsDir).catch(() => []);
    const loaded = await Promise.all(
      entries.filter(isSkillDirectory).map(async (entry) => {
        const candidate = await loadCandidate(path.join(skillsDir, entry), providerName);
        return candidate;
      }),
    );
    return loaded.filter((candidate): candidate is SkillCandidate => candidate !== undefined);
  };

  const get = async (candidate: SkillCandidate): Promise<SkillDefinition | undefined> =>
    await loadDefinition(candidate, providerName);

  return () => ({
    get,
    list,
    name: providerName,
  });
};
