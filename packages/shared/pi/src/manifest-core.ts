/** Content-only worktree manifests shared by the Pi extensions. */

export interface WorktreeManifestEntry {
  path: string;
  contentDigest: string;
}

export interface WorktreeContentManifest {
  entries: readonly WorktreeManifestEntry[];
  digest: string;
}

export interface GitExecResult {
  stdout: string;
  code: number;
}

export type GitExec = (command: string, args: string[]) => Promise<GitExecResult>;

export async function sha256Hex(parts: readonly string[]): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(parts.join('\0')),
  );
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createWorktreeContentManifest(
  entries: readonly WorktreeManifestEntry[],
): Promise<WorktreeContentManifest | undefined> {
  const normalized = [...entries].sort((left, right) => left.path.localeCompare(right.path));
  if (normalized.some((entry, index) => index > 0 && entry.path === normalized[index - 1]?.path)) {
    return undefined;
  }

  if (
    normalized.some(
      (entry) =>
        !entry.path || entry.path.includes('\0') || !/^[a-f0-9]{64}$/.test(entry.contentDigest),
    )
  ) {
    return undefined;
  }

  const serialized = normalized
    .map((entry) => `${JSON.stringify(entry.path)}:${JSON.stringify(entry.contentDigest)}`)
    .join(',');
  return {
    entries: normalized,
    digest: await sha256Hex([`[${serialized}]`]),
  };
}

/** Enumerate current worktree paths, then hash their current bytes. */
export async function captureWorktreeContentManifest(
  exec: GitExec,
): Promise<WorktreeContentManifest | undefined> {
  try {
    const listing = await exec('find', [
      '.',
      '-type',
      'f',
      '!',
      '-path',
      './.git',
      '!',
      '-path',
      './.git/*',
      '-print0',
    ]);
    if (listing.code !== 0) return undefined;
    if (listing.stdout !== '' && !listing.stdout.endsWith('\0')) return undefined;
    const paths = listing.stdout.split('\0').filter(Boolean);
    const entries: WorktreeManifestEntry[] = [];
    for (const rawPath of paths) {
      const path = rawPath.startsWith('./') ? rawPath.slice(2) : rawPath;
      const result = await exec('git', ['hash-object', '--no-filters', '--', rawPath]);
      if (result.code !== 0) return undefined;
      const contentDigest = result.stdout.trim();
      if (!/^[a-f0-9]{40}$|^[a-f0-9]{64}$/.test(contentDigest)) return undefined;
      // Git's object hash is content-derived. Normalize it into the manifest's
      // fixed-width digest without consulting the index or HEAD.
      entries.push({ path, contentDigest: await sha256Hex([contentDigest]) });
    }
    return createWorktreeContentManifest(entries);
  } catch {
    return undefined;
  }
}

export function sameWorktreeContentManifest(
  left: WorktreeContentManifest | null | undefined,
  right: WorktreeContentManifest | null | undefined,
): boolean {
  if (!left || !right || left.digest !== right.digest) return false;
  if (left.entries.length !== right.entries.length) return false;
  return left.entries.every(
    (entry, index) =>
      entry.path === right.entries[index]?.path &&
      entry.contentDigest === right.entries[index]?.contentDigest,
  );
}
