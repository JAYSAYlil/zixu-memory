import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { type Attachment } from './core';
import { attachmentSize, openAttachment } from './files';
import { Button } from './ui';
import { useStyles } from './styles';
export const bytesLabel = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1048576
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1048576).toFixed(1)} MB`;
export function AttachmentInfo({ attachment }: { attachment: Attachment }) {
  const s = useStyles();
  const [size, setSize] = useState<number>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    attachmentSize(attachment)
      .then((n) => active && setSize(n))
      .catch(() => active && setError('文件暂时不可用'));
    return () => {
      active = false;
    };
  }, [attachment.uri]);
  return (
    <View style={{ gap: 8, marginVertical: 12 }}>
      <Text style={s.meta}>
        {attachment.name} · {size === undefined ? '读取大小…' : bytesLabel(size)}
        {attachment.kind === 'audio'
          ? ` · ${attachment.transcript ? '已转写，可在编辑中校正' : '尚未转写，可在编辑中转写或重试'}`
          : ''}
      </Text>
      <Button
        compact
        label="打开或分享附件"
        onPress={() => {
          setError('');
          void openAttachment(attachment).catch((e) => setError(e.message));
        }}
      />
      {!!error && <Text style={s.footnote}>{error}</Text>}
    </View>
  );
}
