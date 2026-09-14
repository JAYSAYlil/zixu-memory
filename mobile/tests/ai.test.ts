import test from 'node:test';
import assert from 'node:assert/strict';
import { completion, recall, askSelf } from '../src/ai.ts';
import type { Insight, Memory } from '../src/core.ts';
const config = { baseUrl: 'https://mock.invalid/v1', key: 'test-key', model: 'mock' };
const memory: Memory = {
  id: 'a',
  text: '工作很疲惫',
  category: '工作',
  createdAt: '2026-09-14T12:00:00Z',
  updatedAt: '2026-09-14T12:00:00Z',
  starred: false,
  attachments: [],
  history: [],
};
const insight: Insight = {
  id: 'i',
  text: '待核对的结论',
  category: '价值观',
  status: 'confirmed',
  sourceChanged: true,
  sourceIds: ['a'],
  origin: 'ai',
  history: [],
  createdAt: memory.createdAt,
};
const originalFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
});
test('recall excludes stale confirmed profile and refuses missing or out-of-range citations', async () => {
  let content = '工作很疲惫 [1]';
  globalThis.fetch = async (_url, init) => {
    const input = JSON.parse(JSON.parse(init!.body as string).messages[1].content);
    assert.deepEqual(input.confirmedProfile, []);
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }));
  };
  assert.equal(await recall(config, '工作', [memory], [insight]), content);
  content = '无引用的猜测';
  await assert.rejects(recall(config, '工作', [memory], [insight]), /没有提供原文引用/);
  content = '越界 [2]';
  await assert.rejects(recall(config, '工作', [memory], [insight]), /不存在的记录/);
  content = '资料不足：尚未记录原因';
  assert.equal(await recall(config, '工作', [memory], [insight]), content);
});
test('self question with only stale profile makes no paid request', async () => {
  globalThis.fetch = async () => {
    throw new Error('must not call');
  };
  await assert.rejects(askSelf(config, '我怎么看', [memory], [insight]), /先在/);
});
test('external cancellation aborts fetch and distinguishes timeout from user cancellation', async () => {
  const controller = new AbortController(),
    stages: string[] = [];
  globalThis.fetch = async (_url, init) =>
    new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError')),
      );
      setTimeout(() => controller.abort(), 5);
    });
  await assert.rejects(
    completion(config, '', '', { signal: controller.signal, onStage: (s) => stages.push(s) }),
    /已取消请求/,
  );
  assert.deepEqual(stages, ['正在等待模型回答…']);
});
test('invalid provider JSON and HTTP bodies never echo credentials', async () => {
  globalThis.fetch = async () => new Response('sensitive-key');
  await assert.rejects(
    completion(config, '', ''),
    (e) => e instanceof Error && !e.message.includes('sensitive-key') && e.message.includes('格式'),
  );
  globalThis.fetch = async () => new Response('sensitive-key', { status: 401 });
  await assert.rejects(completion(config, '', ''), /Key 未通过验证/);
});
