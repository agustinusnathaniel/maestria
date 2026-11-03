/**
 * Test-only shared setup for the Agent Plugin suites. The real-package staging
 * tests live in their own file so Vitest runs their `npm pack` work on a
 * separate worker from the rest of the Agent Plugin suite.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach } from 'vite-plus/test';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
export const PORTABLE_PACKAGE = path.join(REPO_ROOT, 'packages/agent-plugins');

/** Registers per-test cleanup and returns a factory for temp directories it removes. */
export const useTempDirectories = (): (() => Promise<string>) => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map(async (directory) => {
        await rm(directory, { force: true, recursive: true });
      }),
    );
  });

  return async () => {
    const directory = await mkdtemp(path.join('/tmp', 'maestria-cli-agent-plugin-'));
    tempDirectories.push(directory);
    return directory;
  };
};
