import { describe, expect, it } from 'vite-plus/test';
import {
  captureWorktreeContentManifest,
  createWorktreeContentManifest,
  sameWorktreeContentManifest,
} from '../src/manifest-core.js';

describe('worktree content manifests', () => {
  it('preserves approval content across unstaged, staged, and committed states', async () => {
    let files = ['src/file.ts'];
    const manifestAtReview = await captureWorktreeContentManifest(async (_command) => ({
      stdout:
        _command === 'find' ? `${files.map((file) => `./${file}`).join('\0')}\0` : 'a'.repeat(40),
      code: 0,
    }));
    const staged = await captureWorktreeContentManifest(async (_command) => ({
      stdout:
        _command === 'find' ? `${files.map((file) => `./${file}`).join('\0')}\0` : 'a'.repeat(40),
      code: 0,
    }));
    const committed = await captureWorktreeContentManifest(async (_command) => ({
      stdout:
        _command === 'find' ? `${files.map((file) => `./${file}`).join('\0')}\0` : 'a'.repeat(40),
      code: 0,
    }));

    expect(sameWorktreeContentManifest(manifestAtReview, staged)).toBe(true);
    expect(sameWorktreeContentManifest(manifestAtReview, committed)).toBe(true);
  });

  it('invalidates changed and added content', async () => {
    const original = await createWorktreeContentManifest([
      { path: 'src/file.ts', contentDigest: 'a'.repeat(64) },
    ]);
    const changed = await createWorktreeContentManifest([
      { path: 'src/file.ts', contentDigest: 'b'.repeat(64) },
    ]);
    const added = await createWorktreeContentManifest([
      { path: 'src/file.ts', contentDigest: 'a'.repeat(64) },
      { path: 'src/added.ts', contentDigest: 'a'.repeat(64) },
    ]);

    expect(sameWorktreeContentManifest(original, changed)).toBe(false);
    expect(sameWorktreeContentManifest(original, added)).toBe(false);
  });

  it('fails closed for manifest and digest errors', async () => {
    expect(
      await createWorktreeContentManifest([{ path: 'src/file.ts', contentDigest: 'bad' }]),
    ).toBeUndefined();
    expect(
      await captureWorktreeContentManifest(async (_command) => ({
        stdout: _command === 'find' ? './src/file.ts\0' : 'not-a-digest',
        code: 0,
      })),
    ).toBeUndefined();
    expect(
      await captureWorktreeContentManifest(async () => ({ stdout: '', code: 1 })),
    ).toBeUndefined();
  });
});
