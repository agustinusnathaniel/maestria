import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';

import { validateMcp } from './agent-plugin-mcp.js';

export const AGENT_PLUGIN_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
export { AGENT_PLUGIN_MCP_SCHEMA } from './agent-plugin-mcp.js';

const PLUGIN_NAME_RE = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;
const SKILL_NAME_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const PLUGIN_MANIFEST_FIELDS = new Set([
  '$schema',
  'author',
  'description',
  'extensions',
  'homepage',
  'keywords',
  'license',
  'name',
  'repository',
  'version',
]);
const AUTHOR_FIELDS = new Set(['email', 'name', 'url']);

type JsonRecord = Record<string, unknown>;

export interface AgentPluginValidation {
  readonly errors: string[];
  readonly name?: string;
  readonly root: string;
  readonly skillNames: string[];
  readonly valid: boolean;
  readonly version?: string;
  readonly warnings: string[];
}

interface ValidationDraft {
  errors: string[];
  name?: string;
  root: string;
  skillNames: string[];
  version?: string;
  warnings: string[];
}

interface SkillValidationResult {
  errors: string[];
  skillName?: string;
  warnings: string[];
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isFileNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

const isWithin = (root: string, target: string): boolean => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const addError = (report: ValidationDraft, message: string): void => {
  report.errors.push(message);
};

const finalize = (draft: ValidationDraft): AgentPluginValidation => ({
  errors: draft.errors,
  ...(draft.name === undefined ? {} : { name: draft.name }),
  root: draft.root,
  skillNames: draft.skillNames.toSorted(),
  valid: draft.errors.length === 0 && draft.name !== undefined,
  ...(draft.version === undefined ? {} : { version: draft.version }),
  warnings: draft.warnings,
});

const readJsonRecord = async (filePath: string): Promise<JsonRecord> => {
  const parsed: unknown = JSON.parse(await readFile(filePath, 'utf-8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`${filePath} must contain a JSON object`);
  }
  return parsed;
};

const validateStringFields = (
  manifest: JsonRecord,
  fields: string[],
  report: ValidationDraft,
): void => {
  for (const field of fields) {
    const value = manifest[field];
    if (value !== undefined && typeof value !== 'string') {
      addError(report, `plugin.json field "${field}" must be a string`);
    }
  }
};

const validateAuthor = (value: unknown, report: ValidationDraft): void => {
  if (!isRecord(value)) {
    addError(report, 'plugin.json field "author" must be an object');
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!AUTHOR_FIELDS.has(key)) {
      addError(report, `plugin.json field "author.${key}" is not allowed`);
    } else if (typeof entry !== 'string') {
      addError(report, `plugin.json field "author.${key}" must be a string`);
    }
  }
};

const validateExtensions = (value: unknown, report: ValidationDraft): void => {
  if (!isRecord(value)) {
    addError(report, 'plugin.json field "extensions" must be an object');
    return;
  }
  for (const [namespace, extension] of Object.entries(value)) {
    if (!isRecord(extension)) {
      addError(report, `plugin.json extension "${namespace}" must be an object`);
    }
  }
};

const validateManifest = async (root: string, report: ValidationDraft): Promise<void> => {
  const manifestPath = path.join(root, 'plugin.json');
  const resolvedManifestPath = await realpath(manifestPath).catch(() => manifestPath);
  if (!isWithin(root, resolvedManifestPath)) {
    addError(report, 'plugin.json resolves outside the plugin root');
    return;
  }

  let manifest: JsonRecord;
  try {
    manifest = await readJsonRecord(manifestPath);
  } catch (error) {
    addError(report, error instanceof Error ? error.message : String(error));
    return;
  }

  for (const field of Object.keys(manifest)) {
    if (!PLUGIN_MANIFEST_FIELDS.has(field)) {
      addError(report, `plugin.json field "${field}" is not part of Agent Plugins v1`);
    }
  }
  if (manifest.$schema !== AGENT_PLUGIN_SCHEMA) {
    addError(report, `plugin.json "$schema" must be ${AGENT_PLUGIN_SCHEMA}`);
  }

  const { name, version } = manifest;
  if (typeof name !== 'string' || name === '') {
    addError(report, 'plugin.json field "name" is required and must be a non-empty string');
  } else {
    report.name = name;
    if (name.length > MAX_NAME_LENGTH || !PLUGIN_NAME_RE.test(name)) {
      addError(report, `plugin.json field "name" is not a valid Agent Plugins v1 name: ${name}`);
    }
  }
  if (typeof version === 'string' && version !== '') {
    report.version = version;
  }
  validateStringFields(
    manifest,
    ['description', 'homepage', 'repository', 'license', 'version'],
    report,
  );
  if (manifest.author !== undefined) {
    validateAuthor(manifest.author, report);
  }
  if (manifest.keywords !== undefined && !isStringArray(manifest.keywords)) {
    addError(report, 'plugin.json field "keywords" must be an array of strings');
  }
  if (manifest.extensions !== undefined) {
    validateExtensions(manifest.extensions, report);
  }
};

const parseSkill = (content: string, skillDirectory: string): SkillValidationResult => {
  const result: SkillValidationResult = { errors: [], warnings: [] };
  const frontmatter = /^(?<fence>---\r?\n(?<body>[\s\S]*?)\r?\n---(?:\r?\n|$))/u.exec(content);
  const frontmatterBody = frontmatter?.groups?.body;
  const fullFrontmatter = frontmatter?.groups?.fence;
  if (frontmatterBody === undefined || fullFrontmatter === undefined) {
    result.errors.push(`${skillDirectory}/SKILL.md is missing YAML frontmatter`);
    return result;
  }

  const document = parseDocument(frontmatterBody);
  if (document.errors.length > 0) {
    result.errors.push(`${skillDirectory}/SKILL.md has invalid YAML frontmatter`);
    return result;
  }
  const data: unknown = document.toJS();
  if (!isRecord(data)) {
    result.errors.push(`${skillDirectory}/SKILL.md frontmatter must be an object`);
    return result;
  }

  const { name, description } = data;
  if (typeof name !== 'string' || name === '') {
    result.errors.push(`${skillDirectory}/SKILL.md frontmatter requires a non-empty name`);
  } else {
    result.skillName = name;
    if (name !== path.basename(skillDirectory)) {
      result.errors.push(`${skillDirectory}/SKILL.md name must match its directory`);
    }
    if (name.length > MAX_NAME_LENGTH || !SKILL_NAME_RE.test(name)) {
      result.errors.push(
        `${skillDirectory}/SKILL.md name is not a valid Agent Skill name: ${name}`,
      );
    }
  }
  if (typeof description !== 'string' || description.trim() === '') {
    result.errors.push(`${skillDirectory}/SKILL.md frontmatter requires a description`);
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    result.errors.push(
      `${skillDirectory}/SKILL.md description exceeds ${MAX_DESCRIPTION_LENGTH} characters`,
    );
  }
  if (content.slice(fullFrontmatter.length).trim() === '') {
    result.errors.push(`${skillDirectory}/SKILL.md must contain instructions after frontmatter`);
  }
  return result;
};

const validateSkillEntry = async (
  root: string,
  skillsPath: string,
  entry: { isDirectory: () => boolean; isSymbolicLink: () => boolean; name: string },
): Promise<SkillValidationResult> => {
  const result: SkillValidationResult = { errors: [], warnings: [] };
  if (!entry.isDirectory() && !entry.isSymbolicLink()) {
    return result;
  }
  const skillDirectory = path.join(skillsPath, entry.name);
  let directoryStat: Awaited<ReturnType<typeof stat>>;
  try {
    directoryStat = await stat(skillDirectory);
  } catch {
    result.errors.push(`skill directory cannot be read: ${entry.name}`);
    return result;
  }
  if (!directoryStat.isDirectory()) {
    return result;
  }
  if (!isWithin(root, await realpath(skillDirectory))) {
    result.errors.push(`${entry.name} resolves outside the plugin root`);
    return result;
  }

  const skillPath = path.join(skillDirectory, 'SKILL.md');
  let skillStat: Awaited<ReturnType<typeof stat>>;
  try {
    skillStat = await stat(skillPath);
  } catch {
    return result;
  }
  if (!skillStat.isFile()) {
    result.errors.push(`${entry.name}/SKILL.md must be a regular file`);
    return result;
  }
  if (!isWithin(root, await realpath(skillPath))) {
    result.errors.push(`${entry.name}/SKILL.md resolves outside the plugin root`);
    return result;
  }
  return parseSkill(await readFile(skillPath, 'utf-8'), entry.name);
};

const validateSkills = async (root: string, report: ValidationDraft): Promise<void> => {
  const skillsPath = path.join(root, 'skills');
  let skillsStat: Awaited<ReturnType<typeof stat>>;
  try {
    skillsStat = await stat(skillsPath);
  } catch (error) {
    if (isFileNotFound(error)) {
      return;
    }
    addError(report, `skills cannot be read: ${String(error)}`);
    return;
  }
  if (!skillsStat.isDirectory()) {
    addError(report, 'skills must resolve to a directory');
    return;
  }
  if (!isWithin(root, await realpath(skillsPath))) {
    addError(report, 'skills resolves outside the plugin root');
    return;
  }

  const entries = await readdir(skillsPath, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (entry) => await validateSkillEntry(root, skillsPath, entry)),
  );
  for (const result of results) {
    report.errors.push(...result.errors);
    report.warnings.push(...result.warnings);
    if (result.skillName !== undefined) {
      report.skillNames.push(result.skillName);
    }
  }
};

