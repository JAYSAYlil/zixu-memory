import { File, FileMode } from 'expo-file-system';
import { encodeArchive, decodeArchive, toBase64 } from './archive';
import { encryptLines, decryptLines } from './encryptedArchive';
import { readRecovery } from './persistence';
import * as FS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import {
  uid,
  validateLibrary,
  allAttachments,
  textOnlyLibrary,
  type Attachment,
  type Library,
} from './core';
const directory = () => `${FS.documentDirectory}attachments/`;
export async function attachmentSize(a: Attachment) {
  const info = await FS.getInfoAsync(a.uri);
  return info.exists && !info.isDirectory ? info.size : 0;
}
export async function openAttachment(a: Attachment) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('此设备没有可用的打开或分享方式。');
  await Sharing.shareAsync(a.uri, { mimeType: a.mime, dialogTitle: '打开或分享 ' + a.name });
}
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
  const ext =
    kind === 'audio'
      ? 'm4a'
      : kind === 'photo'
        ? mime.includes('png')
          ? 'png'
          : 'jpg'
        : (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
  const name = `${id}.${ext}`;
  const target = `${directory()}${name}`;
  await FS.copyAsync({ from: uri, to: target });
  return { id, uri: target, kind, mime, name, duration };
}
export async function deleteFiles(attachments: Attachment[]) {
  const recovery = await readRecovery();
  const protectedUris = new Set(recovery ? allAttachments(recovery).map((a) => a.uri) : []);
  await Promise.all(
    attachments
      .filter((a) => !protectedUris.has(a.uri))
      .map((a) => FS.deleteAsync(a.uri, { idempotent: true }).catch(() => {})),
  );
}
export async function cleanupOrphans(library: Library) {
  const recovery = await readRecovery();
  const retained = new Set(
    [...allAttachments(library), ...(recovery ? allAttachments(recovery) : [])].map((a) => a.uri),
  );
  const root = directory();
  if (!(await FS.getInfoAsync(root)).exists) return;
  async function walk(folder: string) {
    for (const name of await FS.readDirectoryAsync(folder)) {
      if (name.includes('/') || name.includes('\\') || name === '..') continue;
      const path = folder + name;
      const info = await FS.getInfoAsync(path);
      if (!info.exists) continue;
      if (info.isDirectory) await walk(path + '/');
      else if (!retained.has(path) && info.modificationTime < Date.now() / 1000 - 86400)
        await FS.deleteAsync(path, { idempotent: true });
    }
  }
  await walk(root);
}
type Packed = { data: string; sha256: string };
const hash = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
export async function exportLibrary(library: Library, textOnly = false, password = '') {
  if (!(await Sharing.isAvailableAsync())) throw new Error('此设备没有可用的文件分享方式。');
  const file = new File(FS.cacheDirectory + 'zixu-' + uid() + (textOnly ? '-text.json' : '.zixu'));
  file.create();
  try {
    if (textOnly)
      file.write(
        JSON.stringify({
          format: 'zixu-backup',
          version: 1,
          library: textOnlyLibrary(library),
          media: {},
        }),
      );
    else {
      const handle = file.open(FileMode.WriteOnly);
      try {
        const lines = encodeArchive(library, {
          hash,
          async *readMedia(a) {
            const source = new File(a.uri);
            if (!source.exists) throw new Error('附件缺失：' + a.name);
            const reader = source.open(FileMode.ReadOnly);
            try {
              while ((reader.offset || 0) < (reader.size || 0))
                yield toBase64(reader.readBytes(192 * 1024));
            } finally {
              reader.close();
            }
          },
        });
        for await (const line of password
          ? encryptLines(lines, password, Crypto.getRandomBytes(32))
          : lines)
          handle.writeBytes(new TextEncoder().encode(line));
      } finally {
        handle.close();
      }
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: textOnly ? 'application/json' : 'application/octet-stream',
      dialogTitle: '保存自叙备份',
    });
  } finally {
    if (file.exists) file.delete();
  }
}
async function* fileLines(file: File) {
  const reader = file.open(FileMode.ReadOnly),
    decoder = new TextDecoder();
  let pending = '';
  try {
    while ((reader.offset || 0) < (reader.size || 0)) {
      pending += decoder.decode(reader.readBytes(64 * 1024), { stream: true });
      let end: number;
      while ((end = pending.indexOf('\n')) >= 0) {
        yield pending.slice(0, end);
        pending = pending.slice(end + 1);
      }
      if (pending.length > 32 * 1024 * 1024) throw new Error('备份帧过大。');
    }
    pending += decoder.decode();
    if (pending.trim()) yield pending;
  } finally {
    reader.close();
  }
}
async function importStream(file: File, password?: string) {
  const staging = directory() + 'restore-' + uid() + '/';
  await FS.makeDirectoryAsync(staging, { intermediates: true });
  const cleanup = () => FS.deleteAsync(staging, { idempotent: true });
  const initialized = new Set<string>();
  try {
    const library = await decodeArchive(
      password !== undefined ? decryptLines(fileLines(file), password) : fileLines(file),
      hash,
      async (id, bytes) => {
        const target = new File(staging + id);
        if (!initialized.has(id)) {
          target.create();
          initialized.add(id);
        }
        const writer = target.open(FileMode.Append);
        try {
          writer.writeBytes(bytes);
        } finally {
          writer.close();
        }
      },
      (a) => staging + a.id,
    );
    return { library, cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
}
export async function chooseImport(password = ''): Promise<{
  library: Library;
  cleanup: () => Promise<void>;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const picked = result.assets[0];
  const inputFile = new File(picked.uri);
  const probe = inputFile.open(FileMode.ReadOnly);
  let prefix: string;
  try {
    prefix = new TextDecoder().decode(probe.readBytes(256));
  } finally {
    probe.close();
  }
  if (prefix.startsWith('{"format":"zixu-encrypted-v1"')) return importStream(inputFile, password);
  if (prefix.startsWith('{"payload":')) return importStream(inputFile);
  if ((picked.size || inputFile.size || 0) > 50 * 1024 * 1024)
    throw new Error('备份超过 50 MB，当前版本无法导入。');
  const text = await FS.readAsStringAsync(picked.uri);
  if (text.length > 50 * 1024 * 1024) throw new Error('备份过大。');
  const pack = JSON.parse(text);
  if (pack.format !== 'zixu-backup' || pack.version !== 1)
    throw new Error('请选择自叙导出的完整备份。');
  const library = validateLibrary(pack.library);
  for (const a of allAttachments(library)) {
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
    for (const a of allAttachments(library)) {
      const ext =
        a.kind === 'audio'
          ? 'm4a'
          : a.kind === 'photo'
            ? a.mime.includes('png')
              ? 'png'
              : 'jpg'
            : (a.mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
      const target = `${staging}${a.id}.${ext}`;
      await FS.writeAsStringAsync(target, pack.media[a.id].data, {
        encoding: FS.EncodingType.Base64,
      });
      a.uri = target;
    }
    const paths = new Map(allAttachments(library).map((a) => [a.id, a.uri]));
    for (const m of library.memories) for (const a of m.attachments) a.uri = paths.get(a.id)!;
    return { library, cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
}
