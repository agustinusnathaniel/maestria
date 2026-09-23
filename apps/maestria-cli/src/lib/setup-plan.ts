import picocolors from 'picocolors';

import { CliError } from '@/lib/command-result.js';
import { redactHome } from '@/lib/doctor.js';
import { groupMultiselect } from '@/lib/group-multiselect.js';
import { KNOWN_ECOSYSTEM_TOOLS } from '@/lib/setup-actions.js';
import { resolveEffectiveSkills } from '@/lib/skill-reconcile.js';
import type { EffectiveSkillTarget } from '@/lib/skill-reconcile.js';
import { confirmOrThrow, reviewSkillSelections } from '@/lib/skill-prompts.js';
import { hasSkillFlags, validateSkillFlags } from '@/lib/skills.js';
import type { SkillsRecord } from '@/lib/skills.js';
import type { PlatformStatus } from '@/types.js';
import type { SetupActionReport, SetupArgs, SetupSkillSource } from '@/lib/setup.js';

export interface SetupSelection {
  readonly ecosystem: string[];
  readonly maestriaActive: boolean;
  readonly maestriaSkills: string | undefined;
  readonly reviewed: EffectiveSkillTarget[];
  readonly sources: SetupSkillSource[];
  readonly targets: { id: string; label?: string }[];
  readonly xtarterize: boolean;
}

export const RESUME_GUIDANCE =
  'Re-run with the same args; completed items are skipped via detection (record, skills list, xtarterize status).';

