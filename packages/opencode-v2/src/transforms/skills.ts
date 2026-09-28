import { readdirSync } from 'node:fs';
import path from 'node:path';
import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { Skill } from '@opencode-ai/plugin/effect';
import type { SkillDraft, Transform } from '@/types.js';
import { readSyncedMarkdown } from '@/markdown.js';
import { CORE_SKILLS_DIR } from '@/root.js';

const deriveDescription = (content: string): string | undefined => {
  // Skill files open with an ATX heading; use it as the description when
  // present (keeps the optional SDK field unset otherwise).
  const headingMatch = /^#\s+(?<heading>.+)$/mu.exec(content.trim());
  const heading = headingMatch?.groups?.heading?.trim() ?? '';
  return heading.length > 0 && heading.length < 120 ? heading : undefined;
};

interface SkillFile {
  name: string;
  path: string;
  content: string;
}

// Canonical core location (sync emits no skills dir and the package ships
// none). Returns [] when the dir is missing, unreadable, or holds no .md
// files, so the caller has a single empty-check.
const loadSkillFiles = (): SkillFile[] => {
  let files: string[];
  try {
    files = readdirSync(CORE_SKILLS_DIR).filter((f) => f.endsWith('.md'));
  } catch (error) {
    console.warn(`[maestria-v2] Failed to list skills dir "${CORE_SKILLS_DIR}":`, error);
    return [];
  }
  const out: SkillFile[] = [];
  for (const file of files) {
    const fullPath = path.join(CORE_SKILLS_DIR, file);
    const content = readSyncedMarkdown(fullPath, 'skill file');
    if (content === null) {
      continue;
    }
    out.push({ content, name: path.basename(file, '.md'), path: fullPath });
  }
  return out;
};

/**
 * Register skills via `skill.transform`. Skill.Info requires id, name,
 * location, content (validated through the SDK schema, not cast). The pin
 * has no skill `get()`, so existing entries are found via `list().find()`.
 */
export const registerSkillTransforms = (ctx: {
  skill: { transform: Transform<SkillDraft> };
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerSkillTransformsEffect() {
    const skillFiles = loadSkillFiles();
    if (skillFiles.length === 0) {
      console.warn(
        `[maestria-v2] No skill files found in "${CORE_SKILLS_DIR}"; skipping skill registration.`,
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
