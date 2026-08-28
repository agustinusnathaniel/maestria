import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { Effect } from 'effect';
import type { SkillDraft, Transform } from '@/types.js';
import { PACKAGE_ROOT, SKILLS_DIR, CORE_SKILLS_DIR } from '@/root.js';

function stripAutoGenComment(content: string): string {
  const trimmed = content.trimStart();
  if (trimmed.startsWith('<!--')) {
    const end = trimmed.indexOf('-->');
    if (end !== -1) return trimmed.slice(end + 3).trimStart();
  }
  return content;
}

function deriveDescription(fileName: string, content: string): string | undefined {
  // Try first ATX heading as description, e.g. "# Handoff Aid" -> "Handoff Aid"
  const stripped = stripAutoGenComment(content).trim();
  const headingMatch = stripped.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    const heading = headingMatch[1].trim();
    if (heading.length > 0 && heading.length < 120) return heading;
  }
  // Fallback: first non-empty non-heading line
  const lines = stripped
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const first = lines.find((l) => !l.startsWith('#') && !l.startsWith('<!--'));
  if (first && first.length < 120) return first.slice(0, 100);
  // No useful derivation; leave undefined so Skill.Info description stays optional.
  void fileName;
  return undefined;
}

function resolveSkillsSourceDir(): string | null {
  // Prefer bundled dir (future sync target: PACKAGE_ROOT/skills) if it exists and has files,
  // otherwise fall back to canonical core location. This keeps the plugin working both
  // when built from source checkout and when installed as a packed artifact.
  // See sync.config.ts - skills are not yet synced; CORE_SKILLS_DIR is the canonical source.
  if (existsSync(SKILLS_DIR)) {
    try {
      const files = readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'));
      if (files.length > 0) return SKILLS_DIR;
    } catch {}
  }
  if (existsSync(CORE_SKILLS_DIR)) return CORE_SKILLS_DIR;
  // Also probe PACKAGE_ROOT relative fallback for packed builds that vendor core skills
  const fallback = join(PACKAGE_ROOT, '../core/agent-directives/skills');
  if (existsSync(fallback)) return fallback;
  return null;
}

function loadSkillFiles(dir: string): Array<{ name: string; path: string; content: string }> {
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    const out: Array<{ name: string; path: string; content: string }> = [];
    for (const file of files) {
      const fullPath = join(dir, file);
      try {
        const raw = readFileSync(fullPath, 'utf-8');
        const name = basename(file, '.md');
        const content = stripAutoGenComment(raw).replace(/\s+$/, '') + '\n';
        out.push({ name, path: fullPath, content });
      } catch (err) {
        console.warn(`[maestria-v2] Failed to read skill file "${file}":`, err);
      }
    }
    return out;
  } catch (err) {
    console.warn(`[maestria-v2] Failed to list skills directory "${dir}":`, err);
    return [];
  }
}

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
export function registerSkillTransforms(ctx: {
  skill: { transform: Transform<SkillDraft> };
}): Effect.Effect<void, never, import('effect').Scope.Scope> {
  return Effect.gen(function* () {
    const sourceDir = resolveSkillsSourceDir();
    if (!sourceDir) {
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
        const info = {
          id: file.name,
          name: file.name,
          description,
          location: file.path,
          content: file.content,
          // slash/autoinvoke default to undefined (false-y) - keeps skills as reference docs unless explicitly invoked.
        } as unknown as Parameters<SkillDraft['add']>[0];

        try {
          const existing = draft
            .list()
            .find(
              (s) =>
                (s as unknown as { id: string; name: string }).id === file.name ||
                (s as unknown as { name: string }).name === file.name,
            );
          if (existing) {
            draft.update(file.name, (skill) => {
              const s = skill as unknown as {
                description?: string;
                content: string;
                location: string;
              };
              if (description) s.description = description;
              s.content = file.content;
              s.location = file.path;
            });
          } else {
            draft.add(info);
          }
        } catch (err) {
          console.warn(`[maestria-v2] Failed to register skill "${file.name}":`, err);
        }
      }
    });
  });
}
