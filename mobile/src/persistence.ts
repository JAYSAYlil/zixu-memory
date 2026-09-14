import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import {
  emptyLibrary,
  validateLibrary,
  validateDraftState,
  type Library,
  type ModelConfig,
} from './core.ts';

let database: Promise<SQLite.SQLiteDatabase> | undefined;
async function db() {
  if (!database)
    database = (async () => {
      const d = await SQLite.openDatabaseAsync('zixu-v1.db');
      await d.execAsync(
        'PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS library (id INTEGER PRIMARY KEY CHECK(id = 1), body TEXT NOT NULL);',
      );
      await d.execAsync(
        'CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, body TEXT NOT NULL, createdAt TEXT NOT NULL); CREATE INDEX IF NOT EXISTS memories_date ON memories(createdAt); CREATE TABLE IF NOT EXISTS insights (id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS metadata (id TEXT PRIMARY KEY, body TEXT NOT NULL);',
      );
      const migrated = await d.getFirstAsync('SELECT id FROM metadata WHERE id = ?', 'schema');
      if (!migrated)
        await d.withExclusiveTransactionAsync(async (tx) => {
          const old = await tx.getFirstAsync<{ body: string }>(
            'SELECT body FROM library WHERE id = 1',
          );
          const state = old ? validateLibrary(JSON.parse(old.body)) : emptyLibrary();
          for (const m of state.memories)
            await tx.runAsync(
              'INSERT OR REPLACE INTO memories VALUES (?, ?, ?)',
              m.id,
              JSON.stringify(m),
              m.createdAt,
            );
          for (const i of state.insights)
            await tx.runAsync(
              'INSERT OR REPLACE INTO insights VALUES (?, ?)',
              i.id,
              JSON.stringify(i),
            );
          await tx.runAsync(
            'INSERT OR REPLACE INTO metadata VALUES (?, ?)',
            'draft',
            JSON.stringify({ draft: state.draft, composerDraft: state.composerDraft }),
          );
          await tx.runAsync('INSERT INTO metadata VALUES (?, ?)', 'schema', '2');
          await tx.runAsync('DELETE FROM library');
        });
      return d;
    })().catch((e) => {
      database = undefined;
      throw e;
    });
  return database;
}
export async function readLibrary(): Promise<Library> {
  const d = await db();
  const memories = await d.getAllAsync<{ body: string }>(
    'SELECT body FROM memories ORDER BY createdAt DESC, id DESC',
  );
  const insights = await d.getAllAsync<{ body: string }>(
    "SELECT body FROM insights ORDER BY json_extract(body, '$.createdAt') DESC, id DESC",
  );
  const draft = await d.getFirstAsync<{ body: string }>(
    'SELECT body FROM metadata WHERE id = ?',
    'draft',
  );
  return validateLibrary({
    version: 1,
    memories: memories.map((r) => JSON.parse(r.body)),
    insights: insights.map((r) => JSON.parse(r.body)),
    ...(draft ? JSON.parse(draft.body) : { draft: '' }),
  });
}
export async function writeLibrary(state: Library, previous?: Library) {
  validateLibrary(state);
  await (
    await db()
  ).withExclusiveTransactionAsync(async (tx) => {
    for (const table of ['memories', 'insights'] as const) {
      const before = new Map(previous?.[table].map((item) => [item.id, item]) || []);
      const after = new Set(state[table].map((item) => item.id));
      if (!previous) await tx.runAsync(`DELETE FROM ${table}`);
      for (const id of before.keys())
        if (!after.has(id)) await tx.runAsync(`DELETE FROM ${table} WHERE id = ?`, id);
      for (const item of state[table]) {
        if (before.get(item.id) === item) continue;
        if (table === 'memories')
          await tx.runAsync(
            'INSERT OR REPLACE INTO memories VALUES (?, ?, ?)',
            item.id,
            JSON.stringify(item),
            item.createdAt,
          );
        else
          await tx.runAsync(
            'INSERT OR REPLACE INTO insights VALUES (?, ?)',
            item.id,
            JSON.stringify(item),
          );
      }
    }
    await tx.runAsync(
      'INSERT OR REPLACE INTO metadata VALUES (?, ?)',
      'draft',
      JSON.stringify({ draft: state.draft, composerDraft: state.composerDraft }),
    );
  });
}
export async function writeDraft(state: Library) {
  validateDraftState(state);
  await (
    await db()
  ).runAsync(
    'INSERT OR REPLACE INTO metadata VALUES (?, ?)',
    'draft',
    JSON.stringify({ draft: state.draft, composerDraft: state.composerDraft }),
  );
}
export async function saveRecovery(state: Library) {
  await (
    await db()
  ).runAsync('INSERT OR REPLACE INTO metadata VALUES (?, ?)', 'recovery', JSON.stringify(state));
}
export async function readRecovery(): Promise<Library | null> {
  const row = await (
    await db()
  ).getFirstAsync<{ body: string }>('SELECT body FROM metadata WHERE id = ?', 'recovery');
  return row ? validateLibrary(JSON.parse(row.body)) : null;
}
export async function readConfig(): Promise<ModelConfig> {
  const raw = await SecureStore.getItemAsync('zixu.provider.v1');
  return raw
    ? JSON.parse(raw)
    : { baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', key: '' };
}
export async function writeConfig(config: ModelConfig) {
  await SecureStore.setItemAsync('zixu.provider.v1', JSON.stringify(config));
}

export const readPreference = (name: string) => SecureStore.getItemAsync(`zixu.preference.${name}`);
export const writePreference = (name: string, value: string) =>
  SecureStore.setItemAsync(`zixu.preference.${name}`, value);
