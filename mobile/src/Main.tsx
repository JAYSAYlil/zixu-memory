import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import {
  categories,
  uid,
  removeMemory,
  reviseMemory,
  searchMemories,
  recallCandidates,
  endpoint,
  memoryText,
  scopedMemories,
  observationCandidates,
  importSummary,
  allAttachments,
  type Draft,
  type Memory,
  type Insight,
  type Library,
  type ModelConfig,
  type Attachment,
} from './core';
import { initialize, mutate, snapshot, useLibrary } from './store';
import {
  readConfig,
  writeConfig,
  readPreference,
  writePreference,
  saveRecovery,
  readRecovery,
} from './persistence';
import {
  keepFile,
  deleteFiles,
  exportLibrary,
  chooseImport,
  exportSelf,
  cleanupOrphans,
} from './files';
import { transcribe } from './transcribe';
import { BackupPanel } from './BackupPanel';
import { AttachmentInfo } from './AttachmentInfo';
import { StoragePanel } from './StoragePanel';
import { Welcome } from './Welcome';
import appConfig from '../app.json';
import { observe, recall, testConnection, askSelf } from './ai';
import { selfSkill, confirmedSelf, aiProfile } from './self';
import { demoLibrary } from './demo';
import { Icon, IconButton, Button, Empty, ScalePressable } from './ui';
import { DialogHost } from './dialogs';
import { ScopeSheet, rangeLabel } from './ScopeSheet';
import { useStyles } from './styles';
import { useTheme } from './theme';
import { providers, providerId, defaultConfig } from './providers';
import {
  pad,
  dayLabel,
  timeLabel,
  duration,
  confirmAction,
  AudioClip,
  MemoryRow,
  Sheet,
  Field,
} from './components';
import { accentNames, accentOrder, accentPalettes, inkOn } from './palette';

const tabOrder = ['record', 'recall', 'profile'] as const;

