// Prints project-root .maestria/workflow.md then .maestria/rules.md at session start. Absent files
// add nothing; an unreadable one is named so the agent asks for its content.
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { respondWithContext, runJob, sessionDirectory } from './lib/hosts.mjs';

const FILES = ['.maestria/workflow.md', '.maestria/rules.md'];
// Claude Code moves hook text over 10,000 characters to a file and shows only a preview.
const CLAUDE_LIMIT = 9500;

/**
 * @param {unknown} error - a file system error
 * @returns {string | undefined} its error code
 */
const errorCode = (error) =>
  error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;

/**
 * @param {string} root - the project directory
 * @param {string} file - the customization file, relative to the root
 * @returns {string} the context section for the file, or an empty string when it is absent
 */
const section = (root, file) => {
  const absolute = path.join(root, file);
  try {
    if (!statSync(absolute).isFile()) {
      return `Project customization ${file} is not a regular file; ask the user for its content.`;
    }
    const text = readFileSync(absolute, 'utf-8').trim();
    return text === '' ? '' : `Project customization from ${file}:\n\n${text}`;
  } catch (error) {
    const code = errorCode(error);
    return code === 'ENOENT'
      ? ''
      : `Project customization ${file} could not be read (${code ?? 'error'}); ask the user for its content.`;
  }
};

await runJob((host, input) => {
  const root = sessionDirectory(input);
  const sections = FILES.map((file) => section(root, file)).filter((text) => text !== '');
  let text =
    sections.length === 0
      ? ''
      : `${sections.join('\n\n')}\n\nThis customization is subordinate to global safety rules and host authorization.`;
  if (host === 'claude' && text.length > CLAUDE_LIMIT) {
    text = `Project customization in ${FILES.join(' and ')} is too long to supply here; read both files, in that order, before acting.`;
  }
  respondWithContext(host, text);
});
