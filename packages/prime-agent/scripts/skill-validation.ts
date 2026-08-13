// Pure validation helpers shared by the Prime Agent skill validator
// (`validate-skills.ts`) and its tests. No I/O and no platform imports, so the
// tests exercise the exact name grammar and frontmatter normalization the
// validator applies.

// Prime's documented skill name grammar (Agent Skills specification): 1-64
// characters, lowercase letters, digits, and hyphens; no leading or trailing
// hyphen; no consecutive hyphens. Matching the parent skill directory is
// enforced separately by the validator.
export const NAME_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const NAME_MAX = 64;

// Prime's documented description limit (Agent Skills specification).
export const DESCRIPTION_MAX = 1024;

/**
 * Whether `name` satisfies the Agent Skills name grammar: 1-64 characters,
 * lowercase a-z/0-9/hyphens, no leading/trailing hyphen, no consecutive
 * hyphens.
 */
export function isValidSkillName(name: string): boolean {
  return name.length >= 1 && name.length <= NAME_MAX && NAME_RE.test(name) && !name.includes('--');
}

/**
 * Strips matching outer single or double quotes from a YAML scalar value so a
 * quoted `name` or `description` is validated by its actual value. Handles the
 * plain and quoted scalar forms the generated frontmatter uses; does not
 * interpret escapes or multi-line quoted forms.
 */
function unquoteScalar(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Extracts the normalized value of a frontmatter key (plain or quoted scalar,
 * or block/folded scalar), or `undefined` when the key is absent. Quoted
 * scalars are unquoted and trimmed, so `""` and `"   "` yield `''`; an empty
 * value (a bare `key:` or an indicator with no indented continuation lines)
 * also yields `''`.
 */
export function frontmatterValue(frontmatter: string, key: string): string | undefined {
  const lines = frontmatter.split('\n');
  const keyLine = lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
  if (keyLine === -1) return undefined;
  const inline = lines[keyLine].slice(key.length + 1).trim();
  if (inline !== '' && !/^[|>][-+]?$/.test(inline)) return unquoteScalar(inline).trim();
  return lines
    .slice(keyLine + 1)
    .filter((line) => /^\s{2}/.test(line))
    .map((line) => line.trim())
    .join(' ')
    .trim();
}
