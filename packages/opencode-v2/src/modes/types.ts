import { z } from 'zod';

export const modeKeywordSchema = z.enum(['fein', 'sonar', 'blitz']);
export type ModeKeyword = z.infer<typeof modeKeywordSchema>;

export const maestriaOptionsSchema = z.object({
  modes: z
    .object({
      disabledKeywords: z.array(modeKeywordSchema).optional(),
    })
    .optional(),
});
export type MaestriaPluginOptions = z.infer<typeof maestriaOptionsSchema>;

export interface ModeResult {
  mode: ModeKeyword;
  keyword: string;
  index: number;
  prompt: string;
  marker: string;
}
