import { describe, expect, it, vi } from 'vite-plus/test';

import { handlePluginInstall, handlePluginValidate } from '@/commands/plugin.js';
import type { AgentPluginValidation } from '@/lib/agent-plugin-validation.js';
import { CliError } from '@/lib/command-result.js';

const pluginMocks = vi.hoisted(() => ({
  format: vi.fn((report: { valid: boolean }) => `formatted:${String(report.valid)}`),
  stage: vi.fn(),
  validate: vi.fn(),
}));

vi.mock('@/lib/agent-plugin-staging.js', () => ({
  stageAgentPlugin: pluginMocks.stage,
}));

vi.mock('@/lib/agent-plugin-validation.js', () => ({
  formatAgentPluginValidation: pluginMocks.format,
  validateAgentPlugin: pluginMocks.validate,
}));

const report = (valid: boolean): AgentPluginValidation => ({
  errors: valid ? [] : ['missing plugin.json'],
  name: 'my-plugin',
  root: '/tmp/my-plugin',
  skillNames: [],
  valid,
  warnings: [],
});

const captureCliError = async (promise: Promise<unknown>): Promise<CliError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CliError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected handler to throw CliError');
};

describe('plugin handlers', () => {
  it('validates a valid plugin directory with exit code 0', async () => {
    pluginMocks.validate.mockResolvedValue(report(true));

    const result = await handlePluginValidate({ path: '/tmp/my-plugin' });

    expect(result).toEqual({ exitCode: 0, output: 'formatted:true' });
  });

  it('validates an invalid plugin directory with exit code 1', async () => {
    pluginMocks.validate.mockResolvedValue(report(false));

    const result = await handlePluginValidate({ path: '/tmp/my-plugin' });

    expect(result).toEqual({ exitCode: 1, output: 'formatted:false' });
  });

  it('renders the validation report as JSON', async () => {
    pluginMocks.validate.mockResolvedValue(report(true));

    const result = await handlePluginValidate({ json: true, path: '/tmp/my-plugin' });

    expect(JSON.parse(result.output)).toEqual(report(true));
  });

  it('stages a valid plugin with exit code 0', async () => {
    pluginMocks.stage.mockResolvedValue({
      ...report(true),
      destination: '/tmp/staged',
      source: './my-plugin',
      version: '1.2.3',
    });

    const result = await handlePluginInstall({ source: './my-plugin' });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Staged my-plugin@1.2.3 at /tmp/staged');
  });

  it('throws CliError with the staging error message for an invalid plugin', async () => {
    pluginMocks.stage.mockRejectedValue(new Error('Invalid Agent Plugin: missing plugin.json'));

    const error = await captureCliError(handlePluginInstall({ source: './broken' }));

    expect(error.exitCode).toBe(1);
    expect(error.message).toBe('Invalid Agent Plugin: missing plugin.json');
  });
});
