import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  emptyLibrary,
  recallCandidates,
  scopedMemories,
  observationCandidates,
  reviseMemory,
  removeMemory,
  validateLibrary,
  memoryText,
  textOnlyLibrary,
  type Memory,
  type Insight,
} from '../src/core.ts';
import { confirmedSelf, selfSkill } from '../src/self.ts';
import { encodeArchive, decodeArchive, toBase64, fromBase64 } from '../src/archive.ts';

const memory = (
  id: string,
  text = '工作让我感到疲惫',
  createdAt = '2020-01-01T12:00:00Z',
): Memory => ({
  id,
  text,
  createdAt,
  updatedAt: createdAt,
  category: '工作',
  starred: false,
  attachments: [],
  history: [],
});
const insight: Insight = {
  id: 'i',
  text: '可能在意自主安排',
  category: '价值观',
  createdAt: '2020-01-02T12:00:00Z',
  status: 'confirmed',
  origin: 'ai',
  sourceIds: ['a', 'b'],
  counterSourceIds: ['c'],
  history: [],
};
const hash = async (text: string) => createHash('sha256').update(text).digest('hex');
async function* iterable<T>(values: T[]) {
  yield* values;
}

test('Chinese question finds old work evidence despite twenty unrelated recent records', () => {
  const records = [
    memory('work'),
    ...Array.from({ length: 20 }, (_, i) =>
      memory('fruit' + i, '今天买了苹果', '2026-09-01T12:00:00Z'),
    ),
  ];
  assert.deepEqual(
    recallCandidates(records, '我为什么不喜欢工作').map((m) => m.id),
    ['work'],
  );
  assert.deepEqual(recallCandidates(records, '旅行'), []);
});
test('retrieval supports English case, Chinese single characters, deterministic recency and twenty-item cap', () => {
  assert.equal(recallCandidates([memory('a', 'SQLite数据库')], 'SQLITE').length, 1);
  assert.equal(recallCandidates([memory('a', '看海')], '海').length, 1);
  assert.equal(
    recallCandidates(
      Array.from({ length: 50 }, (_, i) => memory(String(i))),
      '工作',
    ).length,
    20,
  );
});
test('scope combines date, category and exact selection; invalid/reversed dates rejected', () => {
  const records = [memory('old'), memory('new', '工作', '2026-09-14T12:00:00Z')];
  assert.deepEqual(
    scopedMemories(records, {
      from: '2026-09-14',
      to: '2026-09-14',
      category: '工作',
      ids: ['new'],
    }).map((m) => m.id),
    ['new'],
  );
  assert.throws(() => scopedMemories(records, { from: '2026-02-30' }));
  assert.throws(() => scopedMemories(records, { from: '2026-09-14', to: '2020-01-01' }));
});
test('observations sample both oldest and newest instead of recent thirty only', () => {
  const records = Array.from({ length: 100 }, (_, i) =>
    memory(String(i), '工作', new Date(Date.UTC(2020, 0, 1 + i)).toISOString()),
  );
  const chosen = observationCandidates(records);
  assert.equal(chosen.length, 30);
  assert.equal(chosen[0].id, '0');
  assert.equal(chosen.at(-1)!.id, '99');
  assert.equal(new Set(chosen.map((m) => m.id)).size, 30);
});
test('changed support and counterevidence are excluded from AI and export until reconfirmed', () => {
  const library = {
    ...emptyLibrary(),
    memories: ['a', 'b', 'c'].map((id) => memory(id)),
    insights: [insight],
  };
  for (const next of [
    reviseMemory(library, 'a', '变化'),
    reviseMemory(library, 'c', '反例变化'),
    removeMemory(library, 'c'),
  ]) {
    assert.equal(next.insights[0].sourceChanged, true);
    assert.deepEqual(confirmedSelf(next.insights), []);
    assert.throws(() => selfSkill(next.insights));
    assert.doesNotThrow(() => validateLibrary(next));
  }
});
test('full editing draft survives JSON round trip; missing target is rejected', () => {
  const a = {
    id: 'audio',
    kind: 'audio' as const,
    uri: 'file:///audio',
    name: 'audio.m4a',
    mime: 'audio/mp4',
  };
  const record = { ...memory('a'), attachments: [a] };
  const library = {
    ...emptyLibrary(),
    memories: [record],
    composerDraft: {
      text: '未保存修改',
      category: '学习',
      editingId: 'a',
      attachments: [a],
      updatedAt: record.updatedAt,
    },
  };
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(library))), library);
  assert.throws(() =>
    validateLibrary({
      ...library,
      composerDraft: { ...library.composerDraft, editingId: 'missing' },
    }),
  );
});
test('editable transcript is searchable, text export retains it, corrections invalidate insights', () => {
  const audio = {
    id: 'audio',
    kind: 'audio' as const,
    uri: 'file:///audio',
    name: 'audio.m4a',
    mime: 'audio/mp4',
    transcript: { text: '我喜欢旅行', segments: [{ start: 2, end: 4, text: '我喜欢旅行' }] },
  };
  const a = { ...memory('a', ''), attachments: [audio] };
  const library = {
    ...emptyLibrary(),
    memories: [a, memory('b'), memory('c')],
    insights: [insight],
  };
  assert.equal(recallCandidates(library.memories, '旅行')[0].id, 'a');
  assert.match(memoryText(a), /\[0:02\]/);
  assert.match(textOnlyLibrary(library).memories[0].text, /旅行/);
  assert.equal(textOnlyLibrary(library).memories[0].attachments.length, 0);
  assert.equal(
    reviseMemory(library, 'a', '', undefined, [
      { ...audio, transcript: { text: '工作', segments: [] } },
    ]).insights[0].sourceChanged,
    true,
  );
  assert.throws(() =>
    validateLibrary({
      ...library,
      memories: [
        {
          ...a,
          attachments: [
            { ...audio, transcript: { text: '', segments: [{ start: -1, end: 0, text: 'bad' }] } },
          ],
        },
      ],
    }),
  );
});
test('archive roundtrip includes draft-only media, and rejects corruption/truncation/reordering', async () => {
  const a = {
    id: 'audio',
    kind: 'audio' as const,
    uri: 'file:///audio',
    name: 'audio.m4a',
    mime: 'audio/mp4',
  };
  const library = {
    ...emptyLibrary(),
    memories: [memory('a')],
    composerDraft: {
      text: '草稿',
      category: '日常',
      attachments: [a],
      updatedAt: '2026-09-14T12:00:00Z',
    },
  };
  const bytes = new Uint8Array([0, 1, 255, 12]);
  const lines: string[] = [];
  for await (const line of encodeArchive(library, {
    hash,
    async *readMedia() {
      yield toBase64(bytes);
    },
  }))
    lines.push(line);
  const writes: Uint8Array[] = [];
  const restored = await decodeArchive(
    iterable(lines),
    hash,
    async (_id, b) => {
      writes.push(b);
    },
    (a) => 'restored/' + a.id,
  );
  assert.deepEqual(writes[0], bytes);
  assert.equal(restored.composerDraft!.attachments[0].uri, 'restored/audio');
  for (const broken of [
    lines.slice(0, -1),
    lines.filter((_, i) => i !== 3),
    [lines[0], lines[2], lines[1], ...lines.slice(3)],
    lines.map((l, i) => (i === 1 ? l.replace('工作', '更改') : l)),
  ]) {
    await assert.rejects(
      decodeArchive(
        iterable(broken),
        hash,
        async () => {},
        (a) => a.uri,
      ),
    );
  }
});
test('archive processes more than 30 MB of media in bounded chunks', async () => {
  const audio = {
    id: 'big',
    kind: 'audio' as const,
    uri: 'file:///big',
    name: 'big.m4a',
    mime: 'audio/mp4',
  };
  const library = { ...emptyLibrary(), memories: [{ ...memory('a'), attachments: [audio] }] };
  const bytes = new Uint8Array(192 * 1024).fill(121);
  let restoredBytes = 0;
  const lines = encodeArchive(library, {
    hash,
    async *readMedia() {
      for (let n = 0; n < 170; n++) yield toBase64(bytes);
    },
  });
  await decodeArchive(
    lines,
    hash,
    async (_id, data) => {
      assert.equal(data[100], 121);
      restoredBytes += data.length;
    },
    (a) => a.uri,
  );
  assert.ok(restoredBytes > 30 * 1024 * 1024);
});
test('base64 handles tail bytes and rejects invalid encodings', () => {
  for (let n = 0; n < 100; n++) {
    const bytes = new Uint8Array(n).map((_, i) => i * 7);
    assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
  }
  for (const bad of ['a', '../x', '====', 'AA=A']) assert.throws(() => fromBase64(bad));
});
test('SKILL export keeps more than forty valid statements and transcript revisions keep original text', () => {
  const profiles = Array.from({ length: 45 }, (_, n) => ({
    ...insight,
    id: String(n),
    text: '第' + n + '条认识',
  }));
  assert.match(selfSkill(profiles), /第44条认识/);
  const a = {
    id: 'audio',
    kind: 'audio' as const,
    uri: 'file:///audio',
    name: 'a.m4a',
    mime: 'audio/mp4',
    transcript: { text: '原始转写', segments: [] },
  };
  const original = { ...emptyLibrary(), memories: [{ ...memory('a', ''), attachments: [a] }] };
  const next = reviseMemory(original, 'a', '', undefined, [
    { ...a, transcript: { text: '校正文字', segments: [] } },
  ]);
  assert.match(next.memories[0].history[0].text, /原始转写/);
});
