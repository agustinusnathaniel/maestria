import { afterEach, describe, expect, it } from 'vite-plus/test';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  metrics,
  parseArgs,
  platformForPath,
  routeEnvelope,
  validatePath,
  validateManifest,
} from '../../../scripts/bench-directives.js';

describe('directive benchmark harness', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../');
  const temporaryRoots: string[] = [];
  const manifest = JSON.parse(
    readFileSync(join(root, 'scripts/fixtures/directive-benchmark.json'), 'utf8'),
  ) as any;
  const copyManifest = () => structuredClone(manifest) as any;
  const temporaryRoot = (prefix: string) => {
    const path = mkdtempSync(join(tmpdir(), prefix));
    temporaryRoots.push(path);
    return path;
  };

  afterEach(() => {
    for (const path of temporaryRoots.splice(0)) rmSync(path, { recursive: true, force: true });
  });

  it('uses Unicode, logical-line, and per-file token metrics', () => {
    expect(metrics('A😀\n')).toEqual({ bytes: 6, characters: 3, lines: 1, estimatedTokens: 1 });
    expect(metrics('12345')).toMatchObject({ estimatedTokens: 2 });
    expect(metrics('A\n\n')).toMatchObject({ lines: 2 });
    expect(metrics('')).toEqual({ bytes: 0, characters: 0, lines: 0, estimatedTokens: 0 });
  });

  it.each([
    ['/absolute', 'canonicalSources[0] must be a relative POSIX path'],
    ['//server/share', 'canonicalSources[0] must be a relative POSIX path'],
    ['C:/absolute', 'canonicalSources[0] must be a relative POSIX path'],
    ['C:relative', 'canonicalSources[0] must be a relative POSIX path'],
    ['.', 'canonicalSources[0] contains an invalid path segment'],
    ['..', 'canonicalSources[0] contains an invalid path segment'],
    ['../outside.md', 'canonicalSources[0] contains an invalid path segment'],
  ])('rejects unsafe path variant %s with its path error', (path, error) => {
    const candidate = copyManifest();
    candidate.canonicalSources = [path];
    expect(() => validateManifest(candidate, root)).toThrow(error);
  });

  it('accepts names beginning with two dots when they are not traversal segments', () => {
    const candidate = copyManifest();
    candidate.canonicalSources = ['packages/core/agent-directives/..cache.md'];
    candidate.generatedOutputs = candidate.generatedOutputs.map((entry: any) => ({
      ...entry,
      source: candidate.canonicalSources[0],
    }));
    candidate.duplicationProbes.canonical = [candidate.canonicalSources[0]];
    expect(() => validateManifest(candidate, root)).toThrow(
      'canonicalSources must contain the exact inventory (14 entries)',
    );
  });

  it('accepts valid existing ..cache names as path segments', () => {
    expect(validatePath('packages/core/agent-directives/..cache.md', 'cache')).toBe(
      'packages/core/agent-directives/..cache.md',
    );
  });

  it.each([
    [
      'reduced canonical inventory',
      (candidate: any) => candidate.canonicalSources.pop(),
      'canonicalSources',
    ],
    [
      'README canonical path',
      (candidate: any) =>
        (candidate.canonicalSources[0] = 'packages/core/agent-directives/README.md'),
      'canonicalSources',
    ],
    [
      'COMPOSITION canonical path',
      (candidate: any) =>
        (candidate.canonicalSources[0] = 'packages/core/agent-directives/COMPOSITION.md'),
      'canonicalSources',
    ],
    [
      'reduced generated inventory',
      (candidate: any) => candidate.generatedOutputs.pop(),
      'generatedOutputs',
    ],
    [
      'reduced platform inventory',
      (candidate: any) =>
        (candidate.generatedOutputs = candidate.generatedOutputs.filter(
          (x: any) => x.platform !== 'pi',
        )),
      'generatedOutputs',
    ],
    [
      'reduced sync config inventory',
      (candidate: any) => candidate.syncConfigs.pop(),
      'syncConfigs',
    ],
    [
      'duplicate route entries',
      (candidate: any) => (candidate.routeCases[0] = candidate.routeCases[1]),
      'routeCases must contain all known routes exactly once',
    ],
  ])('rejects %s with an exact inventory error', (_name, mutate, error) => {
    const candidate = copyManifest();
    mutate(candidate);
    expect(() => validateManifest(candidate, root)).toThrow(error);
  });

  it.each([
    [
      'duplicate canonical entries',
      (candidate: Record<string, any>) => {
        candidate.canonicalSources = [manifest.canonicalSources[0], manifest.canonicalSources[0]];
      },
      'canonicalSources contains duplicate paths',
    ],
    [
      'duplicate config entries',
      (candidate: Record<string, any>) => {
        candidate.syncConfigs = [manifest.syncConfigs[0], manifest.syncConfigs[0]];
      },
      'syncConfigs contains duplicate paths',
    ],
    [
      'duplicate generated entries',
      (candidate: Record<string, any>) => {
        candidate.generatedOutputs = [manifest.generatedOutputs[0], manifest.generatedOutputs[0]];
      },
      'generatedOutputs contains duplicate paths',
    ],
    [
      'unknown platform',
      (candidate: Record<string, any>) => {
        candidate.generatedOutputs[0] = {
          ...candidate.generatedOutputs[0],
          platform: 'unknown-platform',
        };
      },
      'generatedOutputs contains an unknown or mismatched platform',
    ],
    [
      'unknown config',
      (candidate: Record<string, any>) => {
        candidate.syncConfigs[0] = 'packages/unknown/sync.config.ts';
      },
      'syncConfigs contains an unknown platform configuration',
    ],
    [
      'unknown route',
      (candidate: Record<string, any>) => {
        candidate.routeCases[0] = 'unknown-route';
      },
      'routeCases must contain all known routes exactly once',
    ],
    [
      'canonical probe outside inventory',
      (candidate: Record<string, any>) => {
        candidate.duplicationProbes.canonical[0] = 'packages/core/agent-directives/README.md';
      },
      'Canonical duplication probes must reference canonicalSources',
    ],
    [
      'unknown generated schema entry',
      (candidate: Record<string, any>) => {
        candidate.generatedOutputs[0].extra = true;
      },
      'Unknown generatedOutputs[0] field: extra',
    ],
    [
      'unknown duplication probe schema entry',
      (candidate: Record<string, any>) => {
        candidate.duplicationProbes.extra = true;
      },
      'Unknown duplicationProbes field: extra',
    ],
  ])('rejects %s with the intended validation error', (_name, mutate, error) => {
    const candidate = copyManifest();
    mutate(candidate);
    expect(() => validateManifest(candidate, root)).toThrow(error);
  });

  it('fails closed for unknown fields and generated probe inventory violations', () => {
    const unknownField = copyManifest();
    unknownField.extra = true;
    expect(() => validateManifest(unknownField, root)).toThrow('Unknown manifest field');
    const generatedProbe = copyManifest();
    generatedProbe.duplicationProbes.generated[0] = generatedProbe.canonicalSources[0];
    expect(() => validateManifest(generatedProbe, root)).toThrow(
      'Generated duplication probes must reference generatedOutputs',
    );
  });

  it('encodes route semantics without exact participant fields', () => {
    const direct = routeEnvelope('direct');
    expect(direct).toMatchObject({
      route: 'direct',
      mode: 'none',
      implementationPermission: 'allowed',
      reviewFloor: 'none',
      possibleSpecialistClasses: [],
    });
    expect(routeEnvelope('focused')).toMatchObject({
      route: 'focused',
      implementationPermission: 'conditional',
      reviewFloor: 'non-trivial-builder-change',
      selection: 'conditional',
    });
    expect(routeEnvelope('full')).toMatchObject({
      route: 'full',
      reviewFloor: 'after-each-builder-change',
    });
    expect(routeEnvelope('fein')).toMatchObject({ mode: 'fein', route: 'full' });
    expect(routeEnvelope('sonar')).toMatchObject({
      route: 'research-only',
      implementationPermission: 'forbidden',
      reviewFloor: 'none',
    });
    expect(routeEnvelope('blitz')).toMatchObject({
      route: 'direct',
      mode: 'blitz',
      reviewFloor: 'safety-triggered',
    });
    expect(Object.keys(direct)).not.toContain('participants');
  });

  it('parses supported CLI options and rejects missing values', () => {
    expect(parseArgs(['--json', '--revision', 'HEAD', '--root', '/tmp/root'])).toEqual({
      help: false,
      json: true,
      revision: 'HEAD',
      root: '/tmp/root',
    });
    expect(parseArgs(['--help'])).toEqual({ help: true, json: false });
    expect(() => parseArgs(['--root'])).toThrow('--root requires a value');
    expect(() => parseArgs(['--unknown'])).toThrow('Unknown argument');
  });

  it('normalizes separators for platform classification', () => {
    expect(platformForPath('packages\\cursor\\agents\\builder.md')).toBe('cursor');
  });

  it('covers the CLI and same-config historical comparison in subprocesses', () => {
    const cli = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../scripts/bench-directives.ts',
    );
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [cli, ...args], { shell: false, encoding: 'utf8' });
    expect(run('--help').status).toBe(0);
    const first = run('--json');
    const second = run('--json');
    expect(first.status).toBe(0);
    expect(first.stdout).toBe(second.stdout);
    const report = JSON.parse(first.stdout);
    expect(report.candidate.files).toEqual({ canonical: 14, generated: 76 });
    expect(Object.keys(report.candidate.generatedInventory)).toHaveLength(6);
    expect(Object.keys(report.candidate.routeModeEnvelopes)).toHaveLength(6);
    expect(report.candidate.canonicalInventory).not.toContain(
      'packages/core/agent-directives/README.md',
    );
    expect(report.candidate.canonicalInventory).not.toContain(
      'packages/core/agent-directives/COMPOSITION.md',
    );
    expect(run('--unknown').status).not.toBe(0);
    expect(run('--revision').status).not.toBe(0);
    const invalidRevision = run('--json', '--revision', 'not-a-revision');
    expect(invalidRevision.status).not.toBe(0);
    expect(invalidRevision.stderr).toContain('Invalid git revision: not-a-revision');

    const fixtureRoot = temporaryRoot('directive-benchmark-');
    const root = fixtureRoot;
    const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../');
    const fixtureManifest = copyManifest();
    const fixtureFiles = new Set([
      ...fixtureManifest.canonicalSources,
      ...fixtureManifest.generatedOutputs.flatMap((entry: any) => [entry.source, entry.output]),
      ...fixtureManifest.syncConfigs,
    ]);
    for (const path of fixtureFiles) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      copyFileSync(join(sourceRoot, path), join(root, path));
    }
    const manifest = fixtureManifest;
    mkdirSync(join(root, 'scripts/fixtures'), { recursive: true });
    writeFileSync(
      join(root, 'scripts/fixtures/directive-benchmark.json'),
      `${JSON.stringify(manifest)}\n`,
    );
    const writeManifest = (value: typeof manifest) =>
      writeFileSync(
        join(root, 'scripts/fixtures/directive-benchmark.json'),
        `${JSON.stringify(value)}\n`,
      );
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=benchmark',
        '-c',
        'user.email=benchmark@example.test',
        'commit',
        '-q',
        '-m',
        'fixture',
      ],
      { cwd: root },
    );
    const valid = run('--json', '--root', root, '--revision', 'HEAD');
    expect(valid.status).toBe(0);
    execFileSync('git', ['rm', '-q', '-f', 'packages/opencode/sync.config.ts'], { cwd: root });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=benchmark',
        '-c',
        'user.email=benchmark@example.test',
        'commit',
        '-q',
        '-m',
        'remove config',
      ],
      { cwd: root },
    );
    writeFileSync(join(root, 'packages/opencode/sync.config.ts'), 'same config\n');
    const missingHistoricalConfig = run('--json', '--root', root, '--revision', 'HEAD');
    expect(missingHistoricalConfig.status).not.toBe(0);
    expect(missingHistoricalConfig.stderr).toContain(
      'Revision HEAD is missing or unreadable manifest-listed file: packages/opencode/sync.config.ts',
    );
    execFileSync('git', ['add', 'packages/opencode/sync.config.ts'], { cwd: root });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=benchmark',
        '-c',
        'user.email=benchmark@example.test',
        'commit',
        '-q',
        '-m',
        'restore config',
      ],
      { cwd: root },
    );
    writeManifest({ ...manifest, identity: 'different' });
    const identityMismatch = run('--json', '--root', root, '--revision', 'HEAD');
    expect(identityMismatch.status).not.toBe(0);
    expect(identityMismatch.stderr).toContain('manifest identity differs');
    writeManifest(manifest);
    writeFileSync(join(root, 'packages/cursor/sync.config.ts'), 'changed config\n');
    const configIdentityMismatch = run('--json', '--root', root, '--revision', 'HEAD');
    expect(configIdentityMismatch.status).not.toBe(0);
    expect(configIdentityMismatch.stderr).toContain('sync configuration inputs differ');
    writeManifest(manifest);
    copyFileSync(join(sourceRoot, manifest.syncConfigs[0]), join(root, manifest.syncConfigs[0]));
    writeFileSync(join(root, manifest.syncConfigs[4]), 'same config\n');

    const historicalSourcePath = join(root, manifest.canonicalSources[0]);
    const committedSource = readFileSync(historicalSourcePath, 'utf8');
    const candidateSource = 'current source\n';
    writeFileSync(historicalSourcePath, candidateSource);
    const gitSourcedBaseline = run('--json', '--root', root, '--revision', 'HEAD');
    expect(gitSourcedBaseline.status).toBe(0);
    const gitSourcedReport = JSON.parse(gitSourcedBaseline.stdout);
    expect(gitSourcedReport.baseline.canonicalFiles[manifest.canonicalSources[0]]).toEqual(
      metrics(committedSource),
    );
    expect(gitSourcedReport.candidate.canonicalFiles[manifest.canonicalSources[0]]).toEqual(
      metrics(candidateSource),
    );
    expect(gitSourcedReport.baseline.canonicalFiles[manifest.canonicalSources[0]]).not.toEqual(
      gitSourcedReport.candidate.canonicalFiles[manifest.canonicalSources[0]],
    );
    writeManifest(manifest);
    copyFileSync(
      join(sourceRoot, manifest.canonicalSources[0]),
      join(root, manifest.canonicalSources[0]),
    );
    rmSync(join(root, manifest.canonicalSources[1]));
    const missingSourceResult = run('--json', '--root', root);
    expect(missingSourceResult.status).not.toBe(0);
    expect(missingSourceResult.stderr).toContain(
      `Manifest path is missing or unreadable: ${manifest.canonicalSources[1]}`,
    );
    expect(missingSourceResult.stdout).toBe('');
    writeManifest(manifest);
    copyFileSync(
      join(sourceRoot, manifest.canonicalSources[1]),
      join(root, manifest.canonicalSources[1]),
    );
    const outputPath = manifest.generatedOutputs[0].output;
    const output = readFileSync(join(root, outputPath), 'utf8');
    execFileSync('git', ['rm', '-q', '-f', outputPath], { cwd: root });
    const missingOutputResult = run('--json', '--root', root);
    expect(missingOutputResult.status).not.toBe(0);
    expect(missingOutputResult.stderr).toContain(
      `Manifest path is missing or unreadable: ${outputPath}`,
    );
    expect(missingOutputResult.stdout).toBe('');
    writeFileSync(join(root, outputPath), output);
    execFileSync('git', ['add', outputPath], { cwd: root });
    const configPath = manifest.syncConfigs[0];
    rmSync(join(root, configPath));
    writeManifest(manifest);
    const missingConfigResult = run('--json', '--root', root);
    expect(missingConfigResult.status).not.toBe(0);
    expect(missingConfigResult.stderr).toContain(
      `Manifest path is missing or unreadable: ${configPath}`,
    );
    expect(missingConfigResult.stdout).toBe('');
    writeManifest(manifest);
    copyFileSync(join(sourceRoot, configPath), join(root, configPath));
    const escapedPath = { ...manifest, canonicalSources: ['../outside.md'] };
    writeManifest(escapedPath);
    const escapedResult = run('--json', '--root', root);
    expect(escapedResult.status).not.toBe(0);
    expect(escapedResult.stdout).toBe('');
    writeManifest(manifest);
    writeFileSync(join(root, configPath), 'changed config\n');
    expect(run('--json', '--root', root, '--revision', 'HEAD').status).not.toBe(0);
    copyFileSync(join(sourceRoot, configPath), join(root, configPath));
    writeFileSync(join(root, outputPath), 'changed output\n');
    expect(run('--json', '--root', root, '--revision', 'HEAD').status).toBe(0);
    execFileSync('git', ['rm', '-q', '-f', outputPath], { cwd: root });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=benchmark',
        '-c',
        'user.email=benchmark@example.test',
        'commit',
        '-q',
        '-m',
        'remove output',
      ],
      { cwd: root },
    );
    writeFileSync(join(root, outputPath), 'current output\n');
    expect(run('--json', '--root', root, '--revision', 'HEAD').status).not.toBe(0);
    expect(readFileSync(join(root, 'scripts/fixtures/directive-benchmark.json'), 'utf8')).toContain(
      manifest.identity,
    );
  }, 15000);

  it('rejects working-tree symlink escapes', () => {
    const root = temporaryRoot('directive-benchmark-symlink-');
    const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../');
    const fixtureFiles = new Set([
      ...manifest.canonicalSources,
      ...manifest.generatedOutputs.flatMap((entry: any) => [entry.source, entry.output]),
      ...manifest.syncConfigs,
    ]);
    for (const path of fixtureFiles) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      copyFileSync(join(sourceRoot, path), join(root, path));
    }
    const symlinkPath = join(root, manifest.canonicalSources[0]);
    rmSync(symlinkPath);
    symlinkSync(join(root, manifest.canonicalSources[1]), symlinkPath);
    expect(() => validateManifest(manifest, root)).toThrow('symlink');
  });

  it('rejects symlinked parent directories that resolve outside the selected root', () => {
    const root = temporaryRoot('directive-benchmark-external-symlink-');
    const outsideRoot = temporaryRoot('directive-benchmark-external-target-');
    const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../');
    const canonicalRoot = join(root, 'packages/core/agent-directives');
    const externalCanonicalRoot = join(outsideRoot, 'agent-directives');

    for (const path of manifest.canonicalSources) {
      const sourcePath = join(sourceRoot, path);
      const externalPath = join(externalCanonicalRoot, path.split('/').slice(3).join('/'));
      mkdirSync(dirname(externalPath), { recursive: true });
      copyFileSync(sourcePath, externalPath);
    }
    const fixtureFiles = new Set([
      ...manifest.generatedOutputs.flatMap((entry: any) => [entry.source, entry.output]),
      ...manifest.syncConfigs,
    ]);
    for (const path of fixtureFiles) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      copyFileSync(join(sourceRoot, path), join(root, path));
    }

    rmSync(canonicalRoot, { recursive: true, force: true });
    symlinkSync(externalCanonicalRoot, canonicalRoot, 'dir');
    expect(() => validateManifest(manifest, root)).toThrow(
      'Manifest path escapes selected root through a symlink',
    );
  });
});
