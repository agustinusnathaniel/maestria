import { companionAgentFor, listCompanions } from '@/lib/skill-companion.js';
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import {
  attachCompanionObserved,
  reconcileCompanions,
  resolveSkillsSource,
} from '@/lib/skill-reconcile.js';
import type { EffectiveSkillTarget } from '@/lib/skill-reconcile.js';
import type { SetupActionReport, SetupSkillSource, XtarterizeRunner } from '@/lib/setup.js';
import { hasSkillFlags, persistSuccessfulSelections } from '@/lib/skills.js';
import type { SkillsRecord } from '@/lib/skills.js';
import { isRecord } from '@/lib/primitives.js';
import type { PlatformStatus } from '@/types.js';

export const KNOWN_ECOSYSTEM_TOOLS: readonly string[] = ['codegraph', 'agent-browser', 'opensrc'];

export const ECOSYSTEM_GUIDANCE: Record<string, string> = {
  'agent-browser':
    'agent-browser binary not detected. The agent-browser skill trigger is not the binary. ' +
    'Install the binary manually per its docs, then re-run setup.',
  codegraph:
    'codegraph binary not detected. Install it manually per the CodeGraph docs, then re-run setup.',
  opensrc:
    'opensrc binary not detected. The opensrc skill is unrelated to the opensrc binary. ' +
    'Install the binary manually per its docs, then re-run setup.',
};

export interface SetupActionContext {
  readonly cwd: string;
  readonly excludeSkills: string | undefined;
  readonly installed: readonly PlatformStatus[];
  readonly maestriaSkills: string | undefined;
  readonly probes: ReadonlyMap<string, { present: boolean; version: string }>;
  readonly readGitignore: (cwd: string) => Promise<string | null>;
  readonly record: SkillsRecord | null;
  readonly skillRunner: SkillCommandRunner;
  readonly xtarterize: XtarterizeRunner;
  readonly xtarterizeOnPath: string | null;
}

export const XTARTERIZE_TASK = 'agent/skills-install';

export const ecosystemReports = (
  selected: readonly string[],
  probes: ReadonlyMap<string, { present: boolean; version: string }>,
): SetupActionReport[] =>
  selected.map((tool) => {
    const found = probes.get(tool);
    if (found?.present === true) {
      return {
        category: 'ecosystem',
        detail: `detected ${found.version}; already installed by user, no action taken`,
        item: tool,
        status: 'ok',
      } satisfies SetupActionReport;
    }
    return {
      category: 'ecosystem',
      detail: ECOSYSTEM_GUIDANCE[tool] ?? 'Install manually per its docs, then re-run setup.',
      item: tool,
      status: 'skipped',
    } satisfies SetupActionReport;
  });

const stripAnsi = (value: string): string =>
  // oxlint-disable-next-line no-control-regex -- intentional ANSI stripping for child output.
  value.replaceAll(/\u001B\[[0-9;?]*[A-Za-z]|\u001B\?25[hl]/gu, '');

const sanitize = (value: string): string =>
  stripAnsi(value).replaceAll(/\s+/gu, ' ').trim().slice(0, 500);

export const xtarterizeStatusOf = (stdout: string): string | null => {
  const clean = stripAnsi(stdout);
  const start = clean.lastIndexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(clean.slice(start, end + 1));
    if (!isRecord(parsed)) {
      return null;
    }
    const direct = parsed.status;
    if (typeof direct === 'string') {
      return direct;
    }
    for (const key of ['result', 'data', 'summary']) {
      const nested = parsed[key];
      if (isRecord(nested) && typeof nested.status === 'string') {
        return nested.status;
      }
    }
    return null;
  } catch {
    return null;
  }
};

const XTARTERIZE_OK = new Set(['applied', 'success', 'ok', 'completed', 'installed']);
const XTARTERIZE_SKIP = new Set(['not-applicable', 'not_applicable', 'skipped', 'noop', 'no-op']);

const classifyXtarterize = (
  status: string | null,
  exitCode: number,
  stdout: string,
): { detail: string; status: SetupActionReport['status'] } => {
  if (status === null) {
    return {
      detail: `No JSON status field (exit ${exitCode}); refusing to claim success: ${sanitize(stdout)}`,
      status: 'failed',
    };
  }
  const normalized = status.trim().toLowerCase();
  if (XTARTERIZE_OK.has(normalized)) {
    return { detail: `status ${status} (exit ${exitCode})`, status: 'ok' };
  }
  if (XTARTERIZE_SKIP.has(normalized)) {
    return { detail: `status ${status} (exit ${exitCode}); nothing to apply`, status: 'skipped' };
  }
  return { detail: `status ${status} (exit ${exitCode}): ${sanitize(stdout)}`, status: 'failed' };
};

/**
 * Apply project skills via xtarterize. Every invocation is treated as
 * mutating (session open appends .gitignore, apply writes backups/manifest),
 * so the .gitignore is snapshotted around the calls and the change reported.
 */
