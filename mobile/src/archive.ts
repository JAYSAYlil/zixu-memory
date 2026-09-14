import {
  allAttachments,
  emptyLibrary,
  validateLibrary,
  type Library,
  type Attachment,
} from './core.ts';

// Framed JSON lines; each frame is independently checksummed, the final frame
// checks the ordered chain so missing/reordered lines cannot pass validation.
export type ArchiveIO = {
  hash: (text: string) => Promise<string>;
  readMedia: (a: Attachment) => AsyncIterable<string>;
};
export async function* encodeArchive(library: Library, io: ArchiveIO): AsyncGenerator<string> {
  validateLibrary(library);
  let chain = '',
    count = 0;
  async function frame(value: unknown) {
    const payload = JSON.stringify(value);
    const sha256 = await io.hash(payload);
    chain = await io.hash(chain + sha256);
    count++;
    return JSON.stringify({ payload, sha256 }) + '\n';
  }
  yield await frame({ type: 'header', format: 'zixu-stream', version: 2 });
  const portable = (a: Attachment) => ({ ...a, uri: `attachment:${a.id}` });
  for (const m of library.memories)
    yield await frame({
      type: 'memory',
      value: { ...m, attachments: m.attachments.map(portable) },
    });
  for (const i of library.insights) yield await frame({ type: 'insight', value: i });
  yield await frame({
    type: 'draft',
    value: library.draft,
    composerDraft: library.composerDraft
      ? { ...library.composerDraft, attachments: library.composerDraft.attachments.map(portable) }
      : undefined,
  });
  for (const a of allAttachments(library)) {
    let index = 0;
    for await (const data of io.readMedia(a))
      yield await frame({ type: 'chunk', id: a.id, index: index++, data });
    yield await frame({ type: 'mediaEnd', id: a.id, chunks: index });
  }
  yield JSON.stringify({ end: true, count, chain }) + '\n';
}
export async function decodeArchive(
  lines: AsyncIterable<string>,
  hash: ArchiveIO['hash'],
  write: (id: string, bytes: Uint8Array) => Promise<void>,
  uri: (a: Attachment) => string,
): Promise<Library> {
  const library = emptyLibrary();
  let chain = '',
    count = 0,
    ended = false,
    drafted = false,
    mediaStarted = false;
  const chunks = new Map<string, number>();
  const completed = new Set<string>();
  let allowed: Map<string, Attachment> | undefined;
  for await (const line of lines) {
    if (!line.trim()) continue;
    if (ended || line.length > 32 * 1024 * 1024) throw new Error('备份结构无效。');
    const envelope = JSON.parse(line);
    if (envelope.end === true) {
      if (!drafted || envelope.count !== count || envelope.chain !== chain)
        throw new Error('备份不完整或顺序发生变化。');
      ended = true;
      continue;
    }
    if (typeof envelope.payload !== 'string' || (await hash(envelope.payload)) !== envelope.sha256)
      throw new Error('备份校验失败，现有记忆未改变。');
    chain = await hash(chain + envelope.sha256);
    const item = JSON.parse(envelope.payload);
    if (count++ === 0) {
      if (item.type !== 'header' || item.format !== 'zixu-stream' || item.version !== 2)
        throw new Error('不支持的备份格式。');
      continue;
    }
    if (item.type === 'memory' && !drafted) library.memories.push(item.value);
    else if (item.type === 'insight' && !drafted) library.insights.push(item.value);
    else if (item.type === 'draft' && !drafted && !mediaStarted) {
      library.draft = item.value;
      library.composerDraft = item.composerDraft;
      drafted = true;
      validateLibrary(library);
      allowed = new Map(allAttachments(library).map((a) => [a.id, a]));
    } else if ((item.type === 'chunk' || item.type === 'mediaEnd') && drafted) {
      mediaStarted = true;
      if (!allowed?.has(item.id) || completed.has(item.id))
        throw new Error('备份附件编号无效或重复。');
      const n = chunks.get(item.id) || 0;
      if (item.type === 'mediaEnd') {
        if (item.chunks !== n) throw new Error('附件缺少分块。');
        if (!n) await write(item.id, new Uint8Array());
        completed.add(item.id);
      } else {
        if (item.index !== n || typeof item.data !== 'string' || item.data.length > 400000)
          throw new Error('附件分块无效。');
        await write(item.id, fromBase64(item.data));
        chunks.set(item.id, n + 1);
      }
    } else throw new Error('备份帧顺序无效。');
    if (library.memories.length > 50000 || library.insights.length > 50000)
      throw new Error('记录数量超过限制。');
  }
  if (!ended || !drafted || allAttachments(library).some((a) => !completed.has(a.id)))
    throw new Error('备份被截断或缺少附件。');
  for (const m of library.memories)
    m.attachments = m.attachments.map((a) => ({ ...a, uri: uri(a) }));
  if (library.composerDraft)
    library.composerDraft.attachments = library.composerDraft.attachments.map((a) => ({
      ...a,
      uri: uri(a),
    }));
  return validateLibrary(library);
}
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    parts.push(
      alphabet[n >>> 18] +
        alphabet[(n >>> 12) & 63] +
        (i + 1 < bytes.length ? alphabet[(n >>> 6) & 63] : '=') +
        (i + 2 < bytes.length ? alphabet[n & 63] : '='),
    );
  }
  return parts.join('');
}
export function fromBase64(data: string): Uint8Array {
  if (
    data.length % 4 ||
    /[^A-Za-z0-9+/=]/.test(data) ||
    data.slice(0, -2).includes('=') ||
    (data.endsWith('=') ? false : data.includes('='))
  )
    throw new Error('附件编码无效。');
  const out = new Uint8Array(
    (data.length / 4) * 3 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0),
  );
  let j = 0;
  for (let i = 0; i < data.length; i += 4) {
    const n =
      (alphabet.indexOf(data[i]) << 18) |
      (alphabet.indexOf(data[i + 1]) << 12) |
      (Math.max(0, alphabet.indexOf(data[i + 2])) << 6) |
      Math.max(0, alphabet.indexOf(data[i + 3]));
    if (j < out.length) out[j++] = n >>> 16;
    if (j < out.length) out[j++] = n >>> 8;
    if (j < out.length) out[j++] = n;
  }
  return out;
}
