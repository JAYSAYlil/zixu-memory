import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Sheet } from './components';
import { Button } from './ui';
import { useStyles } from './styles';
import { readPreference, writePreference } from './persistence';
export function Welcome() {
  const s = useStyles();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void readPreference('welcome-v1')
      .then((v) => setVisible(!v))
      .catch(() => {});
  }, []);
  return (
    <Sheet visible={visible} title="从一件小事开始" onClose={() => setVisible(false)}>
      <View style={{ gap: 20 }}>
        <Text style={s.body}>记下一段经历，再慢慢认识自己。不需要一次写完整。</Text>
        <Text style={s.body}>
          记录：文字、照片、录音和文件可以先留在手机里。记录、搜索、自己撰写认识和备份都不需要配置
          AI。
        </Text>
        <Text style={s.body}>
          认识我：你写下或亲自确认的认识，才会成为“询问自己”的参考。它可以修改，也可以随着经历变化。
        </Text>
        <Text style={s.body}>
          询问自己：在设置中填入自己的 AI 服务后，主动提问才会发送相关资料。回答是推演，不替你决定。
        </Text>
        <Text style={s.small}>建议定期导出加密备份。卸载应用会删除本机数据。</Text>
        <Button
          primary
          label="开始记录"
          onPress={() => {
            void writePreference('welcome-v1', 'done')
              .then(() => setVisible(false))
              .catch(() => setError('暂时无法保存引导状态，请稍后重试。'));
          }}
        />
        {!!error && <Text style={s.footnote}>{error}</Text>}
      </View>
    </Sheet>
  );
}
