import type { ServerResponse } from 'node:http';

export type ContentBlock =
  | { id: string; input: Record<string, unknown>; name: string; type: 'tool_use' }
  | { text: string; type: 'text' };

const writeEvent = (
  response: ServerResponse,
  name: string,
  data: Record<string, unknown>,
): void => {
  response.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
};

export const sendMessage = (
  response: ServerResponse,
  requestBody: Record<string, unknown>,
  block: ContentBlock,
  stopReason: 'end_turn' | 'tool_use',
  responseId: string,
): void => {
  const model = typeof requestBody.model === 'string' ? requestBody.model : 'claude-sonnet';
  const message = {
    content: [block],
    id: responseId,
    model,
    role: 'assistant',
    stop_reason: stopReason,
    stop_sequence: null,
    type: 'message',
    usage: { input_tokens: 1, output_tokens: 8 },
  };
  if (requestBody.stream !== true) {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(message));
    return;
  }

  const isToolUse = block.type === 'tool_use';
  const startBlock = isToolUse
    ? { id: block.id, input: {}, name: block.name, type: 'tool_use' }
    : { text: '', type: 'text' };
  const delta = isToolUse
    ? { partial_json: JSON.stringify(block.input), type: 'input_json_delta' }
    : { text: block.text, type: 'text_delta' };
  response.writeHead(200, {
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'content-type': 'text/event-stream',
  });
  writeEvent(response, 'message_start', {
    message: {
      ...message,
      content: [],
      stop_reason: null,
      usage: { input_tokens: 1, output_tokens: 0 },
    },
    type: 'message_start',
  });
  writeEvent(response, 'content_block_start', {
    content_block: startBlock,
    index: 0,
    type: 'content_block_start',
  });
  writeEvent(response, 'content_block_delta', { delta, index: 0, type: 'content_block_delta' });
  writeEvent(response, 'content_block_stop', { index: 0, type: 'content_block_stop' });
  writeEvent(response, 'message_delta', {
    delta: { stop_reason: stopReason, stop_sequence: null },
    type: 'message_delta',
    usage: { output_tokens: 8 },
  });
  writeEvent(response, 'message_stop', { type: 'message_stop' });
  response.end();
};

export const sendText = (
  response: ServerResponse,
  requestBody: Record<string, unknown>,
  responseId: string,
  text: string,
): void => {
  sendMessage(response, requestBody, { text, type: 'text' }, 'end_turn', responseId);
};

export const sendJson = (response: ServerResponse, body: Record<string, unknown>): void => {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};
