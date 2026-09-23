export type Attachment = {
  id: string;
  kind: 'photo' | 'audio' | 'file';
  uri: string;
  name: string;
  mime: string;
  duration?: number;
  transcript?: { text: string; segments: { start: number; end: number; text: string }[] };
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
  counterSourceIds?: string[];
  changeNote?: string;
  history: { text: string; at: string }[];
};
export type Draft = {
  text: string;
  category: string;
  attachments: Attachment[];
  editingId?: string;
  updatedAt: string;
};
export type Library = {
  version: 1;
  memories: Memory[];
  insights: Insight[];
  draft: string;
  composerDraft?: Draft;
};
export type ModelConfig = { baseUrl: string; model: string; key: string };
export const emptyLibrary = (): Library => ({ version: 1, memories: [], insights: [], draft: '' });
export const categories = ['日常', '学习', '工作', '关系', '想法', '选择'] as const;
export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
export function memoryText(m: Memory): string {
  return [
    m.text,
    ...m.attachments
      .filter((a) => a.transcript)
      .map(
        (a) =>
          `录音 ${a.id}：\n` +
          (a.transcript!.segments.length
            ? a
                .transcript!.segments.map(
                  (s) =>
                    `[${Math.floor(s.start / 60)}:${String(Math.floor(s.start % 60)).padStart(2, '0')}] ${s.text}`,
                )
                .join('\n')
            : a.transcript!.text),
      ),
    ...m.attachments.filter((a) => a.kind === 'file').map((a) => `文件：${a.name}`),
  ]
    .filter(Boolean)
    .join('\n\n');
}
export function removeMemory(state: Library, id: string): Library {
  return {
    ...state,
    memories: state.memories.filter((m) => m.id !== id),
    composerDraft: state.composerDraft?.editingId === id ? undefined : state.composerDraft,
    insights: state.insights.map((i) =>
      i.sourceIds.includes(id) || i.counterSourceIds?.includes(id)
        ? {
            ...i,
            sourceIds: i.sourceIds.filter((source) => source !== id),
            counterSourceIds: i.counterSourceIds?.filter((source) => source !== id),
            sourceChanged: true,
          }
        : i,
    ),
  };
}
export function reviseMemory(
  state: Library,
  id: string,
  text: string,
  category?: string,
  attachments?: Attachment[],
): Library {
  const at = new Date().toISOString();
  return {
    ...state,
    memories: state.memories.map((m) =>
      m.id === id
        ? {
            ...m,
            text,
            category: category ?? m.category,
            attachments: attachments ?? m.attachments,
            updatedAt: at,
            history:
              memoryText({ ...m, text, attachments: attachments ?? m.attachments }) ===
              memoryText(m)
                ? m.history
                : [...m.history, { text: memoryText(m), at }],
          }
        : m,
    ),
    insights: state.insights.map((i) =>
      (i.sourceIds.includes(id) || i.counterSourceIds?.includes(id)) &&
      state.memories.some(
        (m) =>
          m.id === id &&
          memoryText(m) !== memoryText({ ...m, text, attachments: attachments ?? m.attachments }),
      )
        ? { ...i, sourceChanged: true }
        : i,
    ),
  };
}
const searchCache = new WeakMap<Memory, string>();
function searchable(m: Memory) {
  let text = searchCache.get(m);
  if (text === undefined) {
    text = memoryText(m).toLocaleLowerCase();
    searchCache.set(m, text);
  }
  return text;
}
export function searchMemories(memories: Memory[], query: string): Memory[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return memories.filter((m) =>
    terms.every((t) => `${searchable(m)} ${m.category.toLocaleLowerCase()}`.includes(t)),
  );
}
export function recallCandidates(memories: Memory[], query: string): Memory[] {
  const grams = retrievalTerms(query);
  const synonyms = [
    ['工作', '上班', '职场', '职业'],
    ['选择', '决定', '抉择'],
    ['压力', '焦虑', '紧张'],
    ['朋友', '友谊', '友情'],
    ['休息', '放松', '休假'],
    ['学习', '读书', '课程'],
  ];
  const expanded = synonyms.filter((group) => group.some((word) => query.includes(word))).flat();
  return memories
    .map((m) => {
      const text = searchable(m);
      return {
        m,
        score:
          grams.reduce((n, g) => n + (text.includes(g) ? g.length : 0), 0) +
          expanded.reduce((n, word) => n + (text.includes(word) ? 0.5 : 0), 0),
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.m.createdAt.localeCompare(a.m.createdAt))
    .slice(0, 20)
    .map((x) => x.m);
}
const stopTerms = new Set([
  '为什么',
  '什么',
  '怎么',
  '怎样',
  '我为',
  '为何',
  '以前',
  '过去',
  '自己',
  '时候',
  '哪些',
  '是否',
  '可以',
  '一个',
  '今天',
  '最近',
  '如何',
  '喜欢',
  '不喜',
  '觉得',
  '感觉',
  '让我',
  '我想',
]);
export function retrievalTerms(query: string): string[] {
  const chunks = query.toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) || [];
  return [
    ...new Set(
      chunks.flatMap((chunk) =>
        /^[a-z0-9]+$/.test(chunk) || chunk.length === 1
          ? [chunk]
          : Array.from({ length: chunk.length - 1 }, (_, i) => chunk.slice(i, i + 2)),
      ),
    ),
  ].filter((t) => !stopTerms.has(t));
}
export type Scope = { from?: string; to?: string; category?: string; ids?: string[] };
export function scopedMemories(memories: Memory[], scope: Scope): Memory[] {
  for (const value of [scope.from, scope.to])
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      throw new Error('日期请使用有效的 YYYY-MM-DD 格式。');
  if (scope.from && scope.to && scope.from > scope.to)
    throw new Error('开始日期不能晚于结束日期。');
  const ids = scope.ids ? new Set(scope.ids) : undefined;
  return memories.filter((m) => {
    const d = new Date(m.createdAt);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return (
      (!scope.from || day >= scope.from) &&
      (!scope.to || day <= scope.to) &&
      (!scope.category || scope.category === '全部' || scope.category === m.category) &&
      (!ids || ids.has(m.id))
    );
  });
}
export function observationCandidates(memories: Memory[], limit = 30): Memory[] {
  const sorted = memories
    .filter((m) => memoryText(m).trim())
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (sorted.length <= limit) return sorted;
  return Array.from(
    { length: limit },
    (_, i) => sorted[Math.round((i * (sorted.length - 1)) / (limit - 1))],
  );
}
export function allAttachments(library: Library): Attachment[] {
  return [
    ...new Map(
      [
        ...library.memories.flatMap((m) => m.attachments),
        ...(library.composerDraft?.attachments || []),
      ].map((a) => [a.id, a]),
    ).values(),
  ];
}
export function validateDraftState(library: Library): void {
  const original = library.composerDraft?.editingId
    ? library.memories.find((m) => m.id === library.composerDraft!.editingId)
    : undefined;
  validateLibrary({
    ...emptyLibrary(),
    draft: library.draft,
    composerDraft: library.composerDraft,
    memories: original ? [original] : [],
  });
}
export function textOnlyLibrary(library: Library): Library {
  return {
    ...library,
    memories: library.memories.map((m) => ({ ...m, text: memoryText(m), attachments: [] })),
    composerDraft: library.composerDraft
      ? {
          ...library.composerDraft,
          text: [
            library.composerDraft.text,
            ...library.composerDraft.attachments.map((a) => a.transcript?.text || ''),
          ]
            .filter(Boolean)
            .join('\n\n'),
          attachments: [],
        }
      : undefined,
  };
}
export function importSummary(current: Library, incoming: Library): string {
  const currentById = new Map<string, Set<string>>();
  for (const memory of current.memories) {
    const versions = currentById.get(memory.id) ?? new Set<string>();
    versions.add(JSON.stringify(memory));
    currentById.set(memory.id, versions);
  }
  const conflicts = incoming.memories.filter((memory) => {
    const versions = currentById.get(memory.id);
    return !!versions && (versions.size > 1 || !versions.has(JSON.stringify(memory)));
  }).length;
  return `备份含 ${incoming.memories.length} 条记录、${incoming.insights.length} 条认识、${allAttachments(incoming).length} 个附件。与本机有 ${conflicts} 条同编号但内容不同的记录。恢复会替换本机 ${current.memories.length} 条记录和草稿，不进行合并。恢复前自动保留一份本机快照，可撤销恢复。`;
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
        !['photo', 'audio', 'file'].includes(a.kind) ||
        !str(a.uri) ||
        !str(a.name, 300) ||
        !str(a.mime, 100) ||
        (a.duration !== undefined && (!Number.isFinite(a.duration) || a.duration < 0))
      )
        throw new Error('备份附件信息无效。');
      attachmentIds.add(a.id);
      if (a.transcript !== undefined) {
        const t = a.transcript;
        if (
          a.kind !== 'audio' ||
          !object(t) ||
          !str(t.text) ||
          !Array.isArray(t.segments) ||
          t.segments.length > 10000 ||
          !t.segments.every(
            (s: any) =>
              object(s) &&
              Number.isFinite(s.start) &&
              s.start >= 0 &&
              Number.isFinite(s.end) &&
              s.end >= s.start &&
              str(s.text),
          )
        )
          throw new Error('录音转写数据无效。');
      }
    }
  }
  const insightIds = new Set<string>();
  if (value.composerDraft !== undefined) {
    const d = value.composerDraft;
    if (
      !object(d) ||
      !str(d.text) ||
      !str(d.category, 40) ||
      !date(d.updatedAt) ||
      (d.editingId !== undefined && !ids.has(d.editingId))
    )
      throw new Error('草稿信息无效。');
    validateLibrary({
      version: 1,
      draft: '',
      insights: [],
      memories: [
        {
          id: 'draft',
          text: d.text,
          category: d.category,
          createdAt: d.updatedAt,
          updatedAt: d.updatedAt,
          starred: false,
          history: [],
          attachments: d.attachments,
        },
      ],
    });
    for (const a of d.attachments)
      if (
        attachmentIds.has(a.id) &&
        !value.memories.some(
          (m: Memory) =>
            m.id === d.editingId &&
            m.attachments.some((old) => old.id === a.id && old.uri === a.uri),
        )
      )
        throw new Error('草稿附件编号冲突。');
  }
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
      (i.model !== undefined && !str(i.model, 300)) ||
      (i.counterSourceIds !== undefined &&
        (!Array.isArray(i.counterSourceIds) ||
          !i.counterSourceIds.every((id: string) => ids.has(id)))) ||
      (i.changeNote !== undefined && !str(i.changeNote, 2000))
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
    .slice(0, 3)
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
    counterSourceIds: Array.isArray(x.counterSourceIds)
      ? [...new Set<string>(x.counterSourceIds.filter((id: string) => allowed.has(id)))]
      : [],
    changeNote: str(x.changeNote, 2000) ? x.changeNote : '',
    model,
    createdAt: new Date().toISOString(),
    history: [],
  }));
}
