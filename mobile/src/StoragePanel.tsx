import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { allAttachments, type Attachment } from './core';
import { snapshot, mutate } from './store';
import { attachmentSize, deleteFiles } from './files';
import { bytesLabel } from './AttachmentInfo';
import { Button } from './ui';
import { useStyles } from './styles';
import { confirmAction } from './dialogs';

export function StoragePanel({
  disabled,
  run,
}: {
  disabled: boolean;
  run: (label: string, job: () => Promise<void>) => Promise<unknown>;
}) {
  const s = useStyles();
  const [rows, setRows] = useState<{ a: Attachment; size: number }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [limit, setLimit] = useState(20);
  async function refresh() {
    const result = [];
    for (const a of allAttachments(snapshot())) result.push({ a, size: await attachmentSize(a) });
    setRows(result.sort((a, b) => b.size - a.size));
    setLoaded(true);
  }
  return (
    <View style={s.settingsGroup}>
      <Text style={s.sectionTitle}>附件空间</Text>
      <Text style={s.description}>
        按大小查看照片、录音和文件。移除附件会保留记录文字，并提醒你重新核对依赖该记录的认识。
      </Text>
      <Button
        label={loaded ? '刷新空间统计' : '查看空间占用'}
        disabled={disabled}
        onPress={() => void run('统计空间中', refresh)}
      />
      {loaded && (
        <>
          <Text style={s.footnote}>
            {(['photo', 'audio', 'file'] as const)
              .map(
                (kind, n) =>
                  `${['照片', '录音', '文件'][n]} ${bytesLabel(rows.filter((r) => r.a.kind === kind).reduce((sum, r) => sum + r.size, 0))}`,
              )
              .join(' · ')}
          </Text>
          <Text style={s.footnote}>
            这里统计当前记录和草稿引用的附件，不含数据库、应用本身及恢复保护副本。受恢复保护的文件可能稍后才释放空间。
          </Text>
          {rows.slice(0, limit).map(({ a, size }) => (
            <View key={a.id} style={{ marginTop: 16, gap: 8 }}>
              <Text style={s.small}>
                {a.name} · {bytesLabel(size)}
              </Text>
              <Text numberOfLines={2} style={s.meta}>
                {snapshot().memories.find((m) => m.attachments.some((x) => x.id === a.id))?.text ||
                  '草稿附件'}
              </Text>
              <Button
                compact
                label={`移除附件 ${a.name}`}
                disabled={disabled}
                onPress={() =>
                  void run('移除附件中', async () => {
                    if (
                      !(await confirmAction(
                        '移除这个附件？',
                        `${a.name}\n${bytesLabel(size)}\n会从所有引用它的记录和草稿移除。文字保留，已导出的备份不会改变。`,
                        '移除',
                      ))
                    )
                      return;
                    await mutate((state) => {
                      const affected = new Set(
                        state.memories
                          .filter((m) => m.attachments.some((x) => x.id === a.id))
                          .map((m) => m.id),
                      );
                      return {
                        ...state,
                        memories: state.memories.map((m) =>
                          affected.has(m.id)
                            ? {
                                ...m,
                                updatedAt: new Date().toISOString(),
                                attachments: m.attachments.filter((x) => x.id !== a.id),
                              }
                            : m,
                        ),
                        composerDraft: state.composerDraft
                          ? {
                              ...state.composerDraft,
                              attachments: state.composerDraft.attachments.filter(
                                (x) => x.id !== a.id,
                              ),
                            }
                          : undefined,
                        insights: state.insights.map((i) =>
                          [...i.sourceIds, ...(i.counterSourceIds || [])].some((id) =>
                            affected.has(id),
                          )
                            ? { ...i, sourceChanged: true }
                            : i,
                        ),
                      };
                    });
                    await deleteFiles([a]);
                    await refresh();
                  })
                }
              />
            </View>
          ))}
          {rows.length > limit && (
            <Button label="查看更多附件" onPress={() => setLimit((n) => n + 20)} />
          )}
        </>
      )}
    </View>
  );
}
