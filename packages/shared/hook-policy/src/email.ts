import type { Decision, ShellContext } from './types.js';
import { ALLOW, ask } from './types.js';
import { basename, program, splitCommands } from './shell.js';
import { parseGit } from './git.js';

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/gu;
const NOREPLY = /(?:^no-?reply@|@users\.noreply\.github\.com$)/iu;

/** Email addresses in `text`, excluding noreply addresses such as GitHub's commit emails. */
export const findEmails = (text: string): string[] =>
  [...text.matchAll(EMAIL)].map((match) => match[0]).filter((email) => !NOREPLY.test(email));

/** An email with its local part masked, so a hook message does not repeat the address. */
export const maskEmail = (email: string): string =>
  `${email[0]}***${email.slice(email.indexOf('@'))}`;

const readValue = (value: string, context: ShellContext): string =>
  value === '-' ? '' : (context.readFile?.(value) ?? '');

const optionValues = (
  args: readonly string[],
  inline: ReadonlySet<string>,
  files: ReadonlySet<string>,
  context: ShellContext,
): string[] => {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const equals = arg.indexOf('=');
    const short = arg.slice(0, 2);
    // `--name=value` and attached short values such as `-mTEXT` carry the value in the word.
    let name = arg;
    if (arg.startsWith('--') && equals > 0) {
      name = arg.slice(0, equals);
    } else if (!arg.startsWith('--') && arg.length > 2 && (inline.has(short) || files.has(short))) {
      name = short;
    }
    let attached = args[index + 1];
    if (name !== arg) {
      attached = name === short ? arg.slice(2) : arg.slice(equals + 1);
    }
    if (inline.has(name) || files.has(name)) {
      if (attached !== undefined) {
        values.push(files.has(name) ? readValue(attached, context) : attached);
      }
      if (name === arg) {
        index += 1;
      }
    }
  }
  return values;
};

const GH_TEXT = new Set(['--body', '--title', '-b', '-t']);
const GH_FILES = new Set(['--body-file', '-F']);
const GH_API_FIELDS = new Set(['-f', '-F', '--field', '--raw-field']);
const GIT_MESSAGE = new Set(['-m', '--message']);
const GIT_MESSAGE_FILES = new Set(['-F', '--file']);
const GH_WRITES: Record<string, ReadonlySet<string>> = {
  issue: new Set(['comment', 'create', 'edit']),
  pr: new Set(['comment', 'create', 'edit', 'review']),
};

/** Text a command publishes: PR, issue, and API bodies from `gh`, and `git commit` messages. */
export const outgoingText = (command: string, context: ShellContext): string[] =>
  splitCommands(command).flatMap((raw) => {
    const words = program(raw);
    if (words.length > 1 && basename(words[0]) === 'gh') {
      const [, area, action, ...rest] = words;
      if (area === 'api') {
        return optionValues([action, ...rest], GH_API_FIELDS, new Set(), context).map((field) =>
          field.includes('=@')
            ? readValue(field.slice(field.indexOf('=@') + 2), context)
            : field.slice(field.indexOf('=') + 1),
        );
      }
      return GH_WRITES[area]?.has(action) ? optionValues(rest, GH_TEXT, GH_FILES, context) : [];
    }
    const git = parseGit(words);
    return git?.subcommand === 'commit'
      ? optionValues(git.args, GIT_MESSAGE, GIT_MESSAGE_FILES, context)
      : [];
  });

/** Ask before PR, issue, API, or commit text that names a person by email address. */
export const classifyEmailScan = (command: string, context: ShellContext): Decision => {
  const emails = outgoingText(command, context).flatMap(findEmails);
  return emails.length === 0
    ? ALLOW
    : ask(
        `outgoing PR, issue, or commit text contains an email address (${[...new Set(emails)].map(maskEmail).join(', ')}); refer to people by id, count, or hash instead`,
      );
};