export const runXtarterizeAction = async (ctx: SetupActionContext): Promise<SetupActionReport> => {
  const command = `xtarterize add ${XTARTERIZE_TASK} --json --cwd ${ctx.cwd}`;
  if (ctx.xtarterizeOnPath === null) {
    return {
      category: 'xtarterize',
      command,
      detail: 'xtarterize binary not found on PATH. Install it manually, then re-run setup.',
      item: XTARTERIZE_TASK,
      status: 'failed',
    };
  }
  const before = await ctx.readGitignore(ctx.cwd);
  let versionNote = 'version unknown';
  try {
    const versioned = await ctx.xtarterize(['--version'], { cwd: ctx.cwd });
    const first = stripAnsi(versioned.stdout).split('\n')[0]?.trim();
    if (first !== undefined && first !== '') {
      versionNote = first;
    }
  } catch {
    versionNote = 'version unknown';
  }
  const result = await ctx.xtarterize(['add', XTARTERIZE_TASK, '--json', '--cwd', ctx.cwd], {
    cwd: ctx.cwd,
  });
  const classified = classifyXtarterize(
    xtarterizeStatusOf(result.stdout),
    result.exitCode,
    result.stdout,
  );
  const after = await ctx.readGitignore(ctx.cwd);
  const gitignoreNote =
    before === after
      ? 'gitignore unchanged'
      : 'gitignore changed (pre-accepted mutating invocation)';
  return {
    category: 'xtarterize',
    command,
    detail: `${classified.detail} at ${ctx.xtarterizeOnPath} (${versionNote}); ${gitignoreNote}`,
    item: XTARTERIZE_TASK,
    status: classified.status,
  };
};

export const runSkillSourceActions = async (
  ctx: SetupActionContext,
  sources: readonly SetupSkillSource[],
): Promise<SetupActionReport[]> => {
  const agents = [
    ...new Map(
      ctx.installed.flatMap((p) => {
        const agent = companionAgentFor(p.id);
        return agent === null ? [] : [[agent, p.id] as const];
      }),
    ),
  ];
  if (agents.length === 0) {
    return sources.map((source) => ({
      category: 'skill-source',
      detail: 'skipped: no detected companion agent; install a platform first, then re-run setup',
      item: `${source.source}:${source.scope}`,
      status: 'skipped',
    }));
  }
  const reports: SetupActionReport[] = [];
  for (const source of sources) {
    for (const [agent] of agents) {
      const globalScope = source.scope === 'global';
      const command = `npx -y skills@1.7.0 add ${source.source} -a ${agent}${globalScope ? ' -g' : ''} --json -y${
        globalScope ? '' : ` (cwd ${ctx.cwd})`
      }`;
      try {
        // oxlint-disable-next-line no-await-in-loop -- sequential host mutations keep a deterministic order.
        await ctx.skillRunner(
          ['add', source.source, '-a', agent, ...(globalScope ? ['-g'] : []), '--json', '-y'],
          globalScope ? undefined : { cwd: ctx.cwd },
        );
        // Confirm via re-list, mirroring the companion removal guard.
        // oxlint-disable-next-line no-await-in-loop -- sequential host mutations keep a deterministic order.
        const listed = await listCompanions(ctx.skillRunner, agent, { global: globalScope });
        reports.push({
          category: 'skill-source',
          command,
          detail: `recorded ${listed.length} entries for agent ${agent}`,
          item: `${source.source}:${source.scope} (${agent})`,
          status: 'ok',
        });
      } catch (error) {
        reports.push({
          category: 'skill-source',
          command,
          detail: error instanceof Error ? sanitize(error.message) : sanitize(String(error)),
          item: `${source.source}:${source.scope} (${agent})`,
          status: 'failed',
        });
      }
    }
  }
  return reports;
};
/**
 * Reconcile Maestria methodology skills for installed platforms without
 * touching plugin installs. Persists only confirmed state through the
 * existing selection record.
 */
export const runMaestriaSkillsAction = async (
  ctx: SetupActionContext,
  reviewed: readonly EffectiveSkillTarget[],
): Promise<SetupActionReport[]> => {
  const pluginOk = new Map(reviewed.map((entry) => [entry.id, true]));
  const outcome = await reconcileCompanions(
    ctx.skillRunner,
    ctx.record,
    reviewed,
    pluginOk,
    resolveSkillsSource(),
    hasSkillFlags({ excludeSkills: ctx.excludeSkills, skills: ctx.maestriaSkills }),
  );
  await persistSuccessfulSelections(
    ctx.record,
    attachCompanionObserved(reviewed, outcome),
    reviewed.map((entry) => ({ id: entry.id, ok: outcome.ok.get(entry.id) ?? false })),
    false,
  );
  return reviewed.map((target) => {
    const ok = outcome.ok.get(target.id) ?? false;
    const note = outcome.notes.get(target.id);
    const actual = outcome.actual.get(target.id) ?? [];
    return {
      category: 'maestria-skills',
      detail: note ?? `selection [${actual.join(', ') || 'none'}] reconciled (global scope)`,
      item: target.id,
      status: ok ? 'ok' : 'failed',
    } satisfies SetupActionReport;
  });
};

export const executeSetupActions = async (
  ctx: SetupActionContext,
  selection: {
    ecosystem: readonly string[];
    maestriaActive: boolean;
    reviewed: readonly EffectiveSkillTarget[];
    sources: readonly SetupSkillSource[];
    targets: readonly { id: string }[];
    xtarterize: boolean;
  },
): Promise<SetupActionReport[]> => {
  const reports: SetupActionReport[] = [...ecosystemReports(selection.ecosystem, ctx.probes)];
  if (selection.xtarterize) {
    reports.push(await runXtarterizeAction(ctx));
  }
  if (selection.sources.length > 0) {
    reports.push(...(await runSkillSourceActions(ctx, selection.sources)));
  }
  if (selection.maestriaActive && selection.targets.length > 0) {
    reports.push(...(await runMaestriaSkillsAction(ctx, selection.reviewed)));
  } else if (selection.maestriaActive) {
    reports.push({
      category: 'maestria-skills',
      detail: 'skipped: no installed platforms detected',
      item: 'maestria-skills',
      status: 'skipped',
    });
  }
  return reports;
};
