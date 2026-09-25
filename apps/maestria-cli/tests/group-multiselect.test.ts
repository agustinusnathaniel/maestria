import { PassThrough } from 'node:stream';
import { setTimeout } from 'node:timers/promises';
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

  it('toggles all items across groups on `a` (native lacks this; guards fallback)', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    output.resume();
    const resultPromise = groupMultiselect({
      input,
      message: 'Pick items',
      options: {
        GroupA: [
          { label: 'One', value: 'one' },
          { label: 'Two', value: 'two' },
        ],
        GroupB: [{ label: 'Three', value: 'three' }],
      },
      output,
      required: true,
      selectableGroups: true,
      showInstructions: false,
    });
    await setTimeout(50);
    input.write('a');
    await setTimeout(50);
    input.write('\r');
    expect(await resultPromise).toEqual(['one', 'two', 'three']);
    output.end();
  });
});
