import { readdirSync } from 'node:fs';
import path from 'node:path';
import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { Skill } from '@opencode/plugin/effect';
import { parse as parseYaml } from 'yaml';
import type { SkillEditor, Transform } from '@/types.js';
import { readSyncedMarkdown, splitMarkdown } from '@/markdown.js';
import { SKILLS_DIR } from '@/root.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deriveDescription = (content: string): string | undefined => {
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

const parseSkillFile = (filePath: string, content: string): SkillFile | null => {
  const name = path.basename(filePath, '.md');
  const { body, frontmatter: yaml } = splitMarkdown(content);
  if (body.trim().length === 0) {
    return null;
  }
  let frontmatter: Record<string, unknown> = {};
  try {
    const parsed: unknown = parseYaml(yaml ?? '');
    frontmatter = isRecord(parsed) ? parsed : {};
  } catch {
    // Unusable skill metadata falls back to the Markdown heading.
  }
  const rawDescription = frontmatter.description;
  return {
    content: body,
    description:
      typeof rawDescription === 'string' && rawDescription !== ''
        ? rawDescription
        : deriveDescription(body),
    name,
    path: filePath,
  };
};

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
          draft.add({
            ...info,
            ...existing,
            content: info.content,
            description: info.description ?? existing?.description,
            path: info.path,
          });
        } catch (error) {
          console.warn(`[maestria-v2] Failed to register skill "${file.name}":`, error);
        }
      }
    });
  });
