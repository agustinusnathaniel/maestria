export const CODEX_MANAGED_INSTRUCTIONS_START = '<!-- maestria:codex-orchestrator:start -->';
export const CODEX_MANAGED_INSTRUCTIONS_END = '<!-- maestria:codex-orchestrator:end -->';

export const CODEX_GLOBAL_INSTRUCTION_FILENAMES = ['AGENTS.override.md', 'AGENTS.md'] as const;
export type CodexGlobalInstructionFilename = (typeof CODEX_GLOBAL_INSTRUCTION_FILENAMES)[number];

interface ManagedInstructionRange {
  readonly start: number;
  readonly end: number;
}

const markerOffsets = (content: string, marker: string): number[] => {
  const offsets: number[] = [];
  let offset = content.indexOf(marker);
  while (offset >= 0) {
    offsets.push(offset);
    offset = content.indexOf(marker, offset + marker.length);
  }
  return offsets;
};

const hasExactlyOne = (content: string, marker: string): boolean =>
  markerOffsets(content, marker).length === 1;

const normalizeManagedBlock = (block: string): string => {
  const normalized = block.trim();
  if (!hasExactlyOne(normalized, CODEX_MANAGED_INSTRUCTIONS_START)) {
    throw new Error('Codex maestria instruction block is missing its start marker');
  }
  if (!hasExactlyOne(normalized, CODEX_MANAGED_INSTRUCTIONS_END)) {
    throw new Error('Codex maestria instruction block is missing its end marker');
  }
  if (
    normalized.indexOf(CODEX_MANAGED_INSTRUCTIONS_START) >
    normalized.indexOf(CODEX_MANAGED_INSTRUCTIONS_END)
  ) {
    throw new Error('Codex maestria instruction block markers are out of order');
  }
  return normalized;
};

/** Malformed/duplicated markers throw so installs cannot damage user files. */
export const codexManagedInstructionRange = (
  content: string,
): ManagedInstructionRange | undefined => {
  const starts = markerOffsets(content, CODEX_MANAGED_INSTRUCTIONS_START);
  const ends = markerOffsets(content, CODEX_MANAGED_INSTRUCTIONS_END);

  if (starts.length === 0 && ends.length === 0) {
    return undefined;
  }
  if (starts.length !== 1 || ends.length !== 1 || starts[0] > ends[0]) {
    throw new Error('Codex maestria instruction markers are malformed or duplicated');
  }

  return {
    end: ends[0] + CODEX_MANAGED_INSTRUCTIONS_END.length,
    start: starts[0],
  };
};

export const hasCodexManagedInstructions = (content: string): boolean =>
  codexManagedInstructionRange(content) !== undefined;

export const upsertCodexManagedInstructions = (content: string, block: string): string => {
  const normalizedBlock = normalizeManagedBlock(block);
  const range = codexManagedInstructionRange(content);
  if (range) {
    return `${content.slice(0, range.start)}${normalizedBlock}${content.slice(range.end)}`;
  }

  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  if (content.length === 0) {
    return `${normalizedBlock}${newline}`;
  }

  const separator = content.endsWith('\n') ? newline : `${newline}${newline}`;
  return `${content}${separator}${normalizedBlock}${newline}`;
};

export const removeCodexManagedInstructions = (content: string): string => {
  const range = codexManagedInstructionRange(content);
  if (!range) {
    return content;
  }

  const before = content.slice(0, range.start);
  const after = content.slice(range.end);
  const newline = content.includes('\r\n') ? '\r\n' : '\n';

  // Undoes upsert's blank-line separator without touching other user text.
  if (before.endsWith(`${newline}${newline}`) && after.startsWith(newline)) {
    return `${before.slice(0, -newline.length)}${after.slice(newline.length)}`;
  }
  if (before.length === 0 && after.startsWith(newline)) {
    return after.slice(newline.length);
  }
  return `${before}${after}`;
};
