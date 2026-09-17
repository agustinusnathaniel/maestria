import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { Skill } from '@opencode-ai/plugin/effect';
import type { SkillDraft, Transform } from '@/types.js';
import { CORE_SKILLS_DIR, PACKAGE_ROOT, SKILLS_DIR } from '@/root.js';

const stripAutoGenComment = (content: string): string => {
  const trimmed = content.trimStart();
  if (trimmed.startsWith('<!--')) {
    const end = trimmed.indexOf('-->');
    if (end !== -1) {
      return trimmed.slice(end + 3).trimStart();
    }
  }
  return content;
};

const deriveDescription = (fileName: string, content: string): string | undefined => {
  // Try first ATX heading as description, e.g. "# Handoff Aid" -> "Handoff Aid"
  const stripped = stripAutoGenComment(content).trim();
  const headingMatch = /^#\s+(?<heading>.+)$/mu.exec(stripped);
  if (headingMatch) {
    const heading = headingMatch.groups?.heading?.trim() ?? '';
    if (heading.length > 0 && heading.length < 120) {
      return heading;
    }
  }
  // Fallback: first non-empty non-heading line
  const lines = stripped
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const first = lines.find((l) => !l.startsWith('#') && !l.startsWith('<!--'));
  if (first !== undefined && first.length > 0 && first.length < 120) {
    return first.slice(0, 100);
  }
  // No useful derivation; leave undefined so Skill.Info description stays optional.
  void fileName;
  return undefined;
};

const resolveSkillsSourceDir = (): string | null => {
  // Prefer bundled dir (future sync target: PACKAGE_ROOT/skills) if it exists and has files,
  // otherwise fall back to canonical core location. This keeps the plugin working both
  // when built from source checkout and when installed as a packed artifact.
  // See sync.config.ts - skills are not yet synced; CORE_SKILLS_DIR is the canonical source.
  if (existsSync(SKILLS_DIR)) {
    try {
      const files = readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'));
      if (files.length > 0) {
        return SKILLS_DIR;
      }
    } catch (error) {
      console.warn(`[maestria-v2] Failed to list bundled skills dir "${SKILLS_DIR}":`, error);
    }
  }
  if (existsSync(CORE_SKILLS_DIR)) {
    return CORE_SKILLS_DIR;
  }
  // Also probe PACKAGE_ROOT relative fallback for packed builds that vendor core skills
  const fallback = path.join(PACKAGE_ROOT, '../core/agent-directives/skills');
  if (existsSync(fallback)) {
    return fallback;
  }
  return null;
};

const loadSkillFiles = (dir: string): { name: string; path: string; content: string }[] => {
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    const out: { name: string; path: string; content: string }[] = [];
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const raw = readFileSync(fullPath, 'utf-8');
        const name = path.basename(file, '.md');
        const content = `${stripAutoGenComment(raw).replace(/\s+$/u, '')}\n`;
        out.push({ content, name, path: fullPath });
      } catch (error) {
        console.warn(`[maestria-v2] Failed to read skill file "${file}":`, error);
      }
    }
    return out;
  } catch (error) {
    console.warn(`[maestria-v2] Failed to list skills directory "${dir}":`, error);
    return [];
  }
};

/**
 * Register skills via `skill.transform`.
 *
 * Ground truth - SkillInfo shape (from @opencode-ai/schema/skill and @opencode-ai/client):
 *   { id: Skill.ID, name: Skill.Name, description?: string, slash?: boolean, autoinvoke?: boolean,
 *     location: AbsolutePath, content: string }
 *
 * Draft shape (from @opencode-ai/plugin/effect/skill):
 *   SkillDraft { list(), add(skill: Skill.Info), update(id, fn), remove(id) }
 *
 * Source: `packages/core/agent-directives/skills/*.md` (handoff.md, iteration-limits.md).
 * Currently NOT synced to `opencode-v2/skills/` by sync.config (only agents + rules are synced).
 * Loader probes both the canonical core path and a future bundled `SKILLS_DIR` so adding a sync
 * entry later requires no code change.
 */
export const registerSkillTransforms = (ctx: {
  skill: { transform: Transform<SkillDraft> };
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerSkillTransformsEffect() {
    const sourceDir = resolveSkillsSourceDir();
    if (sourceDir === null) {
      console.warn(
        '[maestria-v2] No skills source directory found; checked SKILLS_DIR and CORE_SKILLS_DIR. Skipping skill registration.',
      );
      return;
    }
    const skillFiles = loadSkillFiles(sourceDir);
    if (skillFiles.length === 0) {
      console.warn(
        `[maestria-v2] No skill files found in "${sourceDir}"; skipping skill registration.`,
      );
      return;
    }

    yield* ctx.skill.transform((draft: SkillDraft) => {
      for (const file of skillFiles) {
        const description = deriveDescription(file.name, file.content);
        // Skill.Info requires: id, name, location (AbsolutePath), content. Optional: description, slash, autoinvoke.
        // Decoded through the SDK schema so branded id/name/location are validated, not cast.
        // slash/autoinvoke default to undefined (false-y) - keeps skills as reference docs unless explicitly invoked.
        try {
          const info = Schema.decodeSync(Skill.Info)({
            content: file.content,
            description,
            id: file.name,
            location: file.path,
            name: file.name,
          });

          const existing = draft.list().find((s) => s.id === file.name || s.name === file.name);
          if (existing) {
            draft.update(file.name, (skill) => {
              if (info.description !== undefined && info.description !== '') {
                skill.description = info.description;
              }
              skill.content = info.content;
              skill.location = info.location;
            });
          } else {
            draft.add(info);
          }
        } catch (error) {
          console.warn(`[maestria-v2] Failed to register skill "${file.name}":`, error);
        }
      }
    });
  });
