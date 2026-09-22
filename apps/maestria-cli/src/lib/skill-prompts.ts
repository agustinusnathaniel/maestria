import { cancel, confirm, isCancel } from '@clack/prompts';

import { CliError } from '@/lib/command-result.js';
import { groupMultiselect } from '@/lib/group-multiselect.js';
import { hasSkillFlags, KNOWN_SKILLS, summarizeSelections } from '@/lib/skills.js';
import type { ResolvedSkillSelection } from '@/lib/skills.js';

const isInteractive = (): boolean => process.stdout.isTTY && process.stdin.isTTY;

export const isInteractiveTerminal = (): boolean => isInteractive();

/**
 * Interactive skill review for install/update. Non-interactive callers never
 * wait: they keep the proposed selection and rely on the caller's --yes gate
 * for confirmation. Empty selection means an explicit `none`.
 */
export const promptSkillSelection = async (
  initial: string[],
  scope?: string,
): Promise<string[]> => {
  if (!isInteractive()) {
    return [...initial];
  }
  const selected = await groupMultiselect({
    initialValues: initial,
    message: `Which methodology skills should be active for ${scope ?? 'this installation'}?`,
    options: {
      'Methodology skills': KNOWN_SKILLS.map((skill) => ({
        label: skill,
        value: skill,
      })),
    },
    required: false,
    selectableGroups: false,
  });
  if (isCancel(selected) || selected === undefined || !Array.isArray(selected)) {
    cancel('Skill selection cancelled.');
    throw new CliError('', 130);
  }
  return selected.filter((entry): entry is string => typeof entry === 'string');
};

export const confirmOrThrow = async (message: string, yes: boolean | undefined): Promise<void> => {
  if (yes === true) {
    return;
  }
  if (!isInteractive()) {
    throw new CliError(`${message} Re-run with --yes to confirm non-interactively.`, 1);
  }
  const answer = await confirm({ message });
  if (isCancel(answer) || answer !== true) {
    cancel('Cancelled.');
    throw new CliError('', 130);
  }
};

export const defaultSkillSummary = (skills: string[]): string =>
  skills.length === 0 ? 'none' : skills.join(', ');

export interface ReviewableSelection {
  readonly id: string;
  readonly selection: ResolvedSkillSelection;
}

const groupByCurrentSelection = (
  selections: readonly ReviewableSelection[],
): { ids: string[]; skills: string[] }[] => {
  const groups: { ids: string[]; skills: string[] }[] = [];
  for (const entry of selections) {
    const key = entry.selection.skills.join(',');
    const group = groups.find((candidate) => candidate.skills.join(',') === key);
    if (group === undefined) {
      groups.push({ ids: [entry.id], skills: [...entry.selection.skills] });
    } else {
      group.ids.push(entry.id);
    }
  }
  return groups;
};

const describeSelectionChange = (
  id: string,
  before: readonly string[],
  after: readonly string[],
): string =>
  before.join(',') === after.join(',')
    ? `${id}: unchanged [${defaultSkillSummary([...after])}]`
    : `${id}: [${defaultSkillSummary([...before])}] → [${defaultSkillSummary([...after])}]`;

export const reviewSkillSelections = async <T extends ReviewableSelection>(
  selections: readonly T[],
  action: 'Install' | 'Update',
  args: { yes?: boolean } & { excludeSkills?: string; skills?: string },
): Promise<T[]> => {
  if (hasSkillFlags(args)) {
    if (selections.some((entry) => entry.selection.changed)) {
      await confirmOrThrow(`${action} with skills ${summarizeSelections(selections)}?`, args.yes);
    }
    return [...selections];
  }
  if (!isInteractive()) {
    return [...selections];
  }
  const reviewedByGroup = new Map<string, string[]>();
  for (const group of groupByCurrentSelection(selections)) {
    const scope =
      group.ids.length === 1 ? (group.ids[0] ?? 'this installation') : group.ids.join(', ');
    // oxlint-disable-next-line no-await-in-loop -- sequential prompts keep the review order deterministic.
    const reviewed = await promptSkillSelection(group.skills, scope);
    reviewedByGroup.set(group.skills.join(','), reviewed);
  }
  const effective = selections.map((entry) => {
    const reviewed =
      reviewedByGroup.get(entry.selection.skills.join(',')) ?? entry.selection.skills;
    return {
      ...entry,
      selection: {
        changed: entry.selection.skills.join(',') !== reviewed.join(','),
        skills: [...reviewed],
      },
    };
  });
  const summary = effective
    .map((entry) =>
      describeSelectionChange(
        entry.id,
        selections.find((original) => original.id === entry.id)?.selection.skills ?? [],
        entry.selection.skills,
      ),
    )
    .join(', ');
  await confirmOrThrow(`${action} with skills ${summary}?`, args.yes);
  return effective;
};
