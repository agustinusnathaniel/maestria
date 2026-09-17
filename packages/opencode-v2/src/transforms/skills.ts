import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { Skill } from '@opencode-ai/plugin/effect';
import type { SkillDraft, Transform } from '@/types.js';
import { readSyncedMarkdown } from '@/markdown.js';
import { CORE_SKILLS_DIR, SKILLS_DIR } from '@/root.js';

const deriveDescription = (content: string): string | undefined => {
  // Skill files open with an ATX heading (e.g. "# Handoff Aid"); use it as
  // the Skill.Info description. Content arrives already stripped by
  // readSyncedMarkdown. Returns undefined when no heading is present, which
  // keeps the optional SDK field unset.
  const headingMatch = /^#\s+(?<heading>.+)$/mu.exec(content.trim());
  const heading = headingMatch?.groups?.heading?.trim() ?? '';
  return heading.length > 0 && heading.length < 120 ? heading : undefined;
};

const resolveSkillsSourceDir = (): string | null => {
  // Prefer the bundled dir (future sync target) when it holds markdown,
  // otherwise fall back to the canonical core location. This keeps the plugin
  // working both from a source checkout and as a packed artifact.
  // See sync.config.ts - skills are not yet synced; CORE_SKILLS_DIR is canonical.
  for (const dir of [SKILLS_DIR, CORE_SKILLS_DIR]) {
    if (!existsSync(dir)) {
      continue;
    }
    try {
      if (readdirSync(dir).some((f) => f.endsWith('.md'))) {
        return dir;
      }
    } catch (error) {
      console.warn(`[maestria-v2] Failed to list skills dir "${dir}":`, error);
    }
  }
  return null;
};

const loadSkillFiles = (dir: string): { name: string; path: string; content: string }[] => {
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    const out: { name: string; path: string; content: string }[] = [];
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const content = readSyncedMarkdown(fullPath, 'skill file');
      if (content === null) {
        continue;
      }
      out.push({ content, name: path.basename(file, '.md'), path: fullPath });
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
 * Skill.Info requires id, name, location, content (decoded through the SDK
 * schema so branded fields are validated, not cast); description stays
 * optional. The pin has no skill `get()`, so existing entries are found via
 * `list().find()`. Source files are canonical core skills until sync covers
 * them (see resolveSkillsSourceDir).
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
        const description = deriveDescription(file.content);
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
