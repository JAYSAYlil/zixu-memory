import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { toBase64, fromBase64 } from './archive.ts';

const utf8 = new TextEncoder();
const iterations = 600000;
const magic = 'zixu-encrypted-v1';
function nonce(index: number) {
  const out = new Uint8Array(12);
  new DataView(out.buffer).setUint32(8, index);
  return out;
}
export async function* encryptLines(
  lines: AsyncIterable<string>,
  password: string,
  salt: Uint8Array,
) {
  if (password.length < 12) throw new Error('备份密码至少需要 12 个字符。');
  if (salt.length !== 32) throw new Error('无效的随机盐。');
  const header = JSON.stringify({ format: magic, salt: toBase64(salt), iterations });
  const key = await pbkdf2Async(sha256, utf8.encode(password), salt, { c: iterations, dkLen: 32 });
  try {
    yield header + '\n';
    let n = 0;
    for await (const line of lines) {
      if (n >= 0xfffffffe) throw new Error('备份过大。');
      const data = gcm(key, nonce(n), utf8.encode(header + ':' + n)).encrypt(utf8.encode(line));
      yield JSON.stringify({ n, data: toBase64(data) }) + '\n';
      n++;
    }
    yield JSON.stringify({
      n,
      data: toBase64(gcm(key, nonce(n), utf8.encode(header + ':' + n)).encrypt(new Uint8Array())),
    }) + '\n';
  } finally {
    key.fill(0);
  }
}
export async function* decryptLines(lines: AsyncIterable<string>, password: string) {
  const iterator = lines[Symbol.asyncIterator]();
  const first = await iterator.next();
  const header = first.value?.replace(/\r?\n$/, '');
  const h = JSON.parse(header || '{}');
  if (
    h.format !== magic ||
    h.iterations !== iterations ||
    typeof h.salt !== 'string' ||
    h.salt.length > 64
  )
    throw new Error('不支持的加密备份格式。');
  const salt = fromBase64(h.salt);
  if (salt.length !== 32) throw new Error('备份头损坏。');
  const key = await pbkdf2Async(sha256, utf8.encode(password), salt, { c: iterations, dkLen: 32 });
  try {
    let n = 0,
      ended = false;
    for (;;) {
      const next = await iterator.next();
      if (next.done) break;
      if (ended) throw new Error('备份尾部有多余数据。');
      const frame = JSON.parse(next.value);
      if (frame.n !== n || typeof frame.data !== 'string' || frame.data.length > 48 * 1024 * 1024)
        throw new Error('备份顺序或长度无效。');
      let plain;
      try {
        plain = gcm(key, nonce(n), utf8.encode(header + ':' + n)).decrypt(fromBase64(frame.data));
      } catch {
        throw new Error('密码不正确，或备份已损坏。现有记录没有改变。');
      }
      n++;
      if (!plain.length) ended = true;
      else yield new TextDecoder().decode(plain).replace(/\n$/, '');
    }
    if (!ended) throw new Error('备份不完整。');
  } finally {
    key.fill(0);
    await iterator.return?.();
  }
}
