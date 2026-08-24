import { existsSync } from 'node:fs';
import type { ReferenceDraft, Transform } from '@/types.js';
import { RULES_PATH } from '@/root.js';

/**
 * Register the global rules file as a native V2 reference source.
 *
 * V1 pushed the rules text into the session system prompt on every context
 * hook fire. V2 provides ctx.reference.transform() for instruction sources,
 * so the rules file is declared once and the runtime owns reading/injection.
 * Verified against the installed @opencode-ai/plugin types:
 * ReferenceDraft.add(name, source) with local source { type: "local", path }.
 */
export async function registerReferenceTransforms(ctx: {
  reference: { transform: Transform<ReferenceDraft> };
}): Promise<void> {
  await ctx.reference.transform((draft: ReferenceDraft) => {
    if (existsSync(RULES_PATH)) {
      draft.add('maestria.rules', {
        type: 'local',
        path: RULES_PATH,
        description: 'Maestria global agent rules (synced from @maestria/core)',
      });
    }
  });
}
