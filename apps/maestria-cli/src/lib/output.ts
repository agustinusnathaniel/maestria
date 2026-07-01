import picocolors from 'picocolors';
import { spinner as clackSpinner } from '@clack/prompts';
import type { PlatformStatus, StatusOutput, PlatformResult } from '@/types.js';

/** Wrapper around @clack/prompts spinner that respects --quiet */
export function createSpinner(quiet: boolean) {
  if (quiet) {
    return { start: () => {}, stop: () => {}, message: () => {} };
  }
  return clackSpinner();
}

/** Render a status table to terminal */
export function renderStatusTable(platforms: PlatformStatus[]): string {
  const lines: string[] = [];
  lines.push(picocolors.bold('\n  Maestria Status'));
  lines.push(picocolors.dim('  ─────────────────────────────────────'));

  for (const p of platforms) {
    const available = p.available ? picocolors.green('✓') : picocolors.red('✗');
    const installed = p.installed ? picocolors.green('✓') : picocolors.dim('-');
    const version = p.installed ? p.installedVersion : picocolors.dim('not installed');
    const latest =
      p.latestVersion === 'check-failed'
        ? picocolors.yellow('check failed')
        : p.latestVersion
          ? p.latestVersion
          : picocolors.dim('unknown');

    lines.push(`  ${picocolors.bold(p.label)}`);
    lines.push(`    Available:  ${available}`);
    lines.push(`    Installed:  ${installed} ${version}`);
    lines.push(`    Latest:     ${latest}`);
  }

  return lines.join('\n') + '\n';
}

/** Render result lines after install/update */
export function renderResults(results: PlatformResult[]): string {
  const lines = results.map((r) => {
    const status = r.ok ? picocolors.green('✓') : picocolors.red('✗');
    const msg = r.ok
      ? r.prevVersion
        ? `  ${r.label}: ${r.prevVersion} → ${r.nextVersion}`
        : `  ${r.label}: ${r.message}`
      : `  ${r.label}: ${picocolors.red(r.message)}`;
    return `${status} ${msg}`;
  });
  return lines.join('\n') + '\n';
}

/** JSON output for status */
export function formatStatusJson(output: StatusOutput): string {
  return JSON.stringify(output, null, 2);
}

/** Compact status output - one line per platform, no colors */
export function renderCompactStatus(platforms: PlatformStatus[]): string {
  return (
    platforms
      .map((p) => {
        const avail = p.available ? 'available' : 'not-available';
        const inst = p.installed ? `installed=${p.installedVersion}` : 'not-installed';
        const latest =
          p.latestVersion === 'check-failed'
            ? 'latest=check-failed'
            : p.latestVersion
              ? `latest=${p.latestVersion}`
              : '';
        return `${p.id}: ${avail} ${inst}${latest ? ` ${latest}` : ''}`;
      })
      .join('\n') + '\n'
  );
}

/** Compact result output - one line per platform, no colors */
export function renderCompactResults(results: PlatformResult[]): string {
  return (
    results
      .map((r) => {
        if (!r.ok) {
          return `${r.id}: failed ${r.message}`;
        }
        if (r.message === 'Already up to date') {
          return `${r.id}: already latest ${r.nextVersion || r.prevVersion || ''}`;
        }
        if (r.prevVersion && r.nextVersion && r.prevVersion !== r.nextVersion) {
          return `${r.id}: updated ${r.prevVersion} -> ${r.nextVersion}`;
        }
        // Install or other success with a version
        const version = r.nextVersion || r.prevVersion || '';
        return `${r.id}: installed ${version}`;
      })
      .join('\n') + '\n'
  );
}
