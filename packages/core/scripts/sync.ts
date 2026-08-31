#!/usr/bin/env node
// packages/core/scripts/sync.ts - CLI entry for config-driven agent directive syncing

import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { ConfigError, loadConfig } from './lib/config.js';
import { runSync } from './lib/sync.js';

// ── CLI Types ──

interface CliOptions {
  config: string;
  check: boolean;
  diff: boolean;
  dryRun: boolean;
  verbose: boolean;
  help: boolean;
}

// ── Help ──

const printHelp = (): void => {
  console.log(`
core-sync - Config-driven agent directive syncing tool

USAGE
  core-sync                          Sync (write output)
  core-sync --config <path>          Specify config file (default: ./sync.config.ts or ./sync.config.js)
  core-sync --check                  CI mode: exit 1 if any output differs
  core-sync --diff                   Show unified diff of changes
  core-sync --dry-run                Show what would happen without writing
  core-sync --verbose                Print every file operation
  core-sync --help                   Print this help

EXIT CODES
  0  All good
  1  Check failed (output differs from expected)
  2  Configuration error
`);
};

// ── CLI Parsing ──

const parseCliArgs = (): CliOptions => {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    return { check: false, config: '', diff: false, dryRun: false, help: true, verbose: false };
  }

  const { values } = parseArgs({
    allowNegative: true,
    args,
    options: {
      check: { default: false, short: 'C', type: 'boolean' },
      config: { default: '', short: 'c', type: 'string' },
      diff: { default: false, short: 'd', type: 'boolean' },
      'dry-run': { default: false, short: 'n', type: 'boolean' },
      help: { default: false, short: 'h', type: 'boolean' },
      verbose: { default: false, short: 'v', type: 'boolean' },
    },
    strict: true,
  });

  return {
    check: values.check,
    config: values.config,
    diff: values.diff,
    dryRun: values['dry-run'],
    help: values.help,
    verbose: values.verbose,
  };
};

// ── Main ──

// oxlint-disable-next-line max-lines-per-function -- main orchestrates CLI parsing, config loading, sync execution, and result summarization as a single cohesive entry flow; splitting would fragment the linear startup sequence that shares opts/config/results.
const main = async (): Promise<number> => {
  const opts = parseCliArgs();

  if (opts.help) {
    printHelp();
    return 0;
  }

  // Auto-detect config: try .ts first, fall back to .js
  let configPath: string;
  if (opts.config) {
    configPath = path.resolve(opts.config);
  } else {
    configPath = existsSync('./sync.config.ts')
      ? path.resolve('./sync.config.ts')
      : path.resolve('./sync.config.js');
  }

  let config;
  try {
    config = await loadConfig(configPath);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`Configuration error: ${error.message}`);
      return 2;
    }
    console.error('Unexpected error loading config:', error);
    return 2;
  }

  const results = await runSync({
    check: opts.check,
    config,
    diff: opts.diff,
    dryRun: opts.dryRun,
    verbose: opts.verbose,
  });

  // Summarize
  const written = results.filter((r) => r.status === 'written').length;
  const unchanged = results.filter((r) => r.status === 'unchanged').length;
  const removed = results.filter((r) => r.status === 'removed').length;
  const errors = results.filter((r) => r.status === 'error').length;
  const dryRunCount = results.filter((r) => r.status === 'dry-run').length;

  if (opts.verbose) {
    console.log(
      `\nSummary: ${written} written, ${unchanged} unchanged, ${removed} removed, ${errors} errors${
        opts.dryRun ? `, ${dryRunCount} dry-run` : ''
      }`,
    );
  }

  if (opts.check && (errors > 0 || removed > 0)) {
    const parts: string[] = [];
    if (errors > 0) {
      parts.push(`${errors} file(s) differ from expected`);
    }
    if (removed > 0) {
      parts.push(`${removed} stale file(s) would be removed`);
    }
    console.error(`\nCheck failed: ${parts.join('; ')}`);
    return 1;
  }

  return 0;
};

const exitCode = await main();
process.exit(exitCode);
