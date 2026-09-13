export type Attachment = {
  id: string;
  kind: 'photo' | 'audio';
  uri: string;
  name: string;
  mime: string;
  duration?: number;
};
export type Memory = {
  id: string;
  text: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  starred: boolean;
  attachments: Attachment[];
  history: { text: string; at: string }[];
};
export type Insight = {
  id: string;
  text: string;
  category: string;
  status: 'pending' | 'confirmed' | 'rejected';
  origin: 'self' | 'ai';
  sourceIds: string[];
  createdAt: string;
  model?: string;
  sourceChanged?: boolean;
  history: { text: string; at: string }[];
};
export type Library = { version: 1; memories: Memory[]; insights: Insight[]; draft: string };
export type ModelConfig = { baseUrl: string; model: string; key: string };
export const emptyLibrary = (): Library => ({ version: 1, memories: [], insights: [], draft: '' });
export const categories = ['日常', '学习', '工作', '关系', '想法', '选择'] as const;
export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
export function removeMemory(state: Library, id: string): Library {
  return {
    ...state,
    memories: state.memories.filter((m) => m.id !== id),
    insights: state.insights.map(i => i.sourceIds.includes(id)
      ? { ...i, sourceIds: i.sourceIds.filter(source => source !== id), sourceChanged: true }
      : i),
  };
}
export function reviseMemory(state: Library, id: string, text: string, category?: string, attachments?: Attachment[]): Library {
  const at = new Date().toISOString();
  return {
    ...state,
    memories: state.memories.map((m) =>
      m.id === id
        ? { ...m, text, category: category ?? m.category, attachments: attachments ?? m.attachments, updatedAt: at, history: text === m.text ? m.history : [...m.history, { text: m.text, at }] }
        : m,
    ),
    insights: state.insights.map(i => i.sourceIds.includes(id) && state.memories.some(m => m.id === id && m.text !== text)
      ? { ...i, sourceChanged: true }
      : i),
  };
}
export function searchMemories(memories: Memory[], query: string): Memory[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return memories.filter((m) =>
    terms.every((t) => `${m.text} ${m.category}`.toLocaleLowerCase().includes(t)),
  );
}
export function recallCandidates(memories: Memory[], query: string): Memory[] {
  const grams = [...new Set(query.toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fff]{2}/g) || [])];
  return [...memories]
    .sort((a, b) => {
      const score = (m: Memory) =>
        grams.reduce((n, g) => n + (m.text.toLowerCase().includes(g) ? 1 : 0), 0);
      return score(b) - score(a) || b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, 20);
}
function object(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
const str = (v: unknown, max = 100000): v is string => typeof v === 'string' && v.length <= max;
const date = (v: unknown) => str(v, 40) && Number.isFinite(Date.parse(v));
const history = (v: unknown) =>
  Array.isArray(v) && v.length <= 10000 && v.every((x) => object(x) && str(x.text) && date(x.at));
export function validateLibrary(value: unknown): Library {
  if (
    !object(value) ||
    value.version !== 1 ||
    !Array.isArray(value.memories) ||
    !Array.isArray(value.insights) ||
    !str(value.draft)
  )
    throw new Error('这不是支持的自叙备份（需要版本 1）。');
  if (value.memories.length > 50000 || value.insights.length > 50000)
    throw new Error('备份记录数量超过当前版本限制。');
  const ids = new Set<string>();
  const attachmentIds = new Set<string>();
  for (const m of value.memories) {
    if (
      !object(m) ||
      !str(m.id, 100) ||
      !m.id ||
      ids.has(m.id) ||
      !str(m.text) ||
      !str(m.category, 40) ||
      !date(m.createdAt) ||
      !date(m.updatedAt) ||
      typeof m.starred !== 'boolean' ||
      !history(m.history) ||
      !Array.isArray(m.attachments)
    )
      throw new Error('备份中的记录不完整或编号重复。');
    ids.add(m.id);
    for (const a of m.attachments) {
      if (
        !object(a) ||
        !str(a.id, 100) ||
        !/^[a-zA-Z0-9-]+$/.test(a.id) ||
        attachmentIds.has(a.id) ||
        !['photo', 'audio'].includes(a.kind) ||
        !str(a.uri) ||
        !str(a.name, 300) ||
        !str(a.mime, 100) ||
        (a.duration !== undefined && (!Number.isFinite(a.duration) || a.duration < 0))
      )
        throw new Error('备份附件信息无效。');
      attachmentIds.add(a.id);
    }
  }
  const insightIds = new Set<string>();
  for (const i of value.insights) {
    if (
      !object(i) ||
      !str(i.id, 100) ||
      insightIds.has(i.id) ||
      !str(i.text) ||
      !str(i.category, 40) ||
      !date(i.createdAt) ||
      !history(i.history) ||
      !['pending', 'confirmed', 'rejected'].includes(i.status) ||
      !['self', 'ai'].includes(i.origin) ||
      !Array.isArray(i.sourceIds) ||
      !i.sourceIds.every((id: unknown) => typeof id === 'string' && ids.has(id)) ||
      (i.origin === 'ai' && i.sourceIds.length === 0 && i.sourceChanged !== true) ||
      (i.sourceChanged !== undefined && typeof i.sourceChanged !== 'boolean') ||
      (i.model !== undefined && !str(i.model, 300))
    )
      throw new Error('备份中的个人档案缺少有效来源。');
    insightIds.add(i.id);
  }
  return value as Library;
}
export function endpoint(base: string): string {
  let url: URL;
  try {
    url = new URL(base.trim());
  } catch {
    throw new Error('请填写完整的 HTTPS API 地址。');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('API 地址需要使用 HTTPS，不能包含密码、查询参数或片段。');
  return `${url.toString().replace(/\/+$/, '')}/chat/completions`;
}
export function parseObservations(raw: string, sources: Memory[], model: string): Insight[] {
  const clean = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let list: unknown;
  try {
    list = JSON.parse(clean);
  } catch {
    throw new Error('模型没有返回有效的观察格式。原始记录没有改变，请重试或换一个模型。');
  }
  if (!Array.isArray(list)) throw new Error('模型返回的观察格式不正确。');
  const allowed = new Set(sources.map((m) => m.id));
  const valid = list
    .slice(0, 5)
    .filter(
      (x) =>
        object(x) &&
        str(x.text, 1200) &&
        x.text.trim() &&
        Array.isArray(x.sourceIds) &&
        x.sourceIds.length >= 2 &&
        new Set(x.sourceIds).size >= 2 &&
        x.sourceIds.every((id: string) => allowed.has(id)),
    );
  if (list.length && !valid.length) throw new Error('模型的观察没有足够的有效来源，因此没有保存。');
  return valid.map((x) => ({
    id: uid(),
    text: x.text,
    category: str(x.category, 20) ? x.category : '行为模式',
    status: 'pending',
    origin: 'ai',
    sourceIds: [...new Set<string>(x.sourceIds)],
    model,
    createdAt: new Date().toISOString(),
    history: [],
  }));
}
