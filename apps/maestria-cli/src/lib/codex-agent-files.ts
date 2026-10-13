/** Native Codex custom-agent naming and TOML editing helpers. */

export const CODEX_AGENT_PREFIX = 'maestria-';

const escapeRegExp = (value: string): string => value.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');

interface TomlStatement {
  start: number;
  end: number;
  valueEnd: number;
}

const quotedStringEnd = (content: string, start: number): number => {
  const quote = content[start] ?? '';
  const delimiter = content.startsWith(quote.repeat(3), start) ? quote.repeat(3) : quote;
  for (let index = start + delimiter.length; index < content.length; index += 1) {
    if (quote === '"' && content[index] === '\\') {
      index += 1;
    } else if (content.startsWith(delimiter, index)) {
      index += delimiter.length;
      if (delimiter.length === 3) {
        while (content[index] === quote) {
          index += 1;
        }
      }
      return index;
    }
  }
  return content.length;
};

/** Locate root statements, keeping strings, comments, and container values opaque. */
const rootStatements = (content: string): TomlStatement[] => {
  const statements: TomlStatement[] = [];
  let start = 0;
  let depth = 0;
  let commentStart: number | undefined;

  for (let index = 0; index <= content.length; index += 1) {
    const character = content[index];
    if (character === '\n' || character === undefined) {
      if (depth === 0) {
        const valueEnd = commentStart ?? index;
        const statement = { end: character === undefined ? index : index + 1, start, valueEnd };
        if (content.slice(start, valueEnd).trimStart().startsWith('[')) {
          statements.push(statement);
          break;
        }
        statements.push(statement);
        start = index + 1;
      }
      commentStart = undefined;
    } else if (character === '#') {
      if (depth === 0) {
        commentStart = index;
      }
      while (index + 1 < content.length && content[index + 1] !== '\n') {
        index += 1;
      }
    } else if (character === '"' || character === "'") {
      index = quotedStringEnd(content, index) - 1;
    } else if (character === '[' || character === '{') {
      depth += 1;
    } else if (character === ']' || character === '}') {
      depth -= 1;
    }
  }
  return statements;
};

interface TomlSetting extends TomlStatement {
  valueStart: number;
  rawValue: string;
}

const setting = (
  content: string,
  key: string,
  statements: readonly TomlStatement[],
): TomlSetting | undefined => {
  const escapedKey = escapeRegExp(key);
  const pattern = new RegExp(
    `^[ \\t]*(?:${escapedKey}|"${escapedKey}"|'${escapedKey}')[ \\t]*=[ \\t]*`,
    'u',
  );
  let found: TomlSetting | undefined;
  for (const statement of statements) {
    const match = pattern.exec(content.slice(statement.start, statement.valueEnd));
    if (match) {
      const valueStart = statement.start + match[0].length;
      const rawValue = content.slice(valueStart, statement.valueEnd).trimEnd();
      found = { ...statement, rawValue, valueEnd: valueStart + rawValue.length, valueStart };
      break;
    }
  }
  return found;
};

const parseBasicString = (value: string, multiline: boolean): string | undefined => {
  const escapes: Record<string, string> = {
    '"': '"',
    '\\': '\\',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
  };
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== '\\') {
      result += character;
      continue;
    }
    const continuation = multiline ? /^\\[ \t]*\n[ \t\n]*/u.exec(value.slice(index)) : undefined;
    if (continuation) {
      index += continuation[0].length - 1;
      continue;
    }
    const escape = value[index + 1] ?? '';
    if (escape === 'u' || escape === 'U') {
      const length = escape === 'u' ? 4 : 8;
      const digits = value.slice(index + 2, index + 2 + length);
      const codePoint = Number.parseInt(digits, 16);
      if (
        !/^[\da-f]+$/iu.test(digits) ||
        digits.length !== length ||
        codePoint > 0x10_ff_ff ||
        (codePoint >= 0xd8_00 && codePoint <= 0xdf_ff)
      ) {
        return undefined;
      }
      result += String.fromCodePoint(codePoint);
      index += length + 1;
    } else if (escapes[escape] === undefined) {
      return undefined;
    } else {
      result += escapes[escape];
      index += 1;
    }
  }
  return result;
};

export const codexManagedAgentName = (agent: string): string => `${CODEX_AGENT_PREFIX}${agent}`;

export const codexManagedAgentFileName = (agent: string): string =>
  `${codexManagedAgentName(agent)}.toml`;

/** Read a top-level TOML string setting without entering a table section. */
export const parseCodexTopLevelString = (content: string, key: string): string | undefined => {
  const value = setting(content, key, rootStatements(content))?.rawValue;
  if (value === undefined) {
    return undefined;
  }
  const multiline = value.startsWith('"""') || value.startsWith("'''");
  const delimiter = multiline ? value.slice(0, 3) : value.slice(0, 1);
  if (delimiter !== '"' && delimiter !== "'" && !multiline) {
    return /^[^#\s]+$/u.test(value) ? value : undefined;
  }
  if (!value.endsWith(delimiter) || value.length < delimiter.length * 2) {
    return undefined;
  }
  let body = value.slice(delimiter.length, -delimiter.length).replaceAll('\r\n', '\n');
  if (multiline && body.startsWith('\n')) {
    body = body.slice(1);
  }
  return delimiter.startsWith("'") ? body : parseBasicString(body, multiline);
};

/** Set or remove a top-level TOML string setting while preserving other text. */
export const setCodexTopLevelString = (
  content: string,
  key: string,
  value: string | undefined,
): string => {
  const statements = rootStatements(content);
  const existing = setting(content, key, statements);
  if (existing) {
    return value === undefined
      ? content.slice(0, existing.start) + content.slice(existing.end)
      : content.slice(0, existing.valueStart) +
          JSON.stringify(value) +
          content.slice(existing.valueEnd);
  }
  if (value === undefined) {
    return content;
  }
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const table = statements.find((statement) =>
    content.slice(statement.start, statement.valueEnd).trimStart().startsWith('['),
  );
  const position = table?.start ?? content.length;
  const prefix = content.slice(0, position);
  const separator = prefix.length > 0 && !prefix.endsWith('\n') ? newline : '';
  const suffix = table || content.endsWith('\n') ? newline : '';
  return `${prefix}${separator}${key} = ${JSON.stringify(value)}${suffix}${content.slice(position)}`;
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