const resolvePluginRoot = async (input: string): Promise<string> => {
  const candidate = path.resolve(input);
  const info = await stat(candidate);
  if (!info.isDirectory()) {
    throw new Error(`${candidate} is not a directory`);
  }
  return await realpath(candidate);
};

export const validateAgentPlugin = async (input: string): Promise<AgentPluginValidation> => {
  const requestedRoot = path.resolve(input);
  let root: string;
  try {
    root = await resolvePluginRoot(input);
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : String(error)],
      root: requestedRoot,
      skillNames: [],
      valid: false,
      warnings: [],
    };
  }

  const draft: ValidationDraft = {
    errors: [],
    root,
    skillNames: [],
    warnings: [],
  };
  await validateManifest(root, draft);
  await validateSkills(root, draft);
  await validateMcp(root, draft);
  return finalize(draft);
};

export const formatAgentPluginValidation = (report: AgentPluginValidation): string => {
  const status = report.valid ? 'Valid' : 'Invalid';
  const lines = [`${status} Agent Plugin: ${report.root}`];
  if (report.name !== undefined) {
    lines.push(`Name: ${report.name}`);
  }
  if (report.version !== undefined) {
    lines.push(`Version: ${report.version}`);
  }
  lines.push(`Skills: ${report.skillNames.length}`);
  for (const error of report.errors) {
    lines.push(`Error: ${error}`);
  }
  for (const warning of report.warnings) {
    lines.push(`Warning: ${warning}`);
  }
  return `${lines.join('\n')}\n`;
};
