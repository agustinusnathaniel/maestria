import type { PluginContext } from '@/types.js';
import type { MaestriaPluginOptions, ModeKeyword } from '@/modes/types.js';
import { detectMode, stripKeyword } from '@/modes/index.js';
import { getModeMarker, getModePrompt } from '@/modes/prompts.js';
import { readFileSync, existsSync } from 'node:fs';
import { RULES_PATH } from '@/root.js';

/**
 * System part for V2 session context.
 * The V2 API's SessionContext.system is an array of these parts.
 */
interface SystemPart {
  text: string;
}

/**
 * Message part for V2 session context.
 */
interface MessagePart {
  type: string;
  text?: string;
}

/**
 * Message for V2 session context.
 */
interface ContextMessage {
  role: string;
  content: string | MessagePart[];
}

/**
 * V2 SessionContext type (subset).
 * The V2 API fires 'context' hook events, not 'request'.
 * system is an array of SystemPart, not a plain string.
 */
interface SessionContext {
  system: SystemPart[];
  messages: ContextMessage[];
  tools?: Record<string, unknown>;
}

export async function registerSessionHooks(
  ctx: PluginContext,
  options: MaestriaPluginOptions,
): Promise<void> {
  const rawDisabled = (options.modes?.disabledKeywords ?? []) as ModeKeyword[] | undefined;
  const disabledKeywords = new Set<string>(
    (rawDisabled ?? []).map((k: ModeKeyword) => k.toLowerCase()),
  );

  // Load rules content
  const rulesContent = existsSync(RULES_PATH) ? readFileSync(RULES_PATH, 'utf-8') : '';

  await ctx.session.hook('context', (event: unknown) => {
    const ctxEvent = event as SessionContext;

    // 1. Inject global rules into system prompt (system is an array of SystemPart)
    if (rulesContent) {
      ctxEvent.system.push({ text: rulesContent });
    }

    // 2. Detect mode keywords in last user message
    // Messages can have content as string or array of parts
    const lastUserMsg = ctxEvent.messages.filter((m) => m.role === 'user').pop();
    if (!lastUserMsg) return;

    // Extract text from message (handles both string and array content)
    const text = extractMessageText(lastUserMsg);
    if (!text) return;

    const result = detectMode(text, disabledKeywords);
    if (!result) return;

    // Inject mode marker + prompt into system
    const modeBlock = [getModeMarker(result.mode), '', getModePrompt(result.mode)].join('\n');
    ctxEvent.system.push({ text: modeBlock });

    // Strip keyword from user message
    setMessageText(lastUserMsg, stripKeyword(text, result));
  });
}

/**
 * Extract text content from a V2 message, which can be a string or a parts array.
 */
function extractMessageText(msg: ContextMessage): string {
  if (typeof msg.content === 'string') {
    return msg.content;
  }
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((p): p is MessagePart => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
      .join('\n');
  }
  return '';
}

/**
 * Set text content on a V2 message, handling both string and parts array formats.
 */
function setMessageText(msg: ContextMessage, text: string): void {
  if (typeof msg.content === 'string') {
    msg.content = text;
  } else if (Array.isArray(msg.content)) {
    const textPart = msg.content.find((p) => p.type === 'text');
    if (textPart) {
      textPart.text = text;
    } else {
      msg.content.push({ type: 'text', text });
    }
  }
}
