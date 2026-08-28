import { existsSync } from 'node:fs';
import { Effect } from 'effect';
import type { ReferenceDraft, Transform } from '@/types.js';
import { RULES_PATH } from '@/root.js';

export function registerReferenceTransforms(ctx: {
  reference: { transform: Transform<ReferenceDraft> };
}): Effect.Effect<void, never, import('effect').Scope.Scope> {
  return Effect.gen(function* () {
    yield* ctx.reference.transform((draft: ReferenceDraft) => {
      if (existsSync(RULES_PATH)) {
        draft.add('maestria.rules', {
          type: 'local',
          path: RULES_PATH,
          description: 'Maestria global agent rules (synced from @maestria/core)',
        });
      }
    });
  });
}
