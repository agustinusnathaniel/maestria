import { cancel, confirm, isCancel } from '@clack/prompts';

import { CliError } from '@/lib/command-result.js';

export const confirmOrThrow = async (message: string, yes: boolean | undefined): Promise<void> => {
  if (yes === true) {
    return;
  }
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    throw new CliError(`${message} Re-run with --yes to confirm non-interactively.`, 1);
  }
  const answer = await confirm({ message });
  if (isCancel(answer) || answer !== true) {
    cancel('Cancelled.');
    throw new CliError('', 130);
  }
};
