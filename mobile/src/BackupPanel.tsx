import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button } from './ui';
import { useStyles } from './styles';
import { useTheme } from './theme';
import { exportLibrary } from './files';
import { snapshot } from './store';
import { readPreference, writePreference } from './persistence';

export function BackupPanel({
  disabled,
  run,
  restore,
}: {
  disabled: boolean;
  run: (label: string, job: () => Promise<void>) => Promise<unknown>;
  restore: (password?: string) => Promise<void>;
}) {
  const s = useStyles(),
    { C } = useTheme();
  const [password, setPassword] = useState(''),
    [repeat, setRepeat] = useState('');
  const [last, setLast] = useState('');
  useEffect(() => {
    void readPreference('last-backup').then((v) => setLast(v || ''));
  }, []);
  return (
    <View style={{ gap: 12, marginBottom: 20 }}>
      <Text style={s.small}>加密备份</Text>
      <Text style={s.description}>
        设置至少 12 位密码。恢复时需要同一密码，软件不保存密码，也无法找回。恢复旧版普通备份可留空。
      </Text>
      <TextInput
        accessibilityLabel="备份密码"
        placeholder="备份密码"
        placeholderTextColor={C.muted}
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
        style={s.field}
      />
      <TextInput
        accessibilityLabel="确认备份密码"
        placeholder="再次输入密码（导出时）"
        placeholderTextColor={C.muted}
        secureTextEntry
        autoCapitalize="none"
        value={repeat}
        onChangeText={setRepeat}
        style={s.field}
      />
      <Button
        primary
        label="导出加密完整备份"
        disabled={disabled || password.length < 12 || password !== repeat}
        onPress={() =>
          void run('加密备份中', async () => {
            await exportLibrary(snapshot(), false, password);
            const time = new Date().toISOString();
            await writePreference('last-backup', time);
            setLast(time);
            setPassword('');
            setRepeat('');
          })
        }
      />
      <Button
        label="选择备份并恢复"
        disabled={disabled}
        onPress={() =>
          void run('检查备份中', async () => {
            await restore(password);
            setPassword('');
            setRepeat('');
          })
        }
      />
      <Text style={s.footnote}>
        {last ? `上次发起加密备份：${new Date(last).toLocaleString()}` : '还没有加密备份记录。'}{' '}
        分享后请确认文件已保存；仅打开分享面板不代表保存成功。
      </Text>
    </View>
  );
}
