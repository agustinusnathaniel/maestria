#!/usr/bin/env node
// packages/core/scripts/sync.ts - CLI entry for config-driven agent directive syncing

import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { loadConfig, ConfigError } from './lib/config.js';
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

function printHelp(): void {
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
}

// ── CLI Parsing ──

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    return { config: '', check: false, diff: false, dryRun: false, verbose: false, help: true };
  }

  const { values } = parseArgs({
    args,
    options: {
      config: { type: 'string', short: 'c', default: '' },
      check: { type: 'boolean', short: 'C', default: false },
      diff: { type: 'boolean', short: 'd', default: false },
      'dry-run': { type: 'boolean', short: 'n', default: false },
      verbose: { type: 'boolean', short: 'v', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowNegative: true,
  });

  return {
    config: values.config as string,
    check: values.check as boolean,
    diff: values.diff as boolean,
    dryRun: values['dry-run'] as boolean,
    verbose: values.verbose as boolean,
    help: values.help as boolean,
  };
}

// ── Main ──

async function main(): Promise<number> {
  const opts = parseCliArgs();

  if (opts.help) {
    printHelp();
    return 0;
  }

  // Auto-detect config: try .ts first, fall back to .js
  let configPath: string;
  if (opts.config) {
    configPath = resolve(opts.config);
  } else {
    configPath = existsSync('./sync.config.ts')
      ? resolve('./sync.config.ts')
      : resolve('./sync.config.js');
  }

  let config;
  try {
    config = await loadConfig(configPath);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`Configuration error: ${err.message}`);
      return 2;
    }
    console.error('Unexpected error loading config:', err);
    return 2;
  }

  const results = await runSync({
    config,
    dryRun: opts.dryRun,
    check: opts.check,
    diff: opts.diff,
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
      `\nSummary: ${written} written, ${unchanged} unchanged, ${removed} removed, ${errors} errors` +
        (opts.dryRun ? `, ${dryRunCount} dry-run` : ''),
    );
  }

  if (opts.check && (errors > 0 || removed > 0)) {
    const parts: string[] = [];
    if (errors > 0) parts.push(`${errors} file(s) differ from expected`);
    if (removed > 0) parts.push(`${removed} stale file(s) would be removed`);
    console.error(`\nCheck failed: ${parts.join('; ')}`);
    return 1;
  }

  return 0;
}

const exitCode = await main();
process.exit(exitCode);
