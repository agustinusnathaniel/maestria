import type { Decision } from './types.js';
import { ALLOW, ask } from './types.js';

const GENERATED_MARKERS = [
  /@generated\b/u,
  /DO NOT EDIT/u,
  /Do not edit directly/iu,
  /\bGenerated (?:by|from)\b/u,
];
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/u;

/** The marker that shows a file is generated, read from its first five lines after any frontmatter. */
export const generatedMarker = (text: string): string | undefined => {
  const head = text.replace(FRONTMATTER, '').split('\n').slice(0, 5).join('\n');
  return GENERATED_MARKERS.map((marker) => marker.exec(head)?.[0]).find(
    (found) => found !== undefined,
  );
};

const PATH_KEYS = ['file_path', 'filePath', 'path', 'target_file', 'notebook_path', 'filename'];
const PATCH_KEYS = ['command', 'input', 'patch'];
const PATCHED_FILE = /^\*\*\* (?:Update|Delete) File: (?<file>.+)$/gmu;

/** Existing files an edit or write tool call targets, from its path fields or an apply_patch body. */
export const editTargets = (toolInput: unknown): string[] => {
  if (typeof toolInput !== 'object' || toolInput === null) {
    return [];
  }
  const field = (key: string): unknown => Reflect.get(toolInput, key);
  const paths = PATH_KEYS.map(field).filter(
    (value): value is string => typeof value === 'string' && value !== '',
  );
  for (const key of PATCH_KEYS) {
    const value = field(key);
    if (typeof value === 'string') {
      paths.push(
        ...[...value.matchAll(PATCHED_FILE)].map((match) => match.groups?.file.trim() ?? ''),
      );
    }
  }
  return [...new Set(paths)];
};

/** Ask before an edit tool changes a generated file; scripts that regenerate it are unaffected. */
export const classifyGeneratedEdit = (
  files: readonly string[],
  readHead: (file: string) => string | undefined,
): Decision => {
  for (const file of files) {
    const head = readHead(file);
    const marker = head === undefined ? undefined : generatedMarker(head);
    if (marker !== undefined) {
      return ask(`${file} is generated (${marker}); edit its source and regenerate`);
    }
  }
  return ALLOW;
};
