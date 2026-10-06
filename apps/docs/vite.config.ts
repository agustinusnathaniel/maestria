import { defineConfig } from 'vite-plus';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  run: {
    tasks: {
      'build-site': {
        cache: true,
        command: 'astro build',
        // Astro reads and writes generated metadata; only dist needs restoration.
        input: [
          { auto: true },
          'src/**',
          'public/**',
          '!**/.astro/**',
          '!.astro/**',
          '!dist/**',
          // The lockfile and manifests replace volatile pnpm installer metadata.
          { base: 'workspace', pattern: '!node_modules/.modules.yaml' },
          { base: 'workspace', pattern: 'pnpm-lock.yaml' },
          { base: 'workspace', pattern: 'pnpm-workspace.yaml' },
          { base: 'workspace', pattern: 'package.json' },
          { base: 'workspace', pattern: 'vite.config.ts' },
          'package.json',
          'vite.config.ts',
        ],
        output: ['dist/**'],
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
