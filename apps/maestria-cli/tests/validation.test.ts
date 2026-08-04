import { describe, it, expect } from 'vite-plus/test';
import * as validation from '@/lib/validation.js';

describe('validation', () => {
  it('exports ValidationError class', () => {
    expect(validation.ValidationError).toBeDefined();
  });
  it('exports validatePlatform function', () => {
    expect(typeof validation.validatePlatform).toBe('function');
  });
  it('exports validateOrExit function', () => {
    expect(typeof validation.validateOrExit).toBe('function');
  });
});
