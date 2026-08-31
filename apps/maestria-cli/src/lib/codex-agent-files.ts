/** Native Codex custom-agent naming and TOML editing helpers. */

export const CODEX_AGENT_PREFIX = 'maestria-';

const escapeRegExp = (value: string): string => value.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const topLevelSettingLine = (lines: readonly string[], key: string): number => {
  const pattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`, 'u');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) {
      continue;
    }
    if (/^\s*\[/u.test(line)) {
      break;
    }
    if (pattern.test(line)) {
      return index;
    }
  }
  return -1;
};

export const codexManagedAgentName = (agent: string): string => `${CODEX_AGENT_PREFIX}${agent}`;

export const codexManagedAgentFileName = (agent: string): string =>
  `${codexManagedAgentName(agent)}.toml`;

/** Read a top-level TOML string setting without entering a table section. */
export const parseCodexTopLevelString = (content: string, key: string): string | undefined => {
  for (const line of content.split(/\r?\n/u)) {
    if (/^\s*\[/u.test(line)) {
      break;
    }
    const match = new RegExp(
      `^\\s*${escapeRegExp(key)}\\s*=\\s*(?:"((?:\\.|[^"])*)"|'([^']*)'|([^#\\s]+))`,
      'u',
    ).exec(line);
    if (!match) {
      continue;
    }
    if (match[1] !== undefined) {
      try {
        const parsed: unknown = JSON.parse(`"${match[1]}"`);
        return typeof parsed === 'string' ? parsed : undefined;
      } catch {
        return undefined;
      }
    }
    return match[2] ?? match[3];
  }
  return undefined;
};

/** Set or remove a top-level TOML string setting while preserving other text. */
export const setCodexTopLevelString = (
  content: string,
  key: string,
  value: string | undefined,
): string => {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const hasFinalNewline = /\r?\n$/u.test(content);
  const lines = content.split(/\r?\n/u);
  if (hasFinalNewline) {
    lines.pop();
  }

  const index = topLevelSettingLine(lines, key);
  if (value !== undefined) {
    const rendered = `${key} = ${JSON.stringify(value)}`;
    if (index >= 0) {
      const existing = lines[index] ?? '';
      const comment = /(?<comment>\s+#.*)$/u.exec(existing)?.groups?.comment ?? '';
      lines[index] = `${rendered}${comment}`;
    } else {
      const section = lines.findIndex((line) => /^\s*\[/u.test(line));
      lines.splice(section === -1 ? lines.length : section, 0, rendered);
    }
  } else if (index >= 0) {
    lines.splice(index, 1);
  }

  const result = lines.join(newline);
  return hasFinalNewline ? `${result}${newline}` : result;
};

/**
 * Refresh a bundled agent while preserving user-selected runtime settings.
 * Prompt/role metadata comes from the package; model tuning stays user-owned.
 */
export const mergeCodexAgentSettings = (
  bundled: string,
  existing: string,
  keys: readonly string[] = ['model', 'model_reasoning_effort', 'service_tier'],
): string => {
  let content = bundled;
  for (const key of keys) {
    const value = parseCodexTopLevelString(existing, key);
    if (value !== undefined) {
      content = setCodexTopLevelString(content, key, value);
    }
  }
  return content;
};
