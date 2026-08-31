import type { OxlintOverride } from 'vite-plus/lint';

export const testOverrides = {
  files: ['**/*.test.ts', '**/*.test.tsx'],
  rules: {
    'max-lines': 'off',
    'max-lines-per-function': 'off',
  },
} satisfies OxlintOverride;