export default function Main() {
  const { C, dark, mode, setMode, accent, setAccent } = useTheme();
  const s = useStyles();
  const stored = useLibrary();
  const [demo, setDemo] = useState<Library | null>(null);
  const data = demo || stored;
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<'record' | 'recall' | 'profile'>('record');
  const [settings, setSettings] = useState(false);
  const settingsScrollPosition = useRef(0);
  const [composer, setComposer] = useState(false);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('日常');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const sessionFiles = useRef<Attachment[]>([]);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const [draftStatus, setDraftStatus] = useState('');
  const request = useRef<AbortController | null>(null);
  const [requestStage, setRequestStage] = useState('');
  const [scopeFrom, setScopeFrom] = useState('');
  const [scopeTo, setScopeTo] = useState('');
  const [scopeCategory, setScopeCategory] = useState('全部');
  const [scopeIds, setScopeIds] = useState<string[]>([]);
  const [scopePicker, setScopePicker] = useState(false);
  const [speechConfig, setSpeechConfig] = useState<ModelConfig>({
    baseUrl: '',
    model: '',
    key: '',
  });
  const [showSelfBasis, setShowSelfBasis] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [showConfirmed, setShowConfirmed] = useState(true);
  const [exportPicker, setExportPicker] = useState(false);
  const [exportSel, setExportSel] = useState<string[]>([]);
  const [showSources, setShowSources] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [profileEditor, setProfileEditor] = useState<Insight | null | 'new'>(null);
  const [profileText, setProfileText] = useState('');
  const [selfQuestion, setSelfQuestion] = useState('');
  const [selfAnswer, setSelfAnswer] = useState('');
  const [transcriptionErrors, setTranscriptionErrors] = useState<Record<string, string>>({});
  const [selfBasis, setSelfBasis] = useState('');
  const [selfModel, setSelfModel] = useState('');
  const [exportPreview, setExportPreview] = useState('');
  const [filter, setFilter] = useState('全部');
  const [query, setQuery] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [answerSources, setAnswerSources] = useState<Memory[]>([]);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [notice, setNotice] = useState('');
  const [config, setConfig] = useState<ModelConfig>({
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    key: '',
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recordingSession, setRecordingSession] = useState(false);
  const [provider, setProvider] = useState('deepseek');
  const [connection, setConnection] = useState<{ ok: boolean; text: string } | null>(null);
  const [configFeedback, setConfigFeedback] = useState('');
  const providerCache = useRef<Record<string, ModelConfig>>({});
  const recordingBusy = useRef(false);
  const saving = useRef(false);
  const operationBusy = useRef(false);
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    directory: 'document',
    isMeteringEnabled: true,
  });
  const recording = useAudioRecorderState(recorder, 150);
  // 三个页面常驻横向分页器：切换由原生滚动驱动（跟手、吸附，无逐帧 JS 开销），
  // 底部导航与系统返回通过原生 scrollTo 平滑翻页，避免整页重挂载造成的掉帧。
  const pagerRef = useRef<ScrollView>(null);
  const windowWidth = useWindowDimensions().width;
  const pagerWidth = Math.min(windowWidth, 620);
  // 色块行可用宽度：页边距 20×2 与设置卡片内边距 16×2 之后，容纳 8 个色块与 7 道 4 点间隙。
  const accentSwatch = Math.min(28, Math.floor((pagerWidth - 72 - 28) / 8));
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const switchTab = (next: (typeof tabOrder)[number]) => {
    if (next === tabRef.current) return;
    setTab(next);
    pagerRef.current?.scrollTo({ x: tabOrder.indexOf(next) * pagerWidth, animated: true });
  };
  const today = new Date();
  const selected = data.memories.find((m) => m.id === detail);
  const update = async (fn: (state: Library) => Library) => {
    if (demo) setDemo((previous) => fn(previous!));
    else await mutate(fn);
  };
  const ping = (message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 2600);
  };
  const openDetail = (id: string) => {
    setDetail(id);
    setShowHistory(false);
  };
  const run = async (label: string, fn: () => Promise<void>) => {
    if (operationBusy.current) return;
    operationBusy.current = true;
    request.current = new AbortController();
    try {
      // Start browser APIs that require a fresh user gesture before rendering busy state.
      const operation = fn();
      setBusy(label);
      await operation;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '操作没有完成，请重试。');
    } finally {
      operationBusy.current = false;
      setBusy('');
      setRequestStage('');
      request.current = null;
    }
  };
  useEffect(() => {
    void initialize()
      .then(async () => {
        setReady(true);
        void cleanupOrphans(snapshot()).catch(() => {});
        try {
          const speech = await readPreference('speech');
          if (speech) setSpeechConfig(JSON.parse(speech));
          const active = await readConfig();
          const id = (await readPreference('active-provider')) || providerId(active);
          const saved = await readPreference(`provider-${id}`);
          const restored: ModelConfig = saved ? JSON.parse(saved) : active;
          setProvider(id);
          setConfig(restored);
          providerCache.current[id] = restored;
        } catch {
          setNotice('模型设置未能读取，请重新填写。');
        }
      })
      .catch((e) => setLoadError(String(e)));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const requestOptions = () => ({ signal: request.current?.signal, onStage: setRequestStage });
  async function flushDraft() {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = null;
    const draft = draftRef.current;
    if (!draft) return;
    await update((d) => ({
      ...d,
      draft: draft.editingId ? d.draft : draft.text,
      composerDraft:
        draft.editingId || draft.text.trim() || draft.attachments.length ? draft : undefined,
    }));
    setDraftStatus('文字、分类和附件已保存为草稿');
  }
  useEffect(() => {
    if (!composer) return;
    draftRef.current = {
      text,
      category,
      attachments,
      editingId: editing || undefined,
      updatedAt: new Date().toISOString(),
    };
    setDraftStatus('正在保存草稿…');
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      void flushDraft().catch(() => setDraftStatus('草稿保存失败，请保持页面打开并重试'));
    }, 350);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [composer, text, category, attachments, editing]);
  function changeText(value: string) {
    setText(value);
  }
  async function openComposer(id?: string) {
    const draft = data.composerDraft;
    if (id && draft && draft.editingId !== id) {
      setNotice('请先继续并保存现有草稿，再修改其他记录。');
      return;
    }
    sessionFiles.current = [];
    const resume = !id || draft?.editingId === id ? draft : undefined;
    const m = id ? data.memories.find((x) => x.id === id) : undefined;
    setEditing(resume?.editingId || id || null);
    setText(resume?.text ?? m?.text ?? data.draft);
    setCategory(resume?.category || m?.category || '日常');
    setAttachments(resume?.attachments || m?.attachments || []);
    setComposer(true);
  }
  async function saveRecord(extra?: Attachment) {
    if (saving.current) return;
    saving.current = true;
    try {
      const files = extra ? [...attachments, extra] : attachments;
      if (!text.trim() && !files.length) return;
      await flushDraft();
      const now = new Date().toISOString();
      const retained = new Set(files.map((a) => a.id));
      const discarded = [
        ...(data.memories.find((m) => m.id === editing)?.attachments || []),
        ...sessionFiles.current,
      ].filter((a) => !retained.has(a.id));
      await update((d) =>
        editing
          ? { ...reviseMemory(d, editing, text.trim(), category, files), composerDraft: undefined }
          : {
              ...d,
              draft: '',
              composerDraft: undefined,
              memories: [
                {
                  id: uid(),
                  text: text.trim(),
                  category,
                  attachments: files,
                  starred: false,
                  createdAt: now,
                  updatedAt: now,
                  history: [],
                },
                ...d.memories,
              ],
            },
      );
      if (!demo) await deleteFiles(discarded);
      sessionFiles.current = [];
      draftRef.current = null;
      setComposer(false);
      setText('');
      setAttachments([]);
      setEditing(null);
      setAnswer('');
      setAnswerSources([]);
      ping('已保存到本机');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      saving.current = false;
    }
  }
  async function stopRecording() {
    if (recordingBusy.current) return;
    recordingBusy.current = true;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('录音没有生成文件，请重试。');
      const file = await keepFile(
        uri,
        'audio',
        Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
        recording.durationMillis,
      );
      sessionFiles.current.push(file);
      setAttachments((a) => [...a, file]);
      draftRef.current = {
        text,
        category,
        attachments: [...attachments, file],
        editingId: editing || undefined,
        updatedAt: new Date().toISOString(),
      };
      await flushDraft();
      setRecordingSession(false);
      ping('语音已加入，可以继续写字或添加照片');
      await setAudioModeAsync({ allowsRecording: false });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '录音未能保存，请重试。');
    } finally {
      recordingBusy.current = false;
    }
  }
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        if (recordingSession) void stopRecording();
        else void flushDraft().catch(() => setDraftStatus('草稿保存失败，请重试'));
      }
    });
    return () => sub.remove();
  }, [
    recordingSession,
    recording.isRecording,
    text,
    attachments,
    recording.durationMillis,
    category,
    editing,
  ]);
  async function toggleRecording() {
    if (recordingSession) {
      if (recording.isRecording) recorder.pause();
      else recorder.record();
      return;
    }
    if (recordingBusy.current) return;
    recordingBusy.current = true;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('需要麦克风权限才能录音。你仍可使用文字记录。');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordingSession(true);
    } finally {
      recordingBusy.current = false;
    }
  }
  async function transcribeClip(a: Attachment) {
    if (demo) throw new Error('示例模式不发送录音。');
    setTranscriptionErrors(errors => ({ ...errors, [a.id]: '' }));
    let result;
    try { result = await transcribe(speechConfig, a, requestOptions()); }
    catch (error) { setTranscriptionErrors(errors => ({...errors, [a.id]: error instanceof Error ? error.message : '转写未完成，录音已保留。'})); throw error; }
    setAttachments((items) =>
      items.map((item) => (item.id === a.id ? { ...item, transcript: result } : item)),
    );
    ping('转写已加入草稿，可校正文字后保存');
  }
  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      const a = result.assets[0];
      const file = await keepFile(a.uri, 'photo', a.mimeType || 'image/jpeg');
      sessionFiles.current.push(file);
      setAttachments((previous) => [...previous, file]);
      draftRef.current = {
        text,
        category,
        attachments: [...attachments, file],
        editingId: editing || undefined,
        updatedAt: new Date().toISOString(),
      };
      await flushDraft();
    }
  }
  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new Error('拍照需要相机权限。可以在系统设置中允许，也可以从相册添加照片。');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) {
      const a = result.assets[0];
      const file = await keepFile(a.uri, 'photo', a.mimeType || 'image/jpeg');
      sessionFiles.current.push(file);
      setAttachments((previous) => [...previous, file]);
      draftRef.current = {
        text,
        category,
        attachments: [...attachments, file],
        editingId: editing || undefined,
        updatedAt: new Date().toISOString(),
      };
      await flushDraft();
      ping('照片已加入记录');
    }
  }
  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const picked = result.assets[0];
    const file = await keepFile(picked.uri, 'file', picked.mimeType || 'application/octet-stream');
    file.name = picked.name || file.name;
    const next = [...attachments, file];
    sessionFiles.current.push(file);
    setAttachments(next);
    draftRef.current = {
      text,
      category,
      attachments: next,
      editingId: editing || undefined,
      updatedAt: new Date().toISOString(),
    };
    await flushDraft();
    ping(`已添加文件：${file.name}`);
  }
  async function closeComposer() {
    if (operationBusy.current || saving.current || recordingBusy.current) return;
    if (recordingSession) {
      await stopRecording();
      return;
    }
    try {
      await flushDraft();
    } catch {
      setNotice('草稿保存失败，请重试后再关闭。');
      return;
    }
    sessionFiles.current = [];
    draftRef.current = null;
    setComposer(false);
    setAttachments([]);
  }
  async function discardDraft() {
    if (recordingSession) throw new Error('请先完成录音。');
    if (
      !(await confirmAction(
        '放弃这份草稿？',
        '草稿中的修改和新增附件将移除，已经保存的记录保留。',
        '放弃草稿',
      ))
    )
      return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    await update((d) => ({ ...d, draft: editing ? d.draft : '', composerDraft: undefined }));
    const originals = new Set(data.memories.flatMap((m) => m.attachments).map((a) => a.id));
    if (!demo) await deleteFiles(attachments.filter((a) => !originals.has(a.id)));
    draftRef.current = null;
    sessionFiles.current = [];
    setComposer(false);
    setAttachments([]);
    setEditing(null);
  }
  async function consent(kind: string, sources: Memory[]) {
    if (demo) {
      setNotice('示例模式不会发送资料。退出示例后可以连接自己的模型。');
      return false;
    }
    if (!config.key) {
      setSettings(true);
      return false;
    }
    return true;
  }
  async function createObservations() {
    const sources = observationCandidates(
      scopedMemories(data.memories, {
        from: scopeFrom,
        to: scopeTo,
        category: scopeCategory,
        ids: scopeIds.length ? scopeIds : undefined,
      }),
    );
    if (sources.length < 2) {
      setNotice('至少留下两条文字经历，再试着找找它们之间的关联。');
      return;
    }
    if (!(await consent('整理待确认的观察', sources))) return;
    const result = await observe(config, sources, data.insights, requestOptions());
    await update((d) => ({
      ...d,
      insights: [
        ...result.filter((i) =>
          [...i.sourceIds, ...(i.counterSourceIds || [])].every((id) =>
            d.memories.some(
              (m) => m.id === id && memoryText(m) === memoryText(sources.find((x) => x.id === id)!),
            ),
          ),
        ),
        ...d.insights,
      ],
    }));
    ping(result.length ? `新增 ${result.length} 条待确认观察` : '这些记录暂不足以形成新的观察');
  }
  async function ask() {
    if (!question.trim()) return;
    const sources = recallCandidates(
      scopedMemories(data.memories, {
        from: scopeFrom,
        to: scopeTo,
        category: scopeCategory,
      }).filter((m) => memoryText(m).trim()),
      question,
    );
    if (!sources.length) {
      setAnswer('资料不足：没有找到与问题相关的文字经历。试试原文关键词或扩大时间范围。');
      setAnswerSources([]);
      return;
    }
    if (!(await consent('询问过去的我', sources))) return;
    setAnswer('');
    const basis = data;
    const result = await recall(config, question, sources, data.insights, requestOptions());
    if (!demo && (snapshot().memories !== basis.memories || snapshot().insights !== basis.insights))
      throw new Error('资料已变化，请重新提问。');
    setAnswerSources(sources);
    setShowSources(false);
    setAnswer(result);
  }
  async function saveProfile() {
    if (!profileText.trim()) return;
    const now = new Date().toISOString();
    await update((d) => ({
      ...d,
      insights:
        profileEditor === 'new'
          ? [
              {
                id: uid(),
                text: profileText.trim(),
                category: '关于我',
                status: 'confirmed',
                origin: 'self',
                sourceIds: [],
                createdAt: now,
                history: [],
              },
              ...d.insights,
            ]
          : d.insights.map((i) =>
              i.id === (profileEditor as Insight).id
                ? {
                    ...i,
                    text: profileText.trim(),
                    status: 'confirmed',
                    sourceChanged: false,
                    origin: i.sourceIds.length ? i.origin : 'self',
                    history: [...i.history, { text: i.text, at: now }],
                  }
                : i,
            ),
    }));
    setProfileEditor(null);
    setAnswer('');
    ping('已更新');
  }
  async function askMyself() {
    if (!selfQuestion.trim()) return;
    const profile = aiProfile(data.insights);
    if (!profile.length) throw new Error('先在下方补充自我认识，或确认从经历中整理出的观察。');
    const sources = recallCandidates(
      data.memories.filter((m) => memoryText(m).trim()),
      selfQuestion,
    ).slice(0, 10);
    if (!(await consent('询问自己', sources))) return;
    setSelfAnswer('');
    const basis = data;
    const result = await askSelf(
      config,
      selfQuestion.trim(),
      sources,
      data.insights,
      requestOptions(),
    );
    if (!demo && (snapshot().memories !== basis.memories || snapshot().insights !== basis.insights))
      throw new Error('资料已变化，请重新提问。');
    setSelfBasis(
      profile.map((i) => `【${i.id}】${i.category}：${i.text}`).join('\n\n') +
        '\n\n' +
        sources.map((m) => `【${m.id}】${memoryText(m).slice(0, 3000)}`).join('\n\n'),
    );
    setSelfModel(config.model);
    setSelfAnswer(result);
  }
  useEffect(() => {
    setSelfAnswer('');
    setSelfBasis('');
    setAnswer('');
    setAnswerSources([]);
  }, [data.insights, data.memories, demo]);
  async function restore(password = '') {
    const result = await chooseImport(password);
    if (!result) return;
    const yes = await confirmAction(
      '恢复这份备份？',
      importSummary(snapshot(), result.library),
      '恢复',
    );
    if (!yes) {
      await result.cleanup();
      return;
    }
    const old = snapshot();
    try {
      await saveRecovery(old);
      await mutate(() => result.library);
    } catch (e) {
      await result.cleanup();
      throw e;
    }
    setAnswer('');
    setAnswerSources([]);
    ping('记录与附件已恢复');
  }
  async function undoRestore() {
    const old = await readRecovery();
    if (!old) throw new Error('没有可恢复的本机快照。');
    if (
      !(await confirmAction(
        '撤销上次恢复？',
        '当前记忆将替换为上次恢复前的快照。当前内容会保存为新的快照。',
        '撤销恢复',
      ))
    )
      return;
    await saveRecovery(snapshot());
    await mutate(() => old);
    ping('已恢复本机快照');
  }
  function editConfig(patch: Partial<ModelConfig>) {
    setConfig((c) => ({ ...c, ...patch }));
    setConnection(null);
    setConfigFeedback('尚未保存');
  }
  async function persistProvider() {
    providerCache.current[provider] = { ...config };
    await writePreference(`provider-${provider}`, JSON.stringify(config));
    await writeConfig(config);
    await writePreference('active-provider', provider);
  }
  async function switchProvider(id: string) {
    if (id === provider) return;
    await persistProvider();
    const saved = await readPreference(`provider-${id}`);
    const next = providerCache.current[id] || (saved ? JSON.parse(saved) : defaultConfig(id));
    await writeConfig(next);
    await writePreference('active-provider', id);
    setConfig(next);
    setProvider(id);
    setConnection(null);
    setConfigFeedback('');
  }
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab !== 'record') {
        switchTab('record');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab]);
  const recallMemories = useMemo(
    () =>
      scopedMemories(data.memories, {
        from: scopeFrom,
        to: scopeTo,
        category: scopeCategory,
      }),
    [data.memories, scopeFrom, scopeTo, scopeCategory],
  );
  const searchResults = useMemo(
    () => searchMemories(recallMemories, query),
    [recallMemories, query],
  );
  const selfAsk = (
    <>
      <View style={s.askPanel}>
        <Text style={s.sectionTitle}>询问自己</Text>
        <Text style={s.description}>带着自己的经历和在意的事，想一想眼前的问题。</Text>
        <TextInput
          accessibilityLabel="询问自己的问题"
          multiline
          value={selfQuestion}
          onChangeText={setSelfQuestion}
          placeholder="面对这次选择，我可能更看重什么？"
          placeholderTextColor={C.muted}
          style={s.question}
          maxLength={5000}
        />
        <Button
          label={busy === '询问自己' ? '正在想一想…' : '听听自己的答案'}
          primary
          disabled={!!busy || !selfQuestion.trim() || !!demo}
          onPress={() => void run('询问自己', askMyself)}
        />
        <Text style={s.footnote}>
          参考 {aiProfile(data.insights).length} 条已确认的认识，帮你梳理思路。
        </Text>
        {!!selfAnswer && (
          <View style={s.answer}>
            <Text style={s.eyebrow}>基于本次资料的推演 · {selfModel}</Text>
            <Text selectable style={s.body}>
              {selfAnswer.split(/(【[^】]+】)/g).map((part, n) => {
                const id = part.startsWith('【') ? part.slice(1, -1) : '';
                const insight = data.insights.find((i) => i.id === id);
                const memory = data.memories.find((m) => m.id === id);
                return insight || memory ? (
                  <Text
                    key={n}
                    accessibilityRole="link"
                    style={{ color: C.accent }}
                    onPress={() => {
                      if (memory) openDetail(memory.id);
                      else if (insight) {
                        setProfileText(insight.text);
                        setProfileEditor(insight);
                      }
                    }}
                  >
                    {insight ? '〔已确认的认识〕' : '〔相关经历〕'}
                  </Text>
                ) : (
                  part
                );
              })}
            </Text>
            <Text style={s.footnote}>
              这个回答符合现在的你吗？补充后由你亲自保存，不会自动改变认识。
            </Text>
            <View style={[s.inline, { flexWrap: 'wrap', gap: 8, marginVertical: 12 }]}>
              {['符合我', '不太符合', '现在变了'].map((label) => (
                <Button
                  key={label}
                  compact
                  label={label}
                  disabled={!!demo}
                  onPress={() => {
                    setProfileText(
                      label === '符合我'
                        ? '我认同的部分是：'
                        : label === '现在变了'
                          ? '以前我在意的是……现在我更在意：'
                          : '这次回答不符合我的地方是……我的真实想法是：',
                    );
                    setProfileEditor('new');
                  }}
                />
              ))}
            </View>
            <Button
              compact
              label={showSelfBasis ? '收起参考资料' : '查看参考资料'}
              onPress={() => setShowSelfBasis((v) => !v)}
            />
            {showSelfBasis && (
              <Text selectable style={s.small}>
                {selfBasis}
              </Text>
            )}
          </View>
        )}
      </View>
    </>
  );

  if (!ready)
    return (
      <SafeAreaView style={s.root}>
        <View style={s.loading}>
          <Text style={s.logo}>自叙</Text>
          {loadError ? (
            <>
              <Text style={s.body}>本机记忆读取失败。为保护数据，未创建空库覆盖它。</Text>
              <Text selectable style={s.meta}>
                {loadError}
              </Text>
              <Button
                label="重试"
                onPress={() => {
                  setLoadError('');
                  void initialize()
                    .then(() => setReady(true))
                    .catch((e) => setLoadError(String(e)));
                }}
              />
            </>
          ) : (
            <ActivityIndicator color={C.accent} />
          )}
        </View>
      </SafeAreaView>
    );
  const shown = data.memories.filter(
    (m) => filter === '全部' || (filter === '收藏' ? m.starred : m.category === filter),
  );
  const pending = data.insights.filter((i) => i.status === 'pending');
  const confirmed = data.insights.filter((i) => i.status === 'confirmed');
  const exportable = confirmed.filter((i) => !i.sourceChanged);
  const shelved = data.insights.filter((i) => i.status === 'rejected');
  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={s.shell}>
        {demo && (
          <ScalePressable
            accessibilityRole="button"
            disabled={!!busy}
            onPress={() => {
              setDemo(null);
              setDetail(null);
              setAnswer('');
            }}
            style={s.demo}
          >
            <Text style={s.demoText}>示例内容 · 不属于你的记忆</Text>
            <Text style={s.demoText}>退出 ×</Text>
          </ScalePressable>
        )}
        <View style={s.top}>
          <View style={s.brand}>
            <View style={s.brandMark} />
            <Text style={s.brandText}>自叙</Text>
          </View>
          <IconButton round name="settings" label="设置" onPress={() => setSettings(true)} />
        </View>
        {!!requestStage && (
          <View style={s.feedback}>
            <Text accessibilityLiveRegion="polite" style={s.small}>
              {requestStage}
            </Text>
            <Button compact label="取消请求" onPress={() => request.current?.abort()} />
          </View>
        )}
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          scrollEnabled={Platform.OS !== 'web'}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={64}
          onScroll={(e) => {
            const idx = Math.max(
              0,
              Math.min(tabOrder.length - 1, Math.round(e.nativeEvent.contentOffset.x / pagerWidth)),
            );
            if (tabOrder[idx] !== tabRef.current) setTab(tabOrder[idx]);
          }}
          style={{ flex: 1 }}
        >
          {tabOrder.map((key) => (
            <View key={key} style={{ width: pagerWidth }} aria-hidden={tab !== key}>
              <FlatList<Memory>
                data={
                  key === 'record'
                    ? shown
                    : key === 'recall'
                      ? query.trim()
                        ? searchResults
                        : answer
                          ? []
                          : recallMemories
                      : []
                }
                keyExtractor={(m) => m.id}
                renderItem={({ item }) => (
                  <MemoryRow memory={item} query={key === 'recall' ? query : ''} onPress={() => openDetail(item.id)} />
                )}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={5}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.page}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                  key === 'record' ? (
                    <View style={s.endMark}>
                      <View style={s.shortLine} />
                      <Text style={s.footnote}>写到这里，也很好。</Text>
                    </View>
                  ) : null
                }
                ListHeaderComponent={
                  <>
                    {key === 'record' && (
                      <>
                        <View style={s.headingRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.eyebrow}>
                              {today.getFullYear()} / {pad(today.getMonth() + 1)}
                            </Text>
                            <Text style={s.heading}>日子，慢慢记。</Text>
                          </View>
                          <View style={s.dateStamp}>
                            <Text style={s.dateNumber}>{pad(today.getDate())}</Text>
                            <Text style={s.meta}>
                              {
                                [
                                  '星期日',
                                  '星期一',
                                  '星期二',
                                  '星期三',
                                  '星期四',
                                  '星期五',
                                  '星期六',
                                ][today.getDay()]
                              }
                            </Text>
                          </View>
                        </View>
                        <ScalePressable
                          accessibilityRole="button"
                          accessibilityLabel="记一条"
                          onPress={() => openComposer()}
                          style={s.capture}
                        >
                          <Text
                            numberOfLines={2}
                            style={[s.captureText, data.draft ? { color: C.ink } : null]}
                          >
                            {data.composerDraft?.text ||
                              data.draft ||
                              (data.composerDraft?.attachments.length
                                ? '继续上次的照片或语音草稿'
                                : '有什么想记下来的？')}
                          </Text>
                          <View style={s.captureBottom}>
                            <View style={s.inline}>
                              <Icon name="mic" size={18} color={C.muted} />
                              <Text style={s.meta}>
                                {data.draft || data.composerDraft
                                  ? '继续上次的草稿'
                                  : '文字、照片，或一段语音'}
                              </Text>
                            </View>
                            <View style={s.capturePlus}>
                              <Icon name="plus" size={19} color={C.onAccent} />
                            </View>
                          </View>
                        </ScalePressable>
                        <View style={s.sectionHead}>
                          <Text style={s.sectionTitle}>最近留下的</Text>
                          <Text style={s.meta}>{data.memories.length} 条记录</Text>
                        </View>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={s.filters}
                        >
                          {['全部', '收藏', ...categories].map((f) => (
                            <ScalePressable
                              key={f}
                              accessibilityRole="button"
                              accessibilityState={{ selected: filter === f }}
                              onPress={() => setFilter(f)}
                              style={[s.filter, filter === f && s.filterActive]}
                            >
                              <Text style={[s.filterText, filter === f && { color: C.ink }]}>
                                {f}
                              </Text>
                            </ScalePressable>
                          ))}
                        </ScrollView>
                        {!shown.length ? (
                          <>
                            <Empty
                              title={data.memories.length ? '这里还没有记录' : '从一件小事开始。'}
                              body={
                                data.memories.length
                                  ? '换个分类看看，或留下一条新的记录。'
                                  : '一句话也可以。先把经历留下来，之后再慢慢理解。'
                              }
                            />
                            {!data.memories.length && (
                              <Button label="先看看示例" onPress={() => setDemo(demoLibrary())} />
                            )}
                          </>
                        ) : null}
                      </>
                    )}
                    {key === 'recall' && (
                      <>
                        <Text style={s.eyebrow}>那些经历，还在这里</Text>
                        <Text style={s.heading}>回忆</Text>
                        <Button
                          compact
                          accessibilityLabel="设置时间与分类范围"
                          label={`${rangeLabel(scopeFrom, scopeTo)} · ${scopeCategory}`}
                          onPress={() => setScopePicker(true)}
                        />
                        <View style={s.search}>
                          <Icon name="search" size={19} color={C.muted} />
                          <TextInput
                            accessibilityLabel="搜索记忆"
                            placeholder="找一句话、一件事"
                            placeholderTextColor={C.muted}
                            value={query}
                            onChangeText={setQuery}
                            style={s.searchInput}
                          />
                        </View>
                        {query.trim() ? (
                          <>
                            <Text style={s.meta}>原文搜索 · {searchResults.length} 条</Text>

                            {!searchResults.length && (
                              <Empty
                                title="还没找到"
                                body="试试原文里出现过的词，中文短词也可以。"
                              />
                            )}
                          </>
                        ) : (
                          <>
                            <View style={s.askPanel}>
                              <Text style={s.sectionTitle}>问问过去的我</Text>
                              <Text style={s.description}>带着现在的问题，翻一翻过去的经历。</Text>
                              <TextInput
                                accessibilityLabel="回忆问题"
                                multiline
                                placeholder="我以前做重要选择时，最在意什么？"
                                placeholderTextColor={C.muted}
                                value={question}
                                onChangeText={setQuestion}
                                style={[s.question, { minHeight: 68, paddingBottom: 8 }]}
                              />
                              <Button
                                label={busy === '回忆中' ? '正在翻阅…' : '找找相关经历'}
                                icon="arrow"
                                primary
                                style={{ alignSelf: 'flex-start', marginTop: 16 }}
                                disabled={!!busy || !question.trim()}
                                onPress={() => void run('回忆中', ask)}
                              />
                            </View>
                            {answer ? (
                              <View style={s.answer}>
                                <Text style={s.eyebrow}>根据记录整理 · {config.model}</Text>
                                <Text selectable style={s.body}>
                                  {answer.split(/(\[\d+\])/g).map((part, n) =>
                                    /^\[\d+\]$/.test(part) ? (
                                      <Text
                                        key={n}
                                        accessibilityRole="link"
                                        style={{ color: C.accent }}
                                        onPress={() => {
                                          const m = answerSources[Number(part.slice(1, -1)) - 1];
                                          if (m) openDetail(m.id);
                                        }}
                                      >
                                        {part}
                                      </Text>
                                    ) : (
                                      part
                                    ),
                                  )}
                                </Text>
                                {!!answerSources.length && (
                                  <>
                                    <Button
                                      compact
                                      label={
                                        showSources
                                          ? '收起本次来源'
                                          : `查看本次来源（${answerSources.length}）`
                                      }
                                      onPress={() => setShowSources((v) => !v)}
                                    />
                                    {showSources &&
                                      answerSources.map((m, n) => (
                                        <ScalePressable
                                          accessibilityRole="button"
                                          key={m.id}
                                          onPress={() => openDetail(m.id)}
                                          style={s.source}
                                        >
                                          <Text style={s.sourceNumber}>[{n + 1}]</Text>
                                          <Text numberOfLines={2} style={s.sourceText}>
                                            {dayLabel(m.createdAt)} · {m.text}
                                          </Text>
                                        </ScalePressable>
                                      ))}
                                  </>
                                )}
                              </View>
                            ) : (
                              <>
                                <View style={s.sectionHead}>
                                  <Text style={s.sectionTitle}>时间里的片段</Text>
                                  <Text style={s.meta}>按记录时间</Text>
                                </View>
                                {recallMemories.length ? null : (
                                  <Empty
                                    title={
                                      data.memories.length
                                        ? '这个范围里还没有记录'
                                        : '过去，从今天开始积累。'
                                    }
                                    body={
                                      data.memories.length
                                        ? '可以换个日期或分类，再找找看。'
                                        : '你留下的记录会出现在这里，随时可以回来找。'
                                    }
                                  />
                                )}
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}
                    {key === 'profile' && (
                      <>
                        <Text style={s.eyebrow}>可以修正，也可以改变</Text>
                        <Text style={s.heading}>认识我</Text>
                        <Text style={s.profileIntro}>记下在意的事，也留一点改变的余地。</Text>
                        {selfAsk}
                        <Button
                          compact
                          accessibilityLabel="选择观察范围与经历"
                          label={`观察范围 · ${scopeIds.length ? `已选 ${scopeIds.length} 条` : rangeLabel(scopeFrom, scopeTo)}`}
                          onPress={() => setScopePicker(true)}
                        />
                        <Text style={s.footnote}>
                          从不同时期的经历里，看看自己的想法有哪些变化。
                        </Text>
                        <View style={s.actionRow}>
                          <Button
                            style={{ flexGrow: 1, flexBasis: 160 }}
                            label={busy === '整理中' ? '正在整理…' : '从经历里整理观察'}
                            disabled={!!busy || !!demo}
                            onPress={() => void run('整理中', createObservations)}
                          />
                          <Button
                            style={{ flexGrow: 1, flexBasis: 112 }}
                            label="自己写一条"
                            accessibilityLabel="补充自我认识"
                            disabled={!!busy || !!demo}
                            onPress={() => {
                              setProfileEditor('new');
                              setProfileText('');
                            }}
                          />
                        </View>
                        <Text style={s.footnote}>
                          整理出的观察需要你确认；自己写的认识会直接保存。
                        </Text>
                        <View style={[s.sectionHead, { marginTop: 20 }]}>
                          <Text style={s.sectionTitle}>待确认</Text>
                          <Text style={s.meta}>模型提出 · 你来判断</Text>
                        </View>
                        {pending.map((i) => (
                          <View key={i.id} style={s.pending}>
                            <Text style={s.eyebrow}>{i.category} / 待确认</Text>
                            <Text style={s.insightText}>{i.text}</Text>
                            {i.sourceIds.map((id) => {
                              const m = data.memories.find((x) => x.id === id);
                              return m ? (
                                <ScalePressable
                                  accessibilityRole="button"
                                  key={id}
                                  onPress={() => openDetail(id)}
                                  style={s.source}
                                >
                                  <Text numberOfLines={2} style={s.sourceText}>
                                    ↳ {dayLabel(m.createdAt)} · {m.text}
                                  </Text>
                                </ScalePressable>
                              ) : null;
                            })}
                            {!!i.changeNote && (
                              <Text style={s.footnote}>变化与局限：{i.changeNote}</Text>
                            )}
                            {!!i.counterSourceIds?.length && (
                              <View style={{ gap: 8, marginTop: 8, marginBottom: 10 }}>
                                {i.counterSourceIds.map((id) => {
                                  const m = data.memories.find((x) => x.id === id);
                                  return m ? (
                                    <ScalePressable
                                      accessibilityRole="button"
                                      key={id}
                                      onPress={() => openDetail(id)}
                                      style={[
                                        s.source,
                                        {
                                          backgroundColor: C.wash,
                                          borderRadius: 12,
                                          paddingHorizontal: 12,
                                        },
                                      ]}
                                    >
                                      <Text numberOfLines={2} style={s.sourceText}>
                                        ↳ 反例 · {dayLabel(m.createdAt)} ·{' '}
                                        {m.text ||
                                          (m.attachments.length
                                            ? `含 ${m.attachments.length} 个附件`
                                            : '无文字内容')}
                                      </Text>
                                    </ScalePressable>
                                  ) : null;
                                })}
                              </View>
                            )}
                            {i.sourceChanged && (
                              <Text style={s.footnote}>
                                引用的经历已修改或删除，请核对后再确认。
                              </Text>
                            )}
                            <Text style={[s.meta, { marginBottom: 12 }]}>由 {i.model} 整理</Text>
                            <View style={s.inline}>
                              <Button
                                compact
                                label="符合我"
                                icon="check"
                                onPress={() =>
                                  void run('确认中', async () => {
                                    await update((d) => ({
                                      ...d,
                                      insights: d.insights.map((x) =>
                                        x.id === i.id
                                          ? {
                                              ...x,
                                              status: 'confirmed',
                                              sourceChanged: false,
                                              origin: x.sourceIds.length ? x.origin : 'self',
                                            }
                                          : x,
                                      ),
                                    }));
                                    ping('已确认');
                                  })
                                }
                              />
                              <Button
                                compact
                                label="有些不同"
                                onPress={() => {
                                  setProfileEditor(i);
                                  setProfileText(i.text);
                                }}
                              />
                              <Button
                                compact
                                label="不符合"
                                onPress={() =>
                                  void run('更新中', async () => {
                                    await update((d) => ({
                                      ...d,
                                      insights: d.insights.map((x) =>
                                        x.id === i.id ? { ...x, status: 'rejected' } : x,
                                      ),
                                    }));
                                    ping('已搁置这条观察');
                                  })
                                }
                              />
                            </View>
                          </View>
                        ))}
                        {!pending.length && (
                          <Text style={s.description}>
                            还没有待确认的观察。可以从上方的经历里整理，也可以自己写一条。
                          </Text>
                        )}
                        <ScalePressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded: showConfirmed }}
                          onPress={() => setShowConfirmed((v) => !v)}
                          style={[s.sectionHead, { marginTop: 20 }]}
                        >
                          <Text style={s.sectionTitle}>已确认</Text>
                          <View style={s.inline}>
                            <Text style={s.meta}>{confirmed.length} 条</Text>
                            <View
                              style={{ transform: [{ rotate: showConfirmed ? '0deg' : '-90deg' }] }}
                            >
                              <Icon name="chevron" size={16} color={C.muted} />
                            </View>
                          </View>
                        </ScalePressable>
                        {!showConfirmed && !!confirmed.length && (
                          <Text numberOfLines={1} style={s.description}>
                            {confirmed[0].text}
                          </Text>
                        )}
                        {!confirmed.length ? (
                          <Empty
                            title="先由你来介绍自己。"
                            body="在意的事、喜欢的生活、做事的习惯，都可以写。"
                          />
                        ) : showConfirmed ? (
                          confirmed.map((i, n) => (
                            <View
                              key={i.id}
                              style={[s.insight, n < confirmed.length - 1 && s.insightLine]}
                            >
                              <View style={s.inline}>
                                <View style={s.dot} />
                                <Text style={s.eyebrow}>{i.category}</Text>
                              </View>
                              <Text style={s.insightText}>{i.text}</Text>
                              {!!i.changeNote && (
                                <Text style={s.footnote}>变化与局限：{i.changeNote}</Text>
                              )}
                              {!!i.counterSourceIds?.length && (
                                <View style={{ gap: 8, marginTop: 8, marginBottom: 10 }}>
                                  {i.counterSourceIds.map((id) => {
                                    const m = data.memories.find((x) => x.id === id);
                                    return m ? (
                                      <ScalePressable
                                        accessibilityRole="button"
                                        key={id}
                                        onPress={() => openDetail(id)}
                                        style={[
                                          s.source,
                                          {
                                            backgroundColor: C.wash,
                                            borderRadius: 12,
                                            paddingHorizontal: 12,
                                          },
                                        ]}
                                      >
                                        <Text numberOfLines={2} style={s.sourceText}>
                                          ↳ 反例 · {dayLabel(m.createdAt)} ·{' '}
                                          {m.text ||
                                            (m.attachments.length
                                              ? `含 ${m.attachments.length} 个附件`
                                              : '无文字内容')}
                                        </Text>
                                      </ScalePressable>
                                    ) : null;
                                  })}
                                </View>
                              )}
                              {i.sourceChanged && (
                                <Text style={s.footnote}>
                                  引用的经历已修改或删除。这条认识仍保留，你可以点“修改”核对并重新确认。
                                </Text>
                              )}
                              <Text style={s.meta}>
                                {i.origin === 'self' ? '自己写的' : '已由你确认'} ·{' '}
                                {dayLabel(i.createdAt)}
                              </Text>
                              {i.sourceIds.map((id) => {
                                const m = data.memories.find((x) => x.id === id);
                                return m ? (
                                  <ScalePressable
                                    key={id}
                                    onPress={() => openDetail(id)}
                                    style={s.source}
                                  >
                                    <Text numberOfLines={1} style={s.sourceText}>
                                      ↳ {m.text}
                                    </Text>
                                  </ScalePressable>
                                ) : null;
                              })}
                              <View style={[s.inline, { marginTop: 12 }]}>
                                <Button
                                  compact
                                  label="修改"
                                  onPress={() => {
                                    setProfileEditor(i);
                                    setProfileText(i.text);
                                  }}
                                />
                                <Button
                                  compact
                                  label="移除"
                                  onPress={() =>
                                    void run('更新中', async () => {
                                      if (
                                        await confirmAction(
                                          '移除这条认识？',
                                          '这不会删除你的原始经历。',
                                          '移除',
                                        )
                                      )
                                        await update((d) => ({
                                          ...d,
                                          insights: d.insights.filter((x) => x.id !== i.id),
                                        }));
                                      setAnswer('');
                                    })
                                  }
                                />
                              </View>
                            </View>
                          ))
                        ) : null}
                        {!!shelved.length && (
                          <View style={{ marginTop: 8 }}>
                            <Button
                              label={
                                showRejected
                                  ? '收起已搁置认识'
                                  : `已搁置的认识（${shelved.length}）`
                              }
                              onPress={() => setShowRejected((v) => !v)}
                            />
                            {showRejected &&
                              shelved.map((i, n) => (
                                <View
                                  key={i.id}
                                  style={[s.insight, n < shelved.length - 1 && s.insightLine]}
                                >
                                  <Text style={s.meta}>此前标记为“不符合” · 未删除</Text>
                                  <Text style={s.insightText}>{i.text}</Text>
                                  <View style={[s.inline, { marginTop: 12 }]}>
                                    <Button
                                      compact
                                      label="重新考虑"
                                      disabled={!!busy}
                                      onPress={() =>
                                        void run('更新中', async () => {
                                          await update((d) => ({
                                            ...d,
                                            insights: d.insights.map((x) =>
                                              x.id === i.id ? { ...x, status: 'pending' } : x,
                                            ),
                                          }));
                                          ping('已移回待确认');
                                        })
                                      }
                                    />
                                    <Button
                                      compact
                                      label="删除"
                                      disabled={!!busy}
                                      onPress={() =>
                                        void run('更新中', async () => {
                                          if (
                                            await confirmAction(
                                              '删除这条认识？',
                                              '这条已搁置的认识将被移除，原始经历不受影响。',
                                              '删除',
                                            )
                                          )
                                            await update((d) => ({
                                              ...d,
                                              insights: d.insights.filter((x) => x.id !== i.id),
                                            }));
                                          ping('已删除');
                                        })
                                      }
                                    />
                                  </View>
                                </View>
                              ))}
                          </View>
                        )}
                        <View style={{ marginTop: 24 }}>
                          <Button
                            label="导出我的价值观"
                            icon="download"
                            disabled={!!busy || !exportable.length || !!demo}
                            onPress={() => {
                              setExportSel(exportable.map((i) => i.id));
                              setExportPicker(true);
                            }}
                          />
                        </View>
                        <Text style={s.footnote}>
                          待核对的认识需重新确认后才能导出。把已确认的认识带到其他
                          AI，可勾选要带走的条目，导出前可预览。
                        </Text>
                      </>
                    )}
                  </>
                }
              />
            </View>
          ))}
        </ScrollView>
        <BlurView
          intensity={dark ? 60 : 55}
          tint={dark ? 'dark' : 'light'}
          experimentalBlurMethod="dimezisBlurView"
          style={[
            s.navGlass,
            { borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(25,28,27,0.10)' },
          ]}
        >
          <View
            style={[
              s.nav,
              { backgroundColor: dark ? 'rgba(11,12,13,0.72)' : 'rgba(255,255,255,0.72)' },
            ]}
          >
            {(
              [
                { key: 'record', label: '记录', icon: 'write' },
                { key: 'recall', label: '回忆', icon: 'book' },
                { key: 'profile', label: '认识我', icon: 'person' },
              ] as const
            ).map((item) => (
              <ScalePressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: tab === item.key }}
                onPress={() => switchTab(item.key)}
                style={s.navItem}
              >
                <Icon name={item.icon} color={tab === item.key ? C.accent : C.muted} />
                <Text style={[s.navText, tab === item.key && { color: C.accent }]}>
                  {item.label}
                </Text>
              </ScalePressable>
            ))}
          </View>
        </BlurView>
      </View>
      {!!toast && (
        <View pointerEvents="none" style={s.toast}>
          <Icon name="check" color={C.paper} size={17} />
          <Text style={{ color: C.paper, fontSize: 14, flexShrink: 1 }}>{toast}</Text>
        </View>
      )}
      <Sheet
        feedback={toast}
        visible={composer}
        title={editing ? '修改记录' : '记一条'}
        onClose={() => void closeComposer()}
        footer={
          <View style={[s.inline, { justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }]}>
            <View style={s.inline}>
              {
                <>
                  {recordingSession ? (
                    <>
                      <Button
                        label={recording.isRecording ? '暂停' : '继续录音'}
                        onPress={() => void run('录音操作', toggleRecording)}
                        disabled={!!busy}
                      />
                      <Button
                        label="完成录音"
                        onPress={() => void run('录音操作', stopRecording)}
                        disabled={!!busy}
                      />
                    </>
                  ) : (
                    <IconButton
                      name="mic"
                      label="开始录音"
                      onPress={() => void run('录音操作', toggleRecording)}
                    />
                  )}
                  {!recordingSession && (
                    <IconButton
                      name="photo"
                      label="添加照片"
                      onPress={() => void run('选择照片', pickPhoto)}
                    />
                  )}
                  {!recordingSession && (
                    <IconButton
                      name="camera"
                      label="拍照"
                      onPress={() => void run('拍照', takePhoto)}
                    />
                  )}
                  {!recordingSession && (
                    <IconButton
                      name="upload"
                      label="添加文件"
                      onPress={() => void run('添加文件', pickFile)}
                    />
                  )}
                </>
              }
            </View>
            <Button
              label="保存"
              primary
              disabled={!!busy || recordingSession || (!text.trim() && !attachments.length)}
              icon="arrow"
              onPress={() => void run('保存中', () => saveRecord())}
            />
          </View>
        }
      >
        {!!requestStage && (
          <View style={s.feedback}>
            <Text accessibilityLiveRegion="polite" style={s.small}>
              {requestStage}
            </Text>
            <Button compact label="取消请求" onPress={() => request.current?.abort()} />
          </View>
        )}
        <Text style={s.eyebrow}>
          {today.getFullYear()}年{today.getMonth() + 1}月{today.getDate()}日 ·{' '}
          {timeLabel(today.toISOString())}
        </Text>
        <TextInput
          accessibilityLabel="记录内容"
          autoFocus
          multiline
          value={text}
          onChangeText={changeText}
          placeholder="从这里开始写…"
          placeholderTextColor={C.muted}
          style={s.editor}
          maxLength={30000}
        />
        {
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filters}
          >
            {categories.map((c) => (
              <ScalePressable
                key={c}
                accessibilityRole="button"
                accessibilityState={{ selected: category === c }}
                onPress={() => setCategory(c)}
                style={[s.category, category === c && { backgroundColor: C.wash }]}
              >
                <Text style={[s.small, category === c && { color: C.accent }]}>{c}</Text>
              </ScalePressable>
            ))}
          </ScrollView>
        }
        <View style={s.attachmentGrid}>
          {attachments
            .filter((a) => a.kind === 'photo')
            .map((a, n) => (
              <View key={a.id} style={s.attachmentTile}>
                <Image source={{ uri: a.uri }} style={s.attachmentImage} resizeMode="cover" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`移除照片 ${n + 1}`}
                  disabled={!!busy}
                  onPress={() => setAttachments((items) => items.filter((x) => x.id !== a.id))}
                  style={s.removeAttachment}
                >
                  <Icon name="close" size={16} color="#ffffff" />
                </Pressable>
              </View>
            ))}
        </View>
        {attachments
          .filter((a) => a.kind === 'audio')
          .map((a, n) => (
            <View key={a.id} style={s.audioAttachment}>
              <View style={{ flex: 1 }}>
                <AudioClip
                  attachment={a}
                  editable
                  onTranscriptChange={(transcript) =>
                    setAttachments((items) =>
                      items.map((item) => (item.id === a.id ? { ...item, transcript } : item)),
                    )
                  }
                />
                <Button
                  compact
                  label={transcriptionErrors[a.id] ? '重试转写' : a.transcript ? '重新转写' : '转写为文字'}
                  disabled={!!busy || recordingSession || !!demo}
                  onPress={() => void run('转写中', () => transcribeClip(a))}
                />
                {!!transcriptionErrors[a.id] && <Text style={s.footnote}>{transcriptionErrors[a.id]}</Text>}
              </View>
              <IconButton
                name="close"
                label={`移除录音 ${n + 1}`}
                onPress={() => {
                  if (!busy) setAttachments((items) => items.filter((x) => x.id !== a.id));
                }}
              />
            </View>
          ))}
        {attachments
          .filter((a) => a.kind === 'file')
          .map((a, n) => (
            <View key={a.id} style={s.fileAttachment}>
              <Icon name="upload" size={20} color={C.accent} />
              <Text numberOfLines={2} style={[s.small, { flex: 1 }]}>
                {a.name}
              </Text>
              <IconButton
                name="close"
                label={`移除文件 ${n + 1}`}
                onPress={() => setAttachments((items) => items.filter((x) => x.id !== a.id))}
              />
            </View>
          ))}
        {recordingSession && (
          <View style={s.recording}>
            <View style={[s.dot, { backgroundColor: C.accent }]} />
            <Text style={s.small}>
              {recording.isRecording ? '正在录音' : '已暂停'} {duration(recording.durationMillis)}
            </Text>
            <View
              style={{
                height: 6,
                width: Math.max(5, Math.min(80, ((recording.metering ?? -60) + 60) * 1.5)),
                backgroundColor: C.accent,
                borderRadius: 3,
              }}
            />
          </View>
        )}
        <Text accessibilityLiveRegion="polite" style={s.footnote}>
          {draftStatus}
        </Text>
        <Button
          compact
          label="放弃草稿"
          disabled={!!busy || recordingSession}
          onPress={() => void run('放弃草稿', discardDraft)}
        />
        {draftStatus.includes('失败') && (
          <Button compact label="重试保存草稿" onPress={() => void run('保存草稿', flushDraft)} />
        )}
        {editing && (
          <Text style={s.description}>
            原文历史和已有认识都会保留。修改文字后，相关认识会提示你重新核对。
          </Text>
        )}
        <Text style={s.footnote}>
          {recordingSession
            ? '完成录音后可继续补充文字和照片，再保存整条记录。切到后台会结束录音并加入附件。'
            : '可以写几句话，也可以留一张照片或一段录音。'}
        </Text>
      </Sheet>
      <Sheet
        feedback={toast}
        visible={!!selected && !composer}
        title="一条记录"
        onClose={() => setDetail(null)}
      >
        {selected && (
          <>
            <View style={s.sectionHead}>
              <Text style={s.eyebrow}>
                {dayLabel(selected.createdAt)} · {timeLabel(selected.createdAt)} /{' '}
                {selected.category}
              </Text>
              <IconButton
                name="star"
                label={selected.starred ? '取消收藏' : '收藏记录'}
                color={selected.starred ? C.accent : C.muted}
                onPress={() =>
                  void run('更新中', () =>
                    update((d) => ({
                      ...d,
                      memories: d.memories.map((m) =>
                        m.id === selected.id ? { ...m, starred: !m.starred } : m,
                      ),
                    })),
                  )
                }
              />
            </View>
            <Text selectable style={s.detailText}>
              {selected.text || '语音记录'}
            </Text>
            {selected.attachments.map((a) =>
              a.kind === 'photo' ? (
                <Image
                  key={a.id}
                  source={{ uri: a.uri }}
                  style={s.detailPhoto}
                  resizeMode="contain"
                />
              ) : a.kind === 'audio' ? (
                <AudioClip key={a.id} attachment={a} />
              ) : (
                <View key={a.id} style={s.fileAttachment}>
                  <Icon name="upload" color={C.accent} />
                  <Text selectable style={s.small}>
                    {a.name}
                  </Text>
                </View>
              ),
            )}
            {selected.attachments.map((a) => (
              <AttachmentInfo key={'info-' + a.id} attachment={a} />
            ))}
            {selected.history.length > 0 && (
              <View style={s.history}>
                <Button
                  compact
                  label={
                    showHistory ? '收起修改前的文字' : `修改前的文字（${selected.history.length}）`
                  }
                  onPress={() => setShowHistory((v) => !v)}
                />
                {showHistory &&
                  selected.history.map((h, n) => (
                    <View key={n} style={{ marginTop: 12 }}>
                      <Text style={s.meta}>
                        {dayLabel(h.at)} · {timeLabel(h.at)}
                      </Text>
                      <Text selectable style={s.description}>
                        {h.text}
                      </Text>
                    </View>
                  ))}
              </View>
            )}
            <View style={[s.inline, { marginTop: 30 }]}>
              <Button
                label="修改"
                onPress={() => {
                  const id = selected.id;
                  openComposer(id);
                }}
              />
              <Button
                label="删除"
                onPress={() =>
                  void run('删除中', async () => {
                    if (
                      !(await confirmAction(
                        '删除这条记录？',
                        '原文、附件和修订历史将移除。已有的个人认识会保留，并标记引用的经历已删除。',
                        '删除',
                      ))
                    )
                      return;
                    const files = selected.attachments;
                    await update((d) => removeMemory(d, selected.id));
                    if (!demo) await deleteFiles(files);
                    setDetail(null);
                    setAnswer('');
                    setAnswerSources([]);
                    ping('已删除');
                  })
                }
              />
            </View>
          </>
        )}
      </Sheet>
      <Sheet
        feedback={toast}
        visible={exportPicker}
        title="选择导出的认识"
        onClose={() => setExportPicker(false)}
      >
        <Text style={s.description}>勾选要带走的认识，未勾选的不会出现在导出文件里。</Text>
        <Button
          compact
          style={s.pickAll}
          label={exportSel.length === exportable.length ? '全不选' : '全选'}
          disabled={!exportable.length}
          onPress={() =>
            setExportSel(exportSel.length === exportable.length ? [] : exportable.map((i) => i.id))
          }
        />
        {exportable.map((i, n) => {
          const checked = exportSel.includes(i.id);
          return (
            <ScalePressable
              key={i.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() =>
                setExportSel((prev) =>
                  checked ? prev.filter((id) => id !== i.id) : [...prev, i.id],
                )
              }
              style={[s.pickRow, n < exportable.length - 1 && s.insightLine]}
            >
              <View
                style={[s.pickBox, checked && { backgroundColor: C.accent, borderColor: C.accent }]}
              >
                {checked && <Icon name="check" size={14} color={C.onAccent} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.eyebrow}>{i.category}</Text>
                <Text numberOfLines={2} style={s.small}>
                  {i.text}
                </Text>
              </View>
            </ScalePressable>
          );
        })}
        <Button
          primary
          label={`预览并导出（${exportSel.length}）`}
          disabled={!exportSel.length || !!busy}
          onPress={() =>
            void run('导出价值观', async () => {
              setExportPreview(selfSkill(data.insights, exportSel));
              setExportPicker(false);
            })
          }
        />
        <Text style={s.footnote}>
          导出的文件只包含勾选的认识，不包含原始记忆、照片、录音和 Key。
        </Text>
      </Sheet>
      <Sheet
        feedback={toast}
        visible={!!exportPreview}
        title="导出我的价值观"
        onClose={() => setExportPreview('')}
      >
        <Text style={s.description}>
          将文件上传到其他 AI
          的对话或项目资料中，请它依据这份认识回答。修改档案后，可重新导出最新版本。
        </Text>
        <Text selectable style={s.small}>
          {exportPreview}
        </Text>
        <Button
          label="保存或分享 SKILL.md"
          primary
          disabled={!!busy}
          onPress={() => void run('导出价值观', () => exportSelf(exportPreview))}
        />
      </Sheet>
      <Sheet
        feedback={toast}
        visible={!!profileEditor}
        title={profileEditor === 'new' ? '关于我' : '修正这条认识'}
        onClose={() => setProfileEditor(null)}
        footer={
          <Button
            primary
            label="保存并确认"
            disabled={!!busy || !profileText.trim()}
            onPress={() => void run('保存中', saveProfile)}
          />
        }
      >
        <Text style={s.description}>用你自己的说法。不用完整，也不必一直如此。</Text>
        <TextInput
          accessibilityLabel="自我认识"
          autoFocus
          multiline
          value={profileText}
          onChangeText={setProfileText}
          style={s.editor}
          placeholder="我在意的是…"
          placeholderTextColor={C.muted}
          maxLength={5000}
        />
        {profileEditor &&
          profileEditor !== 'new' &&
          profileEditor.history.map((h, n) => (
            <View key={n} style={s.history}>
              <Text style={s.meta}>之前的表述 · {dayLabel(h.at)}</Text>
              <Text style={s.description}>{h.text}</Text>
            </View>
          ))}
      </Sheet>
      <Sheet
        feedback={toast}
        visible={settings}
        scrollPosition={settingsScrollPosition.current}
        onScrollPositionChange={(position) => {
          settingsScrollPosition.current = position;
        }}
        title="设置"
        onClose={() =>
          void run('保存设置', async () => {
            await persistProvider();
            setSettings(false);
          })
        }
      >
        {!!requestStage && (
          <View style={s.feedback}>
            <Text accessibilityLiveRegion="polite" style={s.small}>
              {requestStage}
            </Text>
            <Button compact label="取消请求" onPress={() => request.current?.abort()} />
          </View>
        )}
        <Text style={s.eyebrow}>自叙 · {appConfig.expo.version}</Text>
        <Text style={s.settingsTitle}>按你的习惯来。</Text>
        <Text style={s.description}>记录留在本机，外观和整理方式由你选择。</Text>
        <View style={s.settingsGroup}>
          <Text style={s.sectionTitle}>外观</Text>
          <View style={s.inline}>
            {(
              [
                ['system', '跟随系统'],
                ['light', '浅色'],
                ['dark', '深色'],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                label={label}
                primary={mode === value}
                compact
                onPress={() => void run('保存外观', () => setMode(value))}
              />
            ))}
          </View>
          <View>
            <Text style={s.small}>主题色 · {accentNames[accent]}</Text>
            <View style={[s.accentRow, { marginTop: 6, gap: 4 }]}>
              {accentOrder.map((key) => {
                const swatch = accentPalettes[key][dark ? 'dark' : 'light'].accent;
                const selected = accent === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={accentNames[key]}
                    accessibilityState={{ selected }}
                    testID={`theme-accent-${key}`}
                    onPress={() => void run('保存主题色', () => setAccent(key))}
                    style={s.accentHit}
                  >
                    <View
                      style={{
                        width: accentSwatch,
                        height: accentSwatch,
                        borderRadius: accentSwatch,
                        backgroundColor: swatch,
                        borderWidth: selected ? 2.5 : 1,
                        borderColor: selected ? C.ink : C.line,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selected && <Icon name="check" size={15} color={inkOn(swatch)} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
        <View style={s.settingsGroup}>
          <Text style={s.sectionTitle}>连接自己的模型</Text>
          <Text style={s.small}>每个供应商分别记住地址、模型和 Key，切换后可以接着用。</Text>
          <View style={s.inline}>
            {providers.map((p) => (
              <Button
                key={p.id}
                compact
                label={p.name}
                primary={provider === p.id}
                disabled={!!busy}
                onPress={() => void run('切换供应商', () => switchProvider(p.id))}
              />
            ))}
          </View>
          <Field
            label="API 地址（以 /v1 等服务商路径结尾）"
            value={config.baseUrl}
            onChangeText={(baseUrl) =>
              editConfig({ baseUrl, key: baseUrl === config.baseUrl ? config.key : '' })
            }
            placeholder="https://你的服务商/v1"
          />
          <Field
            label="模型名称"
            value={config.model}
            onChangeText={(model) => editConfig({ model })}
            placeholder="服务商提供的模型 ID"
          />
          <Field
            label="API Key"
            value={config.key}
            onChangeText={(key) => editConfig({ key })}
            placeholder="填写你自己的 Key"
            secure
          />
          <Text style={s.footnote}>
            {Platform.OS === 'web'
              ? '网页预览的 Key 只存在当前页面内存；浏览器可能受跨域限制。'
              : 'Key 使用 Android 安全存储，不进入记忆备份。'}
            当前支持 Chat Completions 兼容接口。
          </Text>
          <View style={s.inline}>
            <Button
              label="保存设置"
              primary
              disabled={!!busy}
              onPress={() =>
                void run('保存中', async () => {
                  endpoint(config.baseUrl);
                  await persistProvider();
                  setConfigFeedback('已保存，切换供应商或重启后可继续使用。');
                })
              }
            />
            <Button
              label={busy === '连接测试' ? '测试中…' : '测试连接'}
              disabled={!!busy}
              onPress={() =>
                void run('连接测试', async () => {
                  setConnection(null);
                  try {
                    await testConnection(config, requestOptions());
                    setConnection({ ok: true, text: '连接成功，模型已正常响应。' });
                  } catch (e) {
                    setConnection({
                      ok: false,
                      text: e instanceof Error ? e.message : '连接失败，请检查网络后重试。',
                    });
                  }
                })
              }
            />
          </View>
          {!!configFeedback && (
            <Text accessibilityLiveRegion="polite" style={s.small}>
              {configFeedback}
            </Text>
          )}
          {!!connection && (
            <View accessibilityLiveRegion="polite" style={s.feedback}>
              <Text style={[s.sectionTitle, { color: connection.ok ? C.accentDark : C.error }]}>
                {connection.ok ? '连接成功' : '连接失败'}
              </Text>
              <Text selectable style={s.small}>
                {connection.text}
              </Text>
            </View>
          )}
          <Text style={s.footnote}>
            使用整理、问答和连接测试会调用所选服务商，费用由你的 API
            账户承担。整理和问答仅发送相关文字与档案，照片不会发送；语音转写仅上传你选择的录音到独立语音服务。每次使用不再弹窗。
          </Text>
        </View>
        <View style={s.settingsGroup}>
          <Text style={s.sectionTitle}>语音转写</Text>
          <Text style={s.footnote}>
            点击“转写为文字”时，才会将那段录音发送给语音服务商，费用由你的账户承担。支持分段的服务可以点时间回听。
          </Text>
          <Field
            label="语音 API 地址"
            value={speechConfig.baseUrl}
            onChangeText={(baseUrl) => setSpeechConfig((c) => ({ ...c, baseUrl, key: '' }))}
            placeholder="https://服务商/v1"
          />
          <Field
            label="语音模型"
            value={speechConfig.model}
            onChangeText={(model) => setSpeechConfig((c) => ({ ...c, model }))}
          />
          <Field
            label="语音 API Key"
            secure
            value={speechConfig.key}
            onChangeText={(key) => setSpeechConfig((c) => ({ ...c, key }))}
          />
          <Button
            label="保存语音设置"
            onPress={() =>
              void run('保存语音设置', async () => {
                endpoint(speechConfig.baseUrl);
                await writePreference('speech', JSON.stringify(speechConfig));
                ping('语音设置已保存');
              })
            }
          />
        </View>
        <View style={s.settingsGroup}>
          <Text style={s.sectionTitle}>数据与迁移</Text>
          <Text style={s.description}>
            备份包含原文、附件、个人档案与修订历史，不包含
            Key。建议使用加密备份；下方普通导出不加密。
          </Text>
          <BackupPanel disabled={!!busy || !!demo} run={run} restore={restore} />
          <View style={s.inline}>
            <Button
              label="导出完整备份"
              icon="download"
              disabled={!!busy || !!demo}
              onPress={() => void run('导出中', () => exportLibrary(snapshot()))}
            />
            <Button
              label="仅导出文字"
              disabled={!!busy || !!demo}
              onPress={() => void run('导出中', () => exportLibrary(snapshot(), true))}
            />
            <Button
              label="撤销上次恢复"
              disabled={!!busy || !!demo}
              onPress={() => void run('恢复中', undoRestore)}
            />
          </View>
          <Text style={s.footnote}>
            安卓完整备份按块读写，不再限制 30 MB；旧 JSON 仍可导入。网页预览备份仍限 50
            MB。还没有云同步；卸载前请先备份。
          </Text>
        </View>
        <StoragePanel disabled={!!busy || !!demo || composer} run={run} />
        <Button
          disabled={!!busy}
          label={demo ? '退出示例' : '浏览示例内容'}
          onPress={() => {
            setDemo(demo ? null : demoLibrary());
            setSettings(false);
            setAnswer('');
          }}
        />
        <Text style={s.footnote}>示例在独立的临时空间中，退出后不会混入你的记忆。</Text>
      </Sheet>
      {scopePicker && (
        <ScopeSheet
          initial={{ from: scopeFrom, to: scopeTo, category: scopeCategory, ids: scopeIds }}
          memories={data.memories}
          observation={tab === 'profile'}
          onClose={() => setScopePicker(false)}
          onApply={(scope) => {
            setScopeFrom(scope.from);
            setScopeTo(scope.to);
            setScopeCategory(scope.category);
            setScopeIds(scope.ids);
            setAnswer('');
            setScopePicker(false);
          }}
        />
      )}
      <DialogHost />
      <Welcome />
      <Modal
        visible={!!notice}
        transparent
        animationType="fade"
        onRequestClose={() => setNotice('')}
      >
        <View style={s.noticeOverlay}>
          <View style={s.notice}>
            <Text style={s.sectionTitle}>提示</Text>
            <Text selectable style={s.description}>
              {notice}
            </Text>
            <Button label="知道了" primary onPress={() => setNotice('')} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
