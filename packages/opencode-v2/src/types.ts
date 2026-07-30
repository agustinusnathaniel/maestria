// Plugin context and domain types for V2 beta API.
// These mirror the types from @opencode-ai/plugin but are declared locally
// because the SDK's barrel export does not re-export internal domain types.
// Source: https://opencode.ai/v2/docs/build/plugins

export interface PluginContext {
  readonly options: Record<string, unknown>;
  readonly agent: {
    transform(callback: (registry: unknown) => void): Promise<{ dispose: () => Promise<void> }>;
    list(): Promise<string[]>;
    get(name: string): Promise<unknown>;
    reload(): Promise<void>;
  };
  readonly session: {
    hook(
      event: string,
      callback: (event: unknown) => void,
    ): Promise<{ dispose: () => Promise<void> }>;
    create(config: unknown): Promise<unknown>;
    get(id: string): Promise<unknown>;
    prompt(config: unknown): Promise<unknown>;
    interrupt(id: string): Promise<void>;
  };
  readonly tool: {
    transform(callback: (tools: unknown) => void): Promise<{ dispose: () => Promise<void> }>;
    hook(
      event: string,
      callback: (event: unknown) => void,
    ): Promise<{ dispose: () => Promise<void> }>;
  };
  readonly command: {
    transform(callback: (commands: unknown) => void): Promise<{ dispose: () => Promise<void> }>;
    list(): Promise<string[]>;
    reload(): Promise<void>;
  };
  readonly catalog: {
    transform(callback: (catalog: unknown) => void): Promise<{ dispose: () => Promise<void> }>;
    reload(): Promise<void>;
    provider: {
      list(): Promise<unknown[]>;
      get(id: string): Promise<unknown>;
    };
    model: {
      list(): Promise<unknown[]>;
      get(providerId: string, modelId: string): Promise<unknown>;
    };
  };
  readonly skill: {
    transform(callback: (skills: unknown) => void): Promise<{ dispose: () => Promise<void> }>;
    list(): Promise<string[]>;
    reload(): Promise<void>;
  };
  readonly reference: {
    transform(callback: (refs: unknown) => void): Promise<{ dispose: () => Promise<void> }>;
    list(): Promise<string[]>;
    reload(): Promise<void>;
  };
  readonly plugin: {
    list(): Promise<string[]>;
  };
  readonly event: {
    subscribe(event: string): AsyncIterable<unknown>;
  };
}
