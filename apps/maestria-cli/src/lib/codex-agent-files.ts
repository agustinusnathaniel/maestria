/** Native Codex custom-agent naming and TOML editing helpers. */

export const CODEX_AGENT_PREFIX = 'maestria-';

export function codexManagedAgentName(agent: string): string {
  return `${CODEX_AGENT_PREFIX}${agent}`;
}

export function codexManagedAgentFileName(agent: string): string {
  return `${codexManagedAgentName(agent)}.toml`;
}

/** Read a top-level TOML string setting without entering a table section. */
export function parseCodexTopLevelString(content: string, key: string): string | undefined {
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
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from broader type via prior validation, safe string/boolean assertion
        return JSON.parse(`"${match[1]}"`) as string;
      } catch {
        return undefined;
      }
    }
    return match[2] ?? match[3];
  }
  return undefined;
}

/** Set or remove a top-level TOML string setting while preserving other text. */
export function setCodexTopLevelString(
  content: string,
  key: string,
  value: string | undefined,
): string {
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
      const comment = /(\s+#.*)$/u.exec(existing)?.[1] ?? '';
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
}

/**
 * Refresh a bundled agent while preserving user-selected runtime settings.
 * Prompt/role metadata comes from the package; model tuning stays user-owned.
 */
export function mergeCodexAgentSettings(
  bundled: string,
  existing: string,
  keys: readonly string[] = ['model', 'model_reasoning_effort', 'service_tier'],
): string {
  return keys.reduce((content, key) => {
    const value = parseCodexTopLevelString(existing, key);
    return value === undefined ? content : setCodexTopLevelString(content, key, value);
  }, bundled);
}

function topLevelSettingLine(lines: readonly string[], key: string): number {
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
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
