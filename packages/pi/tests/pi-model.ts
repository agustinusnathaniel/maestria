/** A model with the shape `isPiModel` accepts. */
export const piModel = (id: string) => ({
  api: 'anthropic-messages' as const,
  baseUrl: 'https://api.anthropic.com',
  contextWindow: 200_000,
  cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
  id,
  input: ['text' as const],
  maxTokens: 4096,
  name: id,
  provider: 'anthropic',
  reasoning: false,
});
