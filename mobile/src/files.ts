import * as FS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { uid, validateLibrary, type Attachment, type Library } from './core';
const directory = () => `${FS.documentDirectory}attachments/`;
export async function exportSelf(content: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('此设备没有可用的文件分享方式。');
  const file = `${FS.cacheDirectory}SKILL.md`;
  await FS.writeAsStringAsync(file, content);
  await Sharing.shareAsync(file, { mimeType: 'text/markdown', dialogTitle: '导出我的价值观' });
}
export async function keepFile(
  uri: string,
  kind: Attachment['kind'],
  mime: string,
  duration?: number,
): Promise<Attachment> {
  await FS.makeDirectoryAsync(directory(), { intermediates: true });
  const id = uid();
  const name = `${id}.${kind === 'audio' ? 'm4a' : mime.includes('png') ? 'png' : 'jpg'}`;
  const target = `${directory()}${name}`;
  await FS.copyAsync({ from: uri, to: target });
  return { id, uri: target, kind, mime, name, duration };
}
export async function deleteFiles(attachments: Attachment[]) {
  await Promise.all(
    attachments.map((a) => FS.deleteAsync(a.uri, { idempotent: true }).catch(() => {})),
  );
}
type Packed = { data: string; sha256: string };
export async function exportLibrary(library: Library) {
  const media: Record<string, Packed> = {};
  let size = 0;
  for (const m of library.memories)
    for (const a of m.attachments) {
      const info = await FS.getInfoAsync(a.uri);
      if (!info.exists) throw new Error(`附件缺失：${a.name}。没有生成不完整的备份。`);
      size += info.size;
      if (size > 30 * 1024 * 1024)
        throw new Error(
          '当前预览版完整备份支持最多 30 MB 附件。请保留现有数据，后续版本将支持分卷备份。',
        );
      const data = await FS.readAsStringAsync(a.uri, { encoding: FS.EncodingType.Base64 });
      media[a.id] = {
        data,
        sha256: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data),
      };
    }
  const file = `${FS.cacheDirectory}zixu-${new Date().toISOString().slice(0, 10)}.json`;
  const portable = {
    ...library,
    memories: library.memories.map((m) => ({
      ...m,
      attachments: m.attachments.map((a) => ({ ...a, uri: `attachment:${a.id}` })),
    })),
  };
  await FS.writeAsStringAsync(
    file,
    JSON.stringify({
      format: 'zixu-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      library: portable,
      media,
    }),
  );
  if (!(await Sharing.isAvailableAsync())) throw new Error('此设备没有可用的文件分享方式。');
  try {
    await Sharing.shareAsync(file, {
      mimeType: 'application/json',
      dialogTitle: '保存自叙完整备份',
    });
  } finally {
    await FS.deleteAsync(file, { idempotent: true }).catch(() => {});
  }
}
export async function chooseImport(): Promise<{
  library: Library;
  cleanup: () => Promise<void>;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const picked = result.assets[0];
  if ((picked.size || 0) > 50 * 1024 * 1024) throw new Error('备份超过 50 MB，当前版本无法导入。');
  const text = await FS.readAsStringAsync(picked.uri);
  if (text.length > 50 * 1024 * 1024) throw new Error('备份过大。');
  const pack = JSON.parse(text);
  if (pack.format !== 'zixu-backup' || pack.version !== 1)
    throw new Error('请选择自叙导出的完整备份。');
  const library = validateLibrary(pack.library);
  for (const m of library.memories)
    for (const a of m.attachments) {
      const entry = pack.media?.[a.id];
      if (
        !entry ||
        typeof entry.data !== 'string' ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.data) ||
        entry.data.length % 4 !== 0 ||
        (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, entry.data)) !==
          entry.sha256
      )
        throw new Error(`附件校验失败：${a.name}。现有记忆没有改变。`);
    }
  const staging = `${directory()}restore-${uid()}/`;
  await FS.makeDirectoryAsync(staging, { intermediates: true });
  const cleanup = () => FS.deleteAsync(staging, { idempotent: true });
  try {
    for (const m of library.memories)
      for (const a of m.attachments) {
        const target = `${staging}${a.id}.${a.kind === 'audio' ? 'm4a' : a.mime.includes('png') ? 'png' : 'jpg'}`;
        await FS.writeAsStringAsync(target, pack.media[a.id].data, {
          encoding: FS.EncodingType.Base64,
        });
        a.uri = target;
      }
    return { library, cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
}
