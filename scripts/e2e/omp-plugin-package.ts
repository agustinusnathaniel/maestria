import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

interface PluginManifest {
  name: string;
  version: string;
  omp?: unknown;
  pi?: unknown;
}

type RecordCheck = (name: string, pass: boolean, detail?: string) => void;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPluginManifest = (value: unknown): value is PluginManifest =>
  isRecord(value) && typeof value.name === 'string' && typeof value.version === 'string';

const readPluginManifest = (filePath: string): PluginManifest => {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (!isPluginManifest(parsed)) {
    throw new Error(`invalid plugin package manifest: ${filePath}`);
  }
  return parsed;
};

const run = (command: string, args: string[], env: NodeJS.ProcessEnv, cwd: string): string => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf-8', env });
  if (result.error) {
    throw new Error(`${command} could not run: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const output = `${result.stderr}\n${result.stdout}`.trim();
    throw new Error(
      `${command} exited ${result.status ?? 'without a status'}: ${output.slice(-3000)}`,
    );
  }
  return result.stdout;
};

const archiveFileName = (
  output: string,
  packDirectory: string,
  recordCheck: RecordCheck,
): string => {
  const packed: unknown = JSON.parse(output);
  const archivePath =
    isRecord(packed) && typeof packed.filename === 'string' ? packed.filename : null;
  const files =
    isRecord(packed) && Array.isArray(packed.files)
      ? packed.files.flatMap((file: unknown) =>
          isRecord(file) && typeof file.path === 'string' ? [file.path] : [],
        )
      : [];
  const flat =
    archivePath !== null &&
    fs.existsSync(archivePath) &&
    files.includes('plugin.json') &&
    !files.some((entry) => entry.startsWith('plugin/')) &&
    !files.some((entry) => entry.startsWith('generation/'));
  recordCheck('pnpm pack produced a flat archive', flat, archivePath ?? 'archive missing');
  if (archivePath === null) {
    throw new Error(`pnpm pack did not write an archive into ${packDirectory}`);
  }
  return path.basename(archivePath);
};

export const loadPackedPlugin = (
  repoRoot: string,
  fixtureRoot: string,
  recordCheck: RecordCheck,
): { manifest: PluginManifest; packageRoot: string } => {
  const sourcePackageRoot = path.join(repoRoot, 'packages/agent-plugins');
  const sourceManifest = readPluginManifest(path.join(sourcePackageRoot, 'plugin/package.json'));
  const packDirectory = path.join(fixtureRoot, 'pack');
  const pnpmHome = path.join(fixtureRoot, 'pnpm-home');
  const packEnv = { ...process.env, HOME: pnpmHome, USERPROFILE: pnpmHome };
  fs.mkdirSync(packDirectory, { recursive: true });
  fs.mkdirSync(pnpmHome, { recursive: true });
  const archiveName = archiveFileName(
    run(
      'pnpm',
      ['pack', '--json', '--pack-destination', packDirectory],
      packEnv,
      sourcePackageRoot,
    ),
    packDirectory,
    recordCheck,
  );
  const extractedRoot = path.join(fixtureRoot, 'extracted');
  fs.mkdirSync(extractedRoot, { recursive: true });
  run(
    'tar',
    ['-xzf', path.join(packDirectory, archiveName), '-C', extractedRoot],
    packEnv,
    repoRoot,
  );
  const packageRoot = path.join(extractedRoot, 'package');
  const manifest = readPluginManifest(path.join(packageRoot, 'package.json'));
  recordCheck(
    'archive contains the intended plugin manifest',
    manifest.name === sourceManifest.name &&
      manifest.version === sourceManifest.version &&
      typeof manifest.omp === 'object' &&
      manifest.omp !== null,
    `${manifest.name} ${manifest.version}; package.json must include an omp manifest`,
  );
  recordCheck(
    'negative fixture has no alternate OMP manifest',
    manifest.pi === undefined,
    'the negative fixture removes omp and must not retain a pi fallback',
  );
  return { manifest, packageRoot };
};