export const parseEcosystem = (input: string | undefined): string[] => {
  if (input === undefined || input.trim() === '') {
    return [];
  }
  const ids = [
    ...new Set(
      input
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const unknown = ids.filter((id) => !KNOWN_ECOSYSTEM_TOOLS.includes(id));
  if (unknown.length > 0) {
    throw new CliError(
      `Unknown ecosystem tool '${unknown[0]}'. Known tools: ${KNOWN_ECOSYSTEM_TOOLS.join(', ')}`,
      1,
    );
  }
  return ids;
};

export const parseSkillSources = (input: string | string[] | undefined): SetupSkillSource[] => {
  const raw: string[] =
    input === undefined
      ? []
      : (Array.isArray(input) ? input : [input]).flatMap((v) => v.split(','));
  const entries = raw.map((s) => s.trim()).filter(Boolean);
  return entries.map((entry) => {
    const sep = entry.lastIndexOf(':');
    if (sep === -1) {
      throw new CliError(
        `Invalid --skill-source '${entry}'. Use <owner/repo:scope> with scope project or global.`,
        1,
      );
    }
    const source = entry.slice(0, sep).trim();
    const scope = entry
      .slice(sep + 1)
      .trim()
      .toLowerCase();
    if (!source.includes('/') || source === '') {
      throw new CliError(`Invalid --skill-source '${entry}'. Source must be <owner/repo>.`, 1);
    }
    if (scope !== 'project' && scope !== 'global') {
      throw new CliError(
        `Invalid --skill-source '${entry}'. Scope must be project or global (skip by omitting the source).`,
        1,
      );
    }
    return { scope, source };
  });
};

export const effectiveMaestriaSkills = (args: SetupArgs): string | undefined => {
  const kebab = args['maestria-skills'];
  const kebabText = typeof kebab === 'string' ? kebab : '';
  const alias = (args.maestriaSkills ?? kebabText).trim();
  const direct = args.skills?.trim();
  if (direct !== undefined && direct !== '') {
    return direct;
  }
  return alias === '' ? undefined : alias;
};

const assertFullArgs = (
  interactive: boolean,
  yes: boolean,
  selections: { ecosystem?: string; skillSource?: string | string[]; skills?: string },
  hasMutations: boolean,
): void => {
  if (interactive || yes) {
    return;
  }
  const provided =
    selections.ecosystem !== undefined ||
    selections.skillSource !== undefined ||
    selections.skills !== undefined;
  if (provided && !hasMutations) {
    return;
  }
  if (!provided) {
    throw new CliError(
      'Not in an interactive terminal and selection flags are missing. ' +
        'Provide --ecosystem <csv>, --skill-source <owner/repo:scope> (repeatable or CSV), ' +
        '--xtarterize-skills as needed, --skills/--exclude-skills for Maestria skills, ' +
        'and --yes to confirm non-interactively. Nothing was changed.',
      1,
    );
  }
  throw new CliError(
    'Not in an interactive terminal. Re-run with --yes to confirm non-interactively. Nothing was changed.',
    1,
  );
};

const collectInteractiveSetup = async (
  ecosystem: string[],
  ecosystemProvided: boolean,
  xtarterizeFlag: boolean,
  xtarterizeOnPath: string | null,
  sources: SetupSkillSource[],
  sourcesProvided: boolean,
  probes: Map<string, { present: boolean; version: string }>,
): Promise<{ ecosystem: string[]; sources: SetupSkillSource[]; xtarterize: boolean }> => {
  const groups: Record<string, { hint?: string; label: string; value: string }[]> = {};
  if (!ecosystemProvided) {
    groups['Ecosystem tools (detect only, manual install if missing)'] = KNOWN_ECOSYSTEM_TOOLS.map(
      (tool) => {
        const found = probes.get(tool);
        const detected = found?.present === true;
        return {
          hint: detected ? `detected ${found.version}` : 'not detected',
          label: detected ? `${tool} (already installed)` : tool,
          value: `eco:${tool}`,
        };
      },
    );
  }
  if (!xtarterizeFlag && xtarterizeOnPath !== null) {
    groups['Project skills (xtarterize)'] = [
      { hint: `binary ${xtarterizeOnPath}`, label: 'xtarterize project skills', value: 'xta:on' },
    ];
  }
  if (sourcesProvided && sources.length > 0) {
    groups['Skill sources (skills CLI, project/global per source)'] = sources.map((s) => ({
      hint: s.scope,
      label: `${s.source} (${s.scope})`,
      value: `src:${s.source}:${s.scope}`,
    }));
  }
  if (Object.keys(groups).length === 0) {
    return { ecosystem, sources, xtarterize: xtarterizeFlag };
  }
  const { cancel, isCancel } = await import('@clack/prompts');
  const selected = await groupMultiselect({
    message: 'Which setup items do you want to include?',
    options: groups,
    required: false,
    selectableGroups: false,
  });
  if (isCancel(selected) || !Array.isArray(selected)) {
    cancel('Setup cancelled.');
    throw new CliError('', 130);
  }
  const picked = new Set(selected.filter((v): v is string => typeof v === 'string'));
  return {
    ecosystem: ecosystemProvided
      ? ecosystem
      : KNOWN_ECOSYSTEM_TOOLS.filter((t) => picked.has(`eco:${t}`)),
    sources: sourcesProvided
      ? sources.filter((s) => picked.has(`src:${s.source}:${s.scope}`))
      : sources,
    xtarterize: xtarterizeFlag || picked.has('xta:on'),
  };
};

const promptSetupSelections = async (
  args: SetupArgs,
  ecosystem: string[],
  skillSources: SetupSkillSource[],
  xtarterizeOnPath: string | null,
  probes: Map<string, { present: boolean; version: string }>,
  interactive: boolean,
  flattenSkillSource: (args: SetupArgs) => string | string[] | undefined,
): Promise<{ ecosystem: string[]; sources: SetupSkillSource[]; xtarterize: boolean }> => {
  const ecosystemProvided = args.ecosystem !== undefined;
  const sourcesProvided = flattenSkillSource(args) !== undefined;
  const xtarterizeFlag = args.xtarterizeSkills === true;
  if (!interactive || (args.yes === true && ecosystemProvided && sourcesProvided)) {
    return { ecosystem, sources: skillSources, xtarterize: xtarterizeFlag };
  }
  return await collectInteractiveSetup(
    ecosystem,
    ecosystemProvided,
    xtarterizeFlag,
    xtarterizeOnPath,
    skillSources,
    sourcesProvided,
    probes,
  );
};

const reviewMaestriaTargets = async (
  args: SetupArgs,
  maestriaSkills: string | undefined,
  installed: readonly PlatformStatus[],
  record: SkillsRecord | null,
): Promise<{ reviewed: EffectiveSkillTarget[]; targets: { id: string; label?: string }[] }> => {
  const targets = installed.map((p) => ({ id: p.id, label: p.label }));
  const resolved = resolveEffectiveSkills(
    targets,
    { excludeSkills: args.excludeSkills, skills: maestriaSkills },
    record,
  );
  const reviewed = await reviewSkillSelections(resolved, 'Install', {
    excludeSkills: args.excludeSkills,
    skills: maestriaSkills,
    yes: args.yes,
  });
  return { reviewed, targets };
};

export const resolveSetupPlan = async (
  args: SetupArgs,
  installed: readonly PlatformStatus[],
  record: SkillsRecord | null,
  xtarterizeOnPath: string | null,
  probes: Map<string, { present: boolean; version: string }>,
  interactive: boolean,
  flattenSkillSource: (args: SetupArgs) => string | string[] | undefined,
): Promise<SetupSelection> => {
  const maestriaSkills = effectiveMaestriaSkills(args);
  const ecosystem = parseEcosystem(args.ecosystem);
  const skillSources = parseSkillSources(flattenSkillSource(args));
  validateSkillFlags(
    installed.map((p) => p.id),
    { excludeSkills: args.excludeSkills, skills: maestriaSkills },
    record,
  );

  const picked = await promptSetupSelections(
    args,
    ecosystem,
    skillSources,
    xtarterizeOnPath,
    probes,
    interactive,
    flattenSkillSource,
  );
  const { reviewed, targets } = await reviewMaestriaTargets(
    args,
    maestriaSkills,
    installed,
    record,
  );
  const maestriaActive =
    hasSkillFlags({ excludeSkills: args.excludeSkills, skills: maestriaSkills }) ||
    reviewed.some((entry) => entry.selection.changed || entry.selection.skills.length > 0);

  assertFullArgs(
    interactive,
    args.yes === true,
    {
      ecosystem: args.ecosystem,
      skillSource: flattenSkillSource(args),
      skills: maestriaSkills,
    },
    picked.ecosystem.length > 0 || picked.xtarterize || picked.sources.length > 0 || maestriaActive,
  );
  return {
    ecosystem: picked.ecosystem,
    maestriaActive,
    maestriaSkills,
    reviewed,
    sources: picked.sources,
    targets,
    xtarterize: picked.xtarterize,
  };
};

// Fresh installs with targets still run to match the initial reconcile in executeSetupActions.
export const isNoopSetupPlan = (
  selection: SetupSelection,
  probes: ReadonlyMap<string, { present: boolean; version: string }>,
): boolean => {
  if (selection.xtarterize || selection.sources.length > 0) {
    return false;
  }
  if (selection.maestriaActive && selection.targets.length > 0) {
    return false;
  }
  if (selection.reviewed.some((entry) => entry.selection.changed)) {
    return false;
  }
  return selection.ecosystem.every((tool) => probes.get(tool)?.present === true);
};

export const confirmSetupPlan = async (
  cwd: string,
  selection: SetupSelection,
  yes: boolean | undefined,
): Promise<void> => {
  const reviewLines = [
    `target ${redactHome(cwd)}`,
    `ecosystem [${selection.ecosystem.join(', ') || 'none'}]`,
    `xtarterize [${selection.xtarterize ? 'project skills' : 'skipped'}]`,
    `skill sources [${selection.sources.map((s) => `${s.source}:${s.scope}`).join(', ') || 'none'}]`,
    `maestria skills [${selection.reviewed.map((r) => `${r.id}=[${r.selection.skills.join(', ') || 'none'}]`).join(', ') || 'none'}]`,
  ];
  await confirmOrThrow(`Run setup with ${reviewLines.join(', ')}?`, yes);
};

export const goalNotes = (installed: readonly PlatformStatus[]): string[] => {
  if (!installed.some((p) => p.id === 'opencode')) {
    return [];
  }
  return [
    'OpenCode detected: goal tracking stays manual (no goal-plugin install exists). ' +
      'Use the host goal flow per VISION/PATTERNS; setup never invokes a goal install.',
  ];
};

const reportMark = (status: SetupActionReport['status']): string => {
  if (status === 'ok') {
    return picocolors.green('✓');
  }
  if (status === 'failed') {
    return picocolors.red('✗');
  }
  return picocolors.dim('-');
};

const renderSetupText = (
  reports: SetupActionReport[],
  notes: string[],
  hasFailure: boolean,
  summary?: string,
): string => {
  const lines = [
    picocolors.bold('\n  Maestria Setup'),
    picocolors.dim('  ─────────────────────────────────────'),
  ];
  if (summary !== undefined && summary !== '') {
    lines.push(`  ${picocolors.green('✓')} ${summary}`);
  }
  for (const report of reports) {
    lines.push(
      `  ${reportMark(report.status)} [${report.category}] ${report.item}: ${report.status} ${report.detail}`,
    );
  }
  for (const note of notes) {
    lines.push(`  ${picocolors.dim('Note:')} ${note}`);
  }
  if (hasFailure) {
    lines.push(`  ${picocolors.dim('Resume:')} ${RESUME_GUIDANCE}`);
  }
  return `${lines.join('\n')}\n`;
};

export const renderSetupOutput = (
  args: { json?: boolean },
  context: {
    cwd: string;
    detection: {
      doctor: unknown;
      ecosystem: { present: boolean; tool: string; version: string }[];
      recordPresent: boolean;
      xtarterizeOnPath: string | null;
    };
    notes: string[];
    reports: SetupActionReport[];
    summary?: string;
  },
): string => {
  const hasFailure = context.reports.some((r) => r.status === 'failed');
  if (args.json === true) {
    return JSON.stringify(
      {
        actions: context.reports,
        cwd: redactHome(context.cwd),
        detection: {
          ecosystem: context.detection.ecosystem,
          platforms: context.detection.doctor,
          recordPresent: context.detection.recordPresent,
          xtarterizeOnPath: context.detection.xtarterizeOnPath,
        },
        notes: context.notes,
        resume: RESUME_GUIDANCE,
      },
      null,
      2,
    );
  }
  return renderSetupText(context.reports, context.notes, hasFailure, context.summary);
};
