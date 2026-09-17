import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';

export type OmpModel = Parameters<ExtensionAPI['setModel']>[0];

export const isOmpModel = (value: unknown): value is OmpModel =>
  typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string';
