import React from 'react';
import { confirmAction } from './dialogs';
export { confirmAction } from './dialogs';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { memoryText, type Attachment, type Memory } from './core';
import { Icon, IconButton, ScalePressable } from './ui';
import { useTheme } from './theme';
import { useStyles } from './styles';
export const pad = (n: number) => String(n).padStart(2, '0');
export const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};
export const timeLabel = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const duration = (ms = 0) =>
  `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}`;
export function AudioClip({
  attachment,
  editable = false,
  onTranscriptChange,
}: {
  attachment: Attachment;
  editable?: boolean;
  onTranscriptChange?: (t: NonNullable<Attachment['transcript']>) => void;
}) {
  const { C } = useTheme();
  const s = useStyles();
  const player = useAudioPlayer(attachment.uri);
  const state = useAudioPlayerStatus(player);
  return (
    <View>
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel={state.playing ? '暂停录音' : '播放录音'}
        onPress={async () => {
          try {
            if (state.playing) player.pause();
            else {
              await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
              if (state.didJustFinish) await player.seekTo(0);
              player.play();
            }
          } catch {
            void confirmAction('无法播放', '录音文件可能不可用。', '知道了');
          }
        }}
        style={s.audio}
      >
        <Icon name={state.playing ? 'pause' : 'play'} size={18} />
        <View style={{ flex: 1 }}>
          <Text style={s.small}>语音记录</Text>
          <View style={s.audioLine} />
        </View>
        <Text style={s.meta}>
          {state.playing ? duration(state.currentTime * 1000) : duration(attachment.duration)}
        </Text>
      </ScalePressable>
      {attachment.transcript && (
        <View>
          <Text style={s.footnote}>录音转写{editable ? ' · 可校正' : ''}</Text>
          {attachment.transcript.segments.length ? (
            attachment.transcript.segments.map((segment, index) => (
              <View key={index}>
                <ScalePressable
                  accessibilityRole="button"
                  accessibilityLabel={`从 ${duration(segment.start * 1000)} 播放`}
                  onPress={async () => {
                    try {
                      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
                      await player.seekTo(segment.start);
                      player.play();
                    } catch {
                      void confirmAction('无法播放', '录音文件可能不可用。', '知道了');
                    }
                  }}
                >
                  <Text style={[s.small, { color: C.accent }]}>
                    {duration(segment.start * 1000)} ▶
                  </Text>
                </ScalePressable>
                {editable ? (
                  <TextInput
                    accessibilityLabel={`转写片段 ${index + 1}`}
                    multiline
                    style={s.field}
                    value={segment.text}
                    onChangeText={(text) => {
                      const segments = attachment.transcript!.segments.map((s, n) =>
                        n === index ? { ...s, text } : s,
                      );
                      onTranscriptChange?.({
                        text: segments.map((s) => s.text).join('\n'),
                        segments,
                      });
                    }}
                  />
                ) : (
                  <Text selectable style={s.small}>
                    {segment.text}
                  </Text>
                )}
              </View>
            ))
          ) : editable ? (
            <TextInput
              accessibilityLabel="转写文字"
              multiline
              style={s.field}
              value={attachment.transcript.text}
              onChangeText={(text) => onTranscriptChange?.({ text, segments: [] })}
            />
          ) : (
            <Text selectable style={s.small}>
              {attachment.transcript.text}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
export function MemoryRow({ memory: m, onPress, query = '' }: { memory: Memory; onPress: () => void; query?: string }) {
  const { C } = useTheme();
  const s = useStyles();
  const original = memoryText(m) || '一条附件记录';
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const positions = terms.map(t => original.toLocaleLowerCase().indexOf(t)).filter(n=>n>=0);
  const start = positions.length ? Math.max(0, Math.min(...positions) - 24) : 0;
  const excerpt = (start ? '…' : '') + original.slice(start, start + 220) + (original.length > start + 220 ? '…' : '');
  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={`打开记录：${m.text || m.attachments.find((a) => a.transcript)?.transcript?.text || '语音记录'}`}
      onPress={onPress}
      style={s.memory}
    >
      <View style={s.memoryDate}>
        <Text style={s.day}>{pad(new Date(m.createdAt).getDate())}</Text>
        <Text style={s.meta}>{new Date(m.createdAt).getMonth() + 1}月</Text>
      </View>
      <View style={s.memoryContent}>
        <View style={s.memoryMeta}>
          <Text style={s.meta}>
            {timeLabel(m.createdAt)} · {m.category}
          </Text>
          {m.starred && <Icon name="star" size={13} color={C.accent} />}
        </View>
        <Text numberOfLines={4} style={s.memoryText}>
          {excerpt}
        </Text>
        {m.attachments.some((a) => a.kind === 'photo') && (
          <Image
            source={{ uri: m.attachments.find((a) => a.kind === 'photo')!.uri }}
            style={s.previewPhoto}
          />
        )}
        <View style={s.inline}>
          {m.attachments.some((a) => a.kind === 'audio') && (
            <>
              <Icon name="mic" size={14} color={C.muted} />
              <Text style={s.meta}>
                {duration(m.attachments.find((a) => a.kind === 'audio')?.duration)}
              </Text>
            </>
          )}
        </View>
      </View>
    </ScalePressable>
  );
}
export function Sheet({
  visible,
  title,
  onClose,
  children,
  feedback,
  footer,
  scrollPosition = 0,
  onScrollPositionChange,
}: {
  footer?: React.ReactNode;
  feedback?: string;
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  scrollPosition?: number;
  onScrollPositionChange?: (position: number) => void;
}) {
  const { C } = useTheme();
  const s = useStyles();
  const scrollRef = React.useRef<ScrollView>(null);
  const layout = React.useRef({ contentHeight: 0, viewportHeight: 0 });
  const restoreOffset = React.useRef<number | null>(null);
  const restoringTo = React.useRef<number | null>(null);
  const visibleRef = React.useRef(visible);
  visibleRef.current = visible;
  const tryRestore = () => {
    const requested = restoreOffset.current;
    const { contentHeight, viewportHeight } = layout.current;
    if (requested === null || !visibleRef.current || !viewportHeight || !contentHeight) return;
    const y = Math.min(requested, Math.max(0, contentHeight - viewportHeight));
    restoringTo.current = y;
    scrollRef.current?.scrollTo({ x: 0, y, animated: false });
  };
  React.useLayoutEffect(() => {
    if (!visible) {
      restoreOffset.current = null;
      restoringTo.current = null;
      layout.current = { contentHeight: 0, viewportHeight: 0 };
      return;
    }
    restoreOffset.current = scrollPosition > 0 ? scrollPosition : null;
    restoringTo.current = null;
    if (restoreOffset.current === null) return;
    const frame = requestAnimationFrame(tryRestore);
    return () => cancelAnimationFrame(frame);
  }, [visible]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.root}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
          <View
            style={[
              s.sheetShell,
              {
                backgroundColor: C.paper,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                overflow: 'hidden',
              },
            ]}
          >
            <View style={s.sheetHeader}>
              <IconButton name="back" label="返回" onPress={onClose} />
              <Text style={[s.sectionTitle, { flex: 1, textAlign: 'center' }]}>{title}</Text>
              <View style={{ width: 46 }} />
            </View>
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1, minHeight: 0 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={s.sheetBody}
              scrollEventThrottle={32}
              onLayout={(event) => {
                if (!visibleRef.current) return;
                layout.current.viewportHeight = event.nativeEvent.layout.height;
                tryRestore();
              }}
              onContentSizeChange={(_width, height) => {
                if (!visibleRef.current) return;
                layout.current.contentHeight = height;
                tryRestore();
              }}
              onScroll={(event) => {
                if (!visibleRef.current) return;
                const position = Math.max(0, event.nativeEvent.contentOffset.y);
                if (restoreOffset.current !== null) {
                  if (restoringTo.current !== null && Math.abs(position - restoringTo.current) <= 2) {
                    restoreOffset.current = null;
                    restoringTo.current = null;
                    onScrollPositionChange?.(position);
                  }
                  return;
                }
                onScrollPositionChange?.(position);
              }}
              onTouchStart={() => {
                if (restoreOffset.current === null) return;
                restoreOffset.current = null;
                restoringTo.current = null;
              }}
            >
              {children}
            </ScrollView>
            {!!footer && <View style={s.sheetFooter}>{footer}</View>}
            {!!feedback && (
              <View accessibilityLiveRegion="polite" style={[s.feedback, { marginHorizontal: 20 }]}>
                <Text style={s.small}>{feedback}</Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
}) {
  const { C } = useTheme();
  const s = useStyles();
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.meta}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        style={s.field}
      />
    </View>
  );
}
