// Shared filesystem/frontmatter validation for Pi/OMP skill validators.
// Pure wrapper over node:fs - no host SDK imports.
// Keeps the byte-identical logic from packages/pi/scripts/validate-skills.ts
// and packages/omp/scripts/validate-skills.ts in one place.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ValidateSkillsOptions {
  /** Directory that contains `skills/<name>/SKILL.md` relative structure. */
  root: string;
  /** Skill directory names to validate. */
  skills: readonly string[];
}

export interface ValidateSkillsResult {
  valid: boolean;
  errors: string[];
  successes: string[];
}

/**
 * Validate a list of skill files under `root`.
 * Mirrors the original Pi/OMP validator:
 * - existsSync check
 * - frontmatter `---` block match
 * - `name:` and `description:` presence in frontmatter
 * - non-empty body after frontmatter (`\n---` split)
 *
 * Pure I/O helper - callers own console logging and process exit.
 */
export function validateSkills(opts: ValidateSkillsOptions): ValidateSkillsResult {
  const { root, skills } = opts;
  const errors: string[] = [];
  const successes: string[] = [];

  for (const name of skills) {
    const path = join(root, 'skills', name, 'SKILL.md');
    if (!existsSync(path)) {
      errors.push(`Missing: skills/${name}/SKILL.md`);
      continue;
    }
    const content = readFileSync(path, 'utf-8');
    const frontmatterMatch = /^---\n([\s\S]*?)\n---/u.exec(content);
    if (!frontmatterMatch) {
      errors.push(`skills/${name}/SKILL.md: missing or invalid frontmatter`);
      continue;
    }
    const frontmatter = frontmatterMatch[1] ?? '';
    if (!frontmatter.includes('name:')) {
      errors.push(`skills/${name}/SKILL.md: frontmatter missing "name"`);
    }
    if (!frontmatter.includes('description:')) {
      errors.push(`skills/${name}/SKILL.md: frontmatter missing "description"`);
    }
    const afterFrontmatter = content.trim().split('\n---')[1]?.trim() ?? '';
    if (afterFrontmatter.length === 0) {
      errors.push(`skills/${name}/SKILL.md: no body content after frontmatter`);
    }
    // Preserve prior Pi/OMP contract: emit ✅ whenever frontmatter exists,
    // even if name/description/body checks also emitted ❌ errors.
    // Missing file or invalid frontmatter already continued above without success.
    successes.push(`skills/${name}/SKILL.md`);
  }

  return { errors, successes, valid: errors.length === 0 };
}

/**
 * CLI helper: validate and log to console with the original ✅/❌ format,
 * preserving per-skill interleaving. Returns `true` if all valid.
 */
export function validateSkillsAndLog(opts: ValidateSkillsOptions): boolean {
  const { root, skills } = opts;
  let allValid = true;
  for (const name of skills) {
    const result = validateSkills({ root, skills: [name] });
    for (const err of result.errors) {
      console.error(`❌ ${err}`);
      allValid = false;
    }
    for (const ok of result.successes) {
      console.log(`✅ ${ok}`);
    }
    if (!result.valid) {
      allValid = false;
    }
  }
  return allValid;
}
