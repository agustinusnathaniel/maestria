import { readdirSync } from 'node:fs';
import path from 'node:path';
import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { Skill } from '@opencode/plugin/effect';
import { parse as parseYaml } from 'yaml';
import type { SkillEditor, Transform } from '@/types.js';
import { readSyncedMarkdown, stripAutoGenComment } from '@/markdown.js';
import { SKILLS_DIR } from '@/root.js';

// Frontmatter block the documented skill format opens with (`name`,
// `description`). Same shape the shared Pi/OMP validator enforces.
const FRONTMATTER_RE = /^---\n(?<frontmatter>[\s\S]*?)\n---\n*/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deriveDescription = (content: string): string | undefined => {
  // Skill files open with an ATX heading; use it as the description when no
  // frontmatter description exists (keeps the optional SDK field unset
  // otherwise).
  const headingMatch = /^#\s+(?<heading>.+)$/mu.exec(content.trim());
  const heading = headingMatch?.groups?.heading?.trim() ?? '';
  return heading.length > 0 && heading.length < 120 ? heading : undefined;
};

interface SkillFile {
  name: string;
  path: string;
  description?: string;
  content: string;
}

// Split a synced skill file into its frontmatter and body. The file opens
// with the pipeline's auto-generated header, so that is lifted before the
// block is matched. The host adds the Markdown body without frontmatter to
// the conversation, so pushed content must never carry the block. Returns
// null for empty bodies (caller skips).
const parseSkillFile = (filePath: string, content: string): SkillFile | null => {
  const name = path.basename(filePath, '.md');
  const body = stripAutoGenComment(content);
  const match = FRONTMATTER_RE.exec(body);
  if (!match) {
    return { content: body, description: deriveDescription(body), name, path: filePath };
  }
  let frontmatter: Record<string, unknown> = {};
  try {
    const parsed: unknown = parseYaml(match.groups?.frontmatter ?? '');
    frontmatter = isRecord(parsed) ? parsed : {};
  } catch {
    // Malformed frontmatter falls through to the heading fallback below.
  }
  const rawDescription = frontmatter.description;
  const bodyText = body.slice(match[0].length);
  if (bodyText.trim().length === 0) {
    return null;
  }
  return {
    content: bodyText,
    description:
      typeof rawDescription === 'string' && rawDescription !== ''
        ? rawDescription
        : deriveDescription(bodyText),
    name,
    path: filePath,
  };
};

// Bundled skills dir (see sync.config.ts). No core fallback: agents and rules
// resolve bundled-only too, and check-sync guarantees the copy is current.
const loadSkillFiles = (): SkillFile[] => {
  let files: string[];
  try {
    files = readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'));
  } catch (error) {
    console.warn(`[maestria-v2] Failed to list skills dir "${SKILLS_DIR}":`, error);
    return [];
  }
  const out: SkillFile[] = [];
  for (const file of files) {
    const fullPath = path.join(SKILLS_DIR, file);
    const content = readSyncedMarkdown(fullPath, 'skill file');
    if (content === null) {
      continue;
    }
    const parsed = parseSkillFile(fullPath, content);
    if (parsed === null) {
      console.warn(`[maestria-v2] Skipping empty skill file "${fullPath}".`);
      continue;
    }
    if (parsed.description === undefined) {
      console.warn(
        `[maestria-v2] Skill "${parsed.name}" has no description and will not be advertised to the model.`,
      );
    }
    out.push(parsed);
  }
  return out;
};

/**
 * Register skills via `skill.transform`. Skill.Info requires id, name,
 * path, content (validated through the SDK schema, not cast).
 */
export const registerSkillTransforms = (ctx: {
  skill: { transform: Transform<SkillEditor> };
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerSkillTransformsEffect() {
    const skillFiles = loadSkillFiles();
    if (skillFiles.length === 0) {
      console.warn(
        `[maestria-v2] No skill files found in "${SKILLS_DIR}"; skipping skill registration.`,
      );
      return;
    }

    yield* ctx.skill.transform((draft: SkillEditor) => {
      for (const file of skillFiles) {
        try {
          const info = Schema.decodeSync(Skill.Info)({
            content: file.content,
            description: file.description,
            id: file.name,
            name: file.name,
            path: file.path,
          });

          const existing = draft.get(file.name);
          if (existing) {
            draft.update(file.name, (skill) => {
              if (info.description !== undefined && info.description !== '') {
                skill.description = info.description;
              }
              skill.content = info.content;
              skill.path = info.path;
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
