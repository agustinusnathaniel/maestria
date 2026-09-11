/** Shared `model:` frontmatter parsing and editing for markdown agent files. */

const FRONTMATTER_BODY = /^---\r?\n(?<body>[\s\S]*?)\r?\n---/u;
const FRONTMATTER_EDIT =
  /^(?<opening>---\r?\n)(?<body>[\s\S]*?)(?<closing>\r?\n---)(?<afterClosing>\r?\n?)/u;
const MODEL_LINE = /^model:\s*(?<model>.+?)\s*$/mu;
const QUOTED_MODEL_LINE = /^model:\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<plain>.+?))\s*$/mu;

/** Parse the model with the requested fallback-to-content and unquoting semantics. */
export const parseAgentFrontmatterModel = (
  content: string,
  options: { fallbackToContent?: boolean; unquote?: boolean } = {},
): string | undefined => {
  const body = FRONTMATTER_BODY.exec(content)?.groups?.body;
  if (body === undefined && options.fallbackToContent !== true) {
    return undefined;
  }
  const match = (options.unquote === true ? QUOTED_MODEL_LINE : MODEL_LINE).exec(body ?? content);
  return options.unquote === true
    ? (match?.groups?.double ?? match?.groups?.single ?? match?.groups?.plain)
    : match?.groups?.model;
};

/** Set or remove the model with the requested frontmatter creation and fence semantics. */
export const setAgentFrontmatterModel = (
  content: string,
  model: string,
  options: { createFrontmatter?: boolean; preserveDelimiters?: boolean } = {},
): string => {
  const match = FRONTMATTER_EDIT.exec(content);
  if (match === null) {
    return options.createFrontmatter === true && model !== ''
      ? `---\nmodel: ${model}\n---\n\n${content}`
      : content;
  }
  const lines = (match.groups?.body ?? '').split(/\r?\n/u);
  const index = lines.findIndex((line) => /^model:\s*/u.test(line));
  if (model !== '') {
    lines[index === -1 ? lines.length : index] = `model: ${model}`;
  } else if (index !== -1) {
    lines.splice(index, 1);
  }
  const body = lines.join('\n');
  const afterClosing = match.groups?.afterClosing ?? '';
  const [opening, closing] =
    options.preserveDelimiters === true
      ? [match.groups?.opening ?? '', match.groups?.closing ?? '']
      : ['---\n', '\n---'];
  return `${opening}${body}${closing}${afterClosing}${content.slice(match[0].length)}`;
};
