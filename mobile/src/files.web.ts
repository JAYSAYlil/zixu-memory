import { validateLibrary, uid, textOnlyLibrary, type Attachment, type Library } from './core';
export async function exportSelf(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'SKILL.md';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function keepFile(
  uri: string,
  kind: Attachment['kind'],
  mime: string,
  duration?: number,
): Promise<Attachment> {
  const blob = await (await fetch(uri)).blob();
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return {
    id: uid(),
    kind,
    mime,
    duration,
    uri: data,
    name: kind === 'photo' ? 'photo.jpg' : kind === 'audio' ? 'audio.webm' : 'file.bin',
  };
}
export async function deleteFiles(_attachments: Attachment[]) {}
export async function attachmentSize(a: Attachment) {
  return (await (await fetch(a.uri)).blob()).size;
}
export async function openAttachment(a: Attachment) {
  const url = URL.createObjectURL(await (await fetch(a.uri)).blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = a.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function cleanupOrphans(_library: Library) {}
export async function exportLibrary(library: Library, textOnly = false, password = '') {
  if (password) throw new Error('加密完整备份请在安卓应用内使用。网页仅用于界面预览。');
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify({
          format: 'zixu-web-preview',
          version: 1,
          library: textOnly ? textOnlyLibrary(library) : library,
        }),
      ],
      {
        type: 'application/json',
      },
    ),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'zixu-web-preview.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function chooseImport(_password = ''): Promise<{
  library: Library;
  cleanup: () => Promise<void>;
} | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        if (file.size > 50 * 1024 * 1024) throw new Error('文件过大。');
        const data = JSON.parse(await file.text());
        if (data.format !== 'zixu-web-preview')
          throw new Error('网页预览只导入网页示例备份，安卓请在手机内恢复。');
        resolve({ library: validateLibrary(data.library), cleanup: async () => {} });
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
