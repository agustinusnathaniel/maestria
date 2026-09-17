import { spinner as clackSpinner } from '@clack/prompts';
import picocolors from 'picocolors';

import { freshnessOf } from '@/lib/freshness.js';
import type { PlatformResult, PlatformStatus, StatusOutput } from '@/types.js';

/** Wrapper around @clack/prompts spinner that respects --quiet */
export const createSpinner = (quiet: boolean) => {
  if (quiet) {
    return {
      message: () => {
        /* empty */
      },
      start: () => {
        /* empty */
      },
      stop: () => {
        /* empty */
      },
    };
  }
  return clackSpinner();
};

/** Render a status table to terminal */
export const renderStatusTable = (platforms: PlatformStatus[]): string => {
  const lines: string[] = [
    picocolors.bold('\n  Maestria Status'),
    picocolors.dim('  ─────────────────────────────────────'),
  ];

  for (const p of platforms) {
    const available = p.available ? picocolors.green('✓') : picocolors.red('✗');
    const installed = p.installed ? picocolors.green('✓') : picocolors.dim('-');
    const version = p.installed ? p.installedVersion : picocolors.dim('not installed');
    let latest = picocolors.dim('unknown');
    if (p.latestVersion === 'check-failed') {
      latest = picocolors.yellow('check failed');
    } else if (p.latestVersion) {
      latest = p.latestVersion;
    }
    const freshness = p.installed ? freshnessOf(p.installedVersion, p.latestVersion) : 'unknown';
    let outdated = picocolors.dim('-');
    if (freshness === 'current') {
      outdated = picocolors.green('no');
    } else if (freshness === 'outdated') {
      outdated = picocolors.yellow('yes');
    }

    lines.push(
      `  ${picocolors.bold(p.label)}`,
      `    Available:  ${available}`,
      `    Installed:  ${installed} ${version}`,
      `    Latest:     ${latest}`,
      `    Outdated:   ${outdated}`,
    );
  }

  return `${lines.join('\n')}\n`;
};

/** Render result lines after install/update */
export const renderResults = (results: PlatformResult[]): string => {
  const lines = results.map((r) => {
    const status = r.ok ? picocolors.green('✓') : picocolors.red('✗');
    let msg: string;
    if (!r.ok) {
      msg = `  ${r.label}: ${picocolors.red(r.message)}`;
    } else if (r.prevVersion !== undefined && r.prevVersion !== null && r.prevVersion !== '') {
      msg = `  ${r.label}: ${r.prevVersion} → ${r.nextVersion}`;
    } else {
      msg = `  ${r.label}: ${r.message}`;
    }
    return `${status} ${msg}`;
  });
  return `${lines.join('\n')}\n`;
};

/** JSON output for status */
export const formatStatusJson = (output: StatusOutput): string => JSON.stringify(output, null, 2);

/** Compact status output - one line per platform, no colors */
export const renderCompactStatus = (platforms: PlatformStatus[]): string =>
  `${platforms
    .map((p) => {
      const avail = p.available ? 'available' : 'not-available';
      const inst = p.installed ? `installed=${p.installedVersion}` : 'not-installed';
      let latest = '';
      if (p.latestVersion === 'check-failed') {
        latest = 'latest=check-failed';
      } else if (p.latestVersion) {
        latest = `latest=${p.latestVersion}`;
      }
      return `${p.id}: ${avail} ${inst}${latest ? ` ${latest}` : ''}`;
    })
    .join('\n')}\n`;

/** Compact result output - one line per platform, no colors */
export const renderCompactResults = (results: PlatformResult[]): string =>
  `${results
    .map((r) => {
      if (!r.ok) {
        return `${r.id}: failed ${r.message}`;
      }
      if (r.message === 'Already up to date') {
        return `${r.id}: already latest ${r.nextVersion ?? r.prevVersion ?? ''}`;
      }
      if (
        r.prevVersion !== undefined &&
        r.prevVersion !== null &&
        r.prevVersion !== '' &&
        r.nextVersion !== undefined &&
        r.nextVersion !== null &&
        r.nextVersion !== '' &&
        r.prevVersion !== r.nextVersion
      ) {
        return `${r.id}: updated ${r.prevVersion} -> ${r.nextVersion}`;
      }
      // Install or other success with a version
      const version = r.nextVersion ?? r.prevVersion ?? '';
      return `${r.id}: installed ${version}`;
    })
    .join('\n')}\n`;
