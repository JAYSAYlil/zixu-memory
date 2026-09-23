import test from 'node:test';
import { selfSkill } from '../src/self.ts';
import assert from 'node:assert/strict';
import {
  emptyLibrary,
  importSummary,
  validateLibrary,
  removeMemory,
  reviseMemory,
  parseObservations,
  endpoint,
  searchMemories,
} from '../src/core.ts';
import type { Memory, Insight } from '../src/core.ts';
const memory = (id: string): Memory => ({
  id,
  text: '需要自己安排时间',
  category: '工作',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  starred: false,
  attachments: [],
  history: [],
});
const insight: Insight = {
  id: 'i',
  text: '自主权可能很重要',
  category: '价值观',
  origin: 'ai',
  status: 'pending',
  createdAt: '2026-09-01T10:00:00.000Z',
  sourceIds: ['a', 'b'],
  history: [],
};
test('editing adds media and category without losing existing attachment or creation date', () => {
  const m = memory('a');
  const photo = { id: 'photo', kind: 'photo' as const, uri: 'file:///photo.jpg', name: 'photo.jpg', mime: 'image/jpeg' };
  m.attachments = [photo];
  const audio = { ...photo, id: 'audio', kind: 'audio' as const, mime: 'audio/mp4' };
  const next = reviseMemory({ ...emptyLibrary(), memories: [m] }, 'a', m.text, '学习', [photo, audio]);
  assert.equal(next.memories[0].category, '学习');
  assert.equal(next.memories[0].attachments.length, 2);
  assert.equal(next.memories[0].createdAt, m.createdAt);
  assert.equal(next.memories[0].history.length, 0);
  assert.equal(m.attachments.length, 1);
});
test('portable self includes only confirmed current statements', () => {
  assert.throws(() => selfSkill([insight]));
  const exported = selfSkill([{ ...insight, status: 'confirmed', text: '重视自主', history: [{ text: '旧认识', at: insight.createdAt }] }, { ...insight, text: '未确认推测' }]);
  assert.ok(exported.includes('重视自主'));
  assert.ok(!exported.includes('未确认推测'));
  assert.ok(!exported.includes('旧认识'));
});
test('deleting a source retains observations and marks changed evidence', () => {
  const original = { ...emptyLibrary(), memories: [memory('a'), memory('b')], insights: [insight] };
  const next = removeMemory(original, 'a');
  assert.equal(next.insights[0].text, insight.text);
  assert.equal(next.insights[0].sourceChanged, true);
  assert.deepEqual(next.insights[0].sourceIds, ['b']);
  assert.doesNotThrow(() => validateLibrary(removeMemory(next, 'b')));
  assert.equal(next.memories[0].id, 'b');
  assert.equal(original.memories.length, 2);
});
test('editing preserves history and invalidates old interpretations', () => {
  const original = { ...emptyLibrary(), memories: [memory('a'), memory('b')], insights: [insight] };
  const next = reviseMemory(original, 'a', '我更在意清楚的安排');
  assert.equal(next.memories[0].history[0].text, original.memories[0].text);
  assert.equal(next.insights.length, 1);
  assert.equal(next.insights[0].sourceChanged, true);
});
test('unchanged text and attachment/category edits preserve pending and confirmed AI values', () => {
  const original = { ...emptyLibrary(), memories: [memory('a'), memory('b')], insights: [insight, { ...insight, id: 'confirmed', status: 'confirmed' as const }] };
  const next = reviseMemory(original, 'a', original.memories[0].text, '学习', []);
  assert.deepEqual(next.insights, original.insights);
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(next))).insights, original.insights);
});
test('backup rejects unknown versions, duplicate ids and dangling evidence', () => {
  assert.throws(() => validateLibrary({ ...emptyLibrary(), version: 2 }));
  assert.throws(() => validateLibrary({ ...emptyLibrary(), memories: [memory('a'), memory('a')] }));
  assert.throws(() => validateLibrary({ ...emptyLibrary(), insights: [insight] }));
  assert.deepEqual(validateLibrary(emptyLibrary()), emptyLibrary());
});
test('backup rejects attachment path traversal', () => {
  const m = memory('a');
  m.attachments = [{ id: '../escape', kind: 'audio', mime: 'audio/mp4', name: 'x', uri: 'x' }];
  assert.throws(() => validateLibrary({ ...emptyLibrary(), memories: [m] }));
});
test('AI observations require two real distinct source ids', () => {
  const sources = [memory('a'), memory('b')];
  assert.throws(() =>
    parseObservations('[{"text":"x","sourceIds":["a","invented"]}]', sources, 'test'),
  );
  assert.throws(() => parseObservations('[{"text":"x","sourceIds":["a","a"]}]', sources, 'test'));
  const items = parseObservations(
    '[{"text":"可以验证的观察","sourceIds":["a","b"]}]',
    sources,
    'test',
  );
  assert.equal(items[0].status, 'pending');
  assert.equal(items[0].model, 'test');
  assert.deepEqual(parseObservations('[]', sources, 'test'), []);
});
test('API destination validates HTTPS and rejects embedded credentials', () => {
  assert.equal(endpoint('https://example.com/v1/'), 'https://example.com/v1/chat/completions');
  assert.throws(() => endpoint('http://example.com'));
  assert.throws(() => endpoint('https://key:secret@example.com'));
  assert.throws(() => endpoint('https://example.com?key=secret'));
});
test('Chinese one and two character terms can find original text', () => {
  assert.equal(searchMemories([memory('a')], '时间').length, 1);
  assert.equal(searchMemories([memory('a')], '自').length, 1);
  assert.equal(searchMemories([memory('a')], '旅行').length, 0);
});
test('backup import summary counts identical ids without conflicts and changed ids as conflicts', () => {
  const same = memory('same');
  const changed = { ...memory('changed'), text: '不同内容' };
  const current = { ...emptyLibrary(), memories: [same, memory('changed')] };
  const incoming = { ...emptyLibrary(), memories: [same, changed, memory('new')] };

  assert.match(importSummary(current, incoming), /有 1 条同编号但内容不同的记录/);
  assert.match(importSummary(current, { ...emptyLibrary(), memories: [same, memory('new')] }), /有 0 条同编号但内容不同的记录/);
});
