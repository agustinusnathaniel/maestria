#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { normalizeLineEndings } from '../packages/core/scripts/lib/transforms.js';

// maestria's own methodology skills live once in core and ship as generated copies in every
// maestria package, so no host has a directive pointing at a missing skill. Runtimes maestria
// does not package reach the agent-plugins copies through `npx skills add`, which follows the
// relative source in `.claude-plugin/marketplace.json`.
const SOURCE_DIR = 'packages/core/agent-directives/skills';
const TARGET_DIRS = [
  'packages/agent-plugins/skills',
  'packages/deepseek/skills',
  'packages/opencode/skills',
  'packages/pi/skills',
];
const NOTICE_PREFIX = `<!-- Bundled from ${SOURCE_DIR}/`;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const FRONTMATTER = /^---\n[\s\S]*?\n---\n/u;

const notice = (name: string): string =>
  `${NOTICE_PREFIX}${name}/SKILL.md by scripts/sync-bundled-skills.ts. Do not edit directly. -->`;

const assertNotSymlink = (absolute: string, label: string): void => {
  if (fs.existsSync(absolute) && fs.lstatSync(absolute).isSymbolicLink()) {
    throw new Error(`Bundled skill path must not be a symlink: ${label}`);
  }
};

/** Copy one canonical skill, keeping its frontmatter first so hosts still parse it. */
const bundledContent = (name: string, source: string): string => {
  const frontmatter = FRONTMATTER.exec(source)?.[0];
  if (frontmatter === undefined) {
    throw new Error(`Canonical skill is missing YAML frontmatter: ${SOURCE_DIR}/${name}/SKILL.md`);
  }
  if (!new RegExp(`^name: ${name}$`, 'mu').test(frontmatter)) {
    throw new Error(
      `Canonical skill name must match its directory: ${SOURCE_DIR}/${name}/SKILL.md`,
    );
  }
  const body = source.slice(frontmatter.length).trim();
  return `${frontmatter}\n${notice(name)}\n\n${body}\n`;
};

/** Canonical skills by name, read from the core skills directory. */
export const bundledSkills = (repoRoot: string): Map<string, string> => {
  const root = path.join(repoRoot, SOURCE_DIR);
  const skills = new Map<string, string>();
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name, 'SKILL.md');
    if (!entry.isDirectory() || !fs.existsSync(file)) {
      continue;
    }
    if (!SKILL_NAME.test(entry.name)) {
      throw new Error(`Invalid canonical skill directory name: ${SOURCE_DIR}/${entry.name}`);
    }
    assertNotSymlink(file, `${SOURCE_DIR}/${entry.name}/SKILL.md`);
    const source = normalizeLineEndings(fs.readFileSync(file, 'utf-8'));
    skills.set(entry.name, bundledContent(entry.name, source));
  }
  return skills;
};

interface Change {
  readonly action: 'remove' | 'write';
  readonly relative: string;
}

/** A copy is ours only when it carries the exact generated notice line for its own name. */
const isBundled = (absolute: string, name: string): boolean =>
  fs.existsSync(absolute) && fs.readFileSync(absolute, 'utf-8').split('\n').includes(notice(name));

/** Writes for missing or drifted copies, removals for copies whose source skill is gone. */
const planChanges = (repoRoot: string, skills: Map<string, string>): Change[] => {
  const changes: Change[] = [];
  for (const target of TARGET_DIRS) {
    const targetRoot = path.join(repoRoot, target);
    for (const [name, content] of skills) {
      const relative = path.join(target, name, 'SKILL.md');
      const absolute = path.join(repoRoot, relative);
      assertNotSymlink(path.dirname(absolute), path.dirname(relative));
      assertNotSymlink(absolute, relative);
      if (fs.existsSync(absolute) && !isBundled(absolute, name)) {
        throw new Error(`Bundled skill would overwrite a package-owned skill: ${relative}`);
      }
      if (!fs.existsSync(absolute) || fs.readFileSync(absolute, 'utf-8') !== content) {
        changes.push({ action: 'write', relative });
      }
    }
    if (!fs.existsSync(targetRoot)) {
      continue;
    }
    for (const entry of fs.readdirSync(targetRoot, { withFileTypes: true })) {
      const relative = path.join(target, entry.name, 'SKILL.md');
      if (
        entry.isDirectory() &&
        !skills.has(entry.name) &&
        isBundled(path.join(repoRoot, relative), entry.name)
      ) {
        changes.push({ action: 'remove', relative });
      }
    }
  }
  return changes;
};

export const syncBundledSkills = (repoRoot: string, check = false): Change[] => {
  const skills = bundledSkills(repoRoot);
  const changes = planChanges(repoRoot, skills);
  if (!check) {
    for (const change of changes) {
      const absolute = path.join(repoRoot, change.relative);
      if (change.action === 'write') {
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(
          absolute,
          skills.get(path.basename(path.dirname(absolute))) ?? '',
          'utf-8',
        );
      } else {
        fs.unlinkSync(absolute);
        if (fs.readdirSync(path.dirname(absolute)).length === 0) {
          fs.rmdirSync(path.dirname(absolute));
        }
      }
    }
  }
  return changes;
};

export const main = (
  args: string[],
  repoRoot = path.resolve(import.meta.dirname, '..'),
): number => {
  if (args.length > 1 || (args.length === 1 && !['--check', '--write'].includes(args[0]))) {
    console.error('Usage: sync-bundled-skills.ts [--check|--write]');
    return 2;
  }
  try {
    const check = args[0] === '--check';
    const changes = syncBundledSkills(repoRoot, check);
    for (const change of changes) {
      const verb = change.action === 'write' ? 'SYNC' : 'REMOVE';
      console.log(`${check ? 'DRIFT' : verb}: ${change.relative}`);
    }
    return check && changes.length > 0 ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  process.exitCode = main(process.argv.slice(2));
}
