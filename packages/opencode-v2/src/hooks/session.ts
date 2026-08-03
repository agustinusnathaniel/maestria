import type { SessionContext, PluginContext } from '@/types.js';
import type { MaestriaPluginOptions, ModeKeyword } from '@/modes/types.js';
import { detectMode } from '@/modes/index.js';
import { getModeMarker, getModePrompt } from '@/modes/prompts.js';
import { readFileSync, existsSync } from 'node:fs';
import { RULES_PATH } from '@/root.js';

export async function registerSessionHooks(
  ctx: PluginContext,
  options: MaestriaPluginOptions,
): Promise<void> {
  const rawDisabled = (options.modes?.disabledKeywords ?? []) as ModeKeyword[] | undefined;
  const disabledKeywords = new Set<string>(
    (rawDisabled ?? []).map((k: ModeKeyword) => k.toLowerCase()),
  );

  const rulesContent = existsSync(RULES_PATH) ? readFileSync(RULES_PATH, 'utf-8') : '';

  await ctx.session.hook('context', (sessionCtx: SessionContext) => {
    // 1. Inject global rules into system prompt
    // SystemPart = { type: "text", text: string }
    if (rulesContent) {
      sessionCtx.system.push({ type: 'text', text: rulesContent });
    }

    // 2. Detect mode keywords in the user message text
    // Message.content is ALWAYS an Array<ContentPart> - never a string
    const lastUserMsg = [...sessionCtx.messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    const textParts = lastUserMsg.content.filter((p) => p.type === 'text') as Array<{
      type: 'text';
      text: string;
    }>;
    if (textParts.length === 0) return;

    // Detect against the full message text (joined), so mode priority and
    // code-block exclusion see the whole message.
    const joined = textParts.map((p) => p.text).join('\n');
    const result = detectMode(joined, disabledKeywords);
    if (!result) return;

    // 3. Inject mode marker + prompt into system
    const modeBlock = [getModeMarker(result.mode), '', getModePrompt(result.mode)].join('\n');
    sessionCtx.system.push({ type: 'text', text: modeBlock });

    // 4. Strip the keyword from the text part that actually contains it.
    // Walk parts tracking cumulative offset so the index in the joined
    // string maps to the correct part.
    let offset = 0;
    for (const part of textParts) {
      const partEnd = offset + part.text.length + 1; // +1 for the join '\n'
      if (result.index >= offset && result.index < partEnd) {
        const localIndex = result.index - offset;
        const localKeyword = result.keyword;
        const before = part.text.slice(0, localIndex);
        const after = part.text.slice(localIndex + localKeyword.length);
        part.text = (before + after).replace(/:?\s*$/, '').trim();
        break;
      }
      offset = partEnd;
    }
  });
}
