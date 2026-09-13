import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { emptyLibrary, validateLibrary, type Library, type ModelConfig } from './core';

let database: Promise<SQLite.SQLiteDatabase> | undefined;
async function db() {
  if (!database)
    database = (async () => {
      const d = await SQLite.openDatabaseAsync('zixu-v1.db');
      await d.execAsync(
        'PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS library (id INTEGER PRIMARY KEY CHECK(id = 1), body TEXT NOT NULL);',
      );
      return d;
    })();
  return database;
}
export async function readLibrary(): Promise<Library> {
  const row = await (
    await db()
  ).getFirstAsync<{ body: string }>('SELECT body FROM library WHERE id = 1');
  return row ? validateLibrary(JSON.parse(row.body)) : emptyLibrary();
}
export async function writeLibrary(state: Library) {
  validateLibrary(state);
  await (
    await db()
  ).runAsync(
    'INSERT INTO library (id, body) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body',
    JSON.stringify(state),
  );
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
export const writePreference = (name: string, value: string) => SecureStore.setItemAsync(`zixu.preference.${name}`, value);

