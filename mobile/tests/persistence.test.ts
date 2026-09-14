import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { emptyLibrary, type Memory } from '../src/core.ts';

const database = new DatabaseSync(':memory:');
let failNextWrite = false;
const statements: string[] = [];
const adapter = {
  async execAsync(sql: string) {
    database.exec(sql);
  },
  async runAsync(sql: string, ...params: any[]) {
    statements.push(sql);
    if (failNextWrite && sql.startsWith('INSERT OR REPLACE INTO memories')) {
      failNextWrite = false;
      throw new Error('simulated disk failure');
    }
    return database.prepare(sql).run(...params);
  },
  async getFirstAsync(sql: string, ...params: any[]) {
    return database.prepare(sql).get(...params) || null;
  },
  async getAllAsync(sql: string, ...params: any[]) {
    return database.prepare(sql).all(...params);
  },
  async withExclusiveTransactionAsync(fn: (tx: any) => Promise<void>) {
    database.exec('BEGIN IMMEDIATE');
    try {
      await fn(adapter);
      database.exec('COMMIT');
    } catch (e) {
      database.exec('ROLLBACK');
      throw e;
    }
  },
};
(globalThis as any).__zixuTestDatabase = adapter;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'expo-sqlite')
      return {
        url: 'data:text/javascript,export async function openDatabaseAsync(){return globalThis.__zixuTestDatabase}',
        shortCircuit: true,
      };
    if (specifier === 'expo-secure-store')
      return {
        url: 'data:text/javascript,export async function getItemAsync(){return null} export async function setItemAsync(){}',
        shortCircuit: true,
      };
    return nextResolve(specifier, context);
  },
});
const m = (id: string): Memory => ({
  id,
  text: '迁移前原文',
  category: '工作',
  createdAt: '2026-09-14T12:00:00Z',
  updatedAt: '2026-09-14T12:00:00Z',
  starred: false,
  attachments: [],
  history: [],
});
const old = { ...emptyLibrary(), memories: [m('a'), m('b')], draft: '旧文字草稿' };
database.exec('CREATE TABLE library (id INTEGER PRIMARY KEY, body TEXT NOT NULL)');
database.prepare('INSERT INTO library VALUES (1, ?)').run(JSON.stringify(old));
const persistence = await import('../src/persistence.ts');

test('SQLite migration preserves original data and draft; row writes and recovery survive reads', async () => {
  const read = await persistence.readLibrary();
  assert.equal(read.memories.length, 2);
  assert.equal(read.draft, old.draft);
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM library').get()!.n, 0);
  assert.equal(database.prepare('SELECT body FROM metadata WHERE id = ?').get('schema')!.body, '2');
  statements.length = 0;
  const next = {
    ...read,
    memories: read.memories.map((r) => (r.id === 'a' ? { ...r, text: '更新' } : r)),
  };
  await persistence.writeLibrary(next, read);
  assert.equal(statements.filter((s) => s.startsWith('INSERT OR REPLACE INTO memories')).length, 1);
  statements.length = 0;
  await persistence.writeDraft({ ...next, draft: '独立草稿' });
  assert.equal(statements.length, 1);
  assert.ok(statements[0].includes('metadata'));
  assert.equal((await persistence.readLibrary()).draft, '独立草稿');
  await persistence.saveRecovery(next);
  assert.deepEqual(await persistence.readRecovery(), next);
});
test('SQLite failed write rolls back deleted rows and preserves last successful library', async () => {
  const before = await persistence.readLibrary();
  const next = { ...before, memories: [{ ...m('a'), text: '不得提交' }] };
  failNextWrite = true;
  await assert.rejects(persistence.writeLibrary(next, before), /disk failure/);
  assert.deepEqual(await persistence.readLibrary(), before);
  await persistence.writeLibrary(next, before);
  assert.equal((await persistence.readLibrary()).memories[0].text, '不得提交');
  assert.equal((await persistence.readLibrary()).memories.length, 1);
});
test('failed migration retains legacy snapshot and retries without partial rows', async () => {
  database.exec(
    'DELETE FROM memories; DELETE FROM insights; DELETE FROM metadata; DELETE FROM library',
  );
  database.prepare('INSERT INTO library VALUES (1, ?)').run(JSON.stringify(old));
  const fresh = await import('../src/persistence.ts?migration-retry');
  failNextWrite = true;
  await assert.rejects(fresh.readLibrary(), /disk failure/);
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM library').get()!.n, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM memories').get()!.n, 0);
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM metadata').get()!.n, 0);
  const recovered = await fresh.readLibrary();
  assert.equal(recovered.memories.length, 2);
  assert.equal(recovered.draft, old.draft);
});
test.after(() => {
  hooks.deregister();
  database.close();
  delete (globalThis as any).__zixuTestDatabase;
});
