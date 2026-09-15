import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { encryptLines, decryptLines } from '../src/encryptedArchive.ts';
import { encodeArchive, decodeArchive, toBase64 } from '../src/archive.ts';
import { emptyLibrary, type Attachment, validateLibrary } from '../src/core.ts';
import { createHash } from 'node:crypto';
async function* lines(items: string[]) {
  yield* items;
}
async function collect(input: AsyncIterable<string>) {
  const out: string[] = [];
  for await (const s of input) out.push(s);
  return out;
}
test('encrypted frames authenticate password, order, ciphertext and final marker', async () => {
  const password = 'test-only-password-123';
  const raw = ['秘密记录\n', '附件数据\n'];
  const encrypted = await collect(encryptLines(lines(raw), password, randomBytes(32)));
  assert.ok(!encrypted.join('').includes('秘密记录'));
  assert.deepEqual(await collect(decryptLines(lines(encrypted), password)), [
    '秘密记录',
    '附件数据',
  ]);
  await assert.rejects(collect(decryptLines(lines(encrypted), 'wrong-password')));
  await assert.rejects(collect(decryptLines(lines(encrypted.slice(0, -1)), password)));
  const swapped = [...encrypted];
  [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
  await assert.rejects(collect(decryptLines(lines(swapped), password)));
  const tampered = [...encrypted];
  const frame = JSON.parse(tampered[1]);
  frame.data = (frame.data[0] === 'A' ? 'B' : 'A') + frame.data.slice(1);
  tampered[1] = JSON.stringify(frame);
  await assert.rejects(collect(decryptLines(lines(tampered), password)));
});
test('ordinary files survive library validation and encrypted archive restoration', async () => {
  const a: Attachment={id:'file-1',kind:'file',name:'example.txt',mime:'text/plain',uri:'file:///example.txt'};
  const library={...emptyLibrary(),memories:[{id:'m',text:'文件记录',category:'工作',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',starred:false,history:[],attachments:[a]}]};
  validateLibrary(library);
  const hash=async(s:string)=>createHash('sha256').update(s).digest('hex');
  const encrypted=await collect(encryptLines(encodeArchive(library,{hash,async *readMedia(){yield toBase64(new TextEncoder().encode('hello'));}}),'test-password-1234',randomBytes(32)));
  let contents='';
  const restored=await decodeArchive(decryptLines(lines(encrypted),'test-password-1234'),hash,async(_,bytes)=>{contents+=new TextDecoder().decode(bytes);},()=> 'file:///restored.txt');
  assert.equal(contents,'hello'); assert.equal(restored.memories[0].attachments[0].kind,'file');
});
