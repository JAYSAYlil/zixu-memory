import React, { useSyncExternalStore } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { Button } from './ui';
import { useStyles } from './styles';

type Request = { title: string; message: string; action: string; resolve: (v: boolean) => void };
const queue: Request[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
export function confirmAction(title: string, message: string, action = '继续'): Promise<boolean> {
  return new Promise(resolve => { queue.push({ title, message, action, resolve }); emit(); });
}
export function DialogHost() {
  const s = useStyles();
  const request = useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => queue[0] || null);
  const finish = (yes: boolean) => { const item = queue.shift(); item?.resolve(yes); emit(); };
  if (!request) return null;
  return <Modal visible={!!request} transparent animationType="fade" onRequestClose={() => finish(false)}>
    <View style={s.noticeOverlay}><View style={s.notice} accessibilityViewIsModal>
      <Text style={s.sectionTitle}>{request?.title}</Text>
      <ScrollView style={{ maxHeight: 350 }}><Text style={s.description}>{request?.message}</Text></ScrollView>
      <View style={[s.inline, { justifyContent: 'flex-end' }]}>
        <Button label="取消" onPress={() => finish(false)} />
        <Button primary label={request?.action || '继续'} onPress={() => finish(true)} />
      </View>
    </View></View>
  </Modal>;
}
