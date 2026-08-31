import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vite-plus/test';

import { groupMultiselect } from '@/lib/group-multiselect.js';

describe('groupMultiselect renderer', () => {
  it('renders the final item with a trailing elbow', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const renderedPromise = (async () => {
      const chunks: string[] = [];
      for await (const chunk of output) {
        chunks.push(String(chunk));
      }
      return chunks.join('');
    })();

    const resultPromise = groupMultiselect({
      input,
      message: 'Choose an option',
      options: {
        'Final group': [{ label: 'Last item', value: 'last' }],
      },
      output,
      required: false,
      selectableGroups: true,
      showInstructions: false,
    });
    input.write('\r');

    expect(await resultPromise).toEqual([]);
    output.end();
    const rendered = await renderedPromise;
    expect(rendered).toContain('└ ');
  });
});
