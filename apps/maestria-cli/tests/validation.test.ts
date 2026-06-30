import { describe, it, expect } from 'vite-plus/test';

describe('validation', () => {
  it('exports ValidationError class', async () => {
    const validation = await import('../src/lib/validation.js');
    expect(validation.ValidationError).toBeDefined();
  });
  it('exports validatePlatform function', async () => {
    const validation = await import('../src/lib/validation.js');
    expect(typeof validation.validatePlatform).toBe('function');
  });
  it('exports validateOrExit function', async () => {
    const validation = await import('../src/lib/validation.js');
    expect(typeof validation.validateOrExit).toBe('function');
  });
});
