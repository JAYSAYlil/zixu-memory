import {
  emptyLibrary,
  validateLibrary,
  validateDraftState,
  type Library,
  type ModelConfig,
} from './core';
export async function readLibrary(): Promise<Library> {
  const raw = localStorage.getItem('zixu.preview.v1');
  return raw ? validateLibrary(JSON.parse(raw)) : emptyLibrary();
}
export async function writeLibrary(state: Library, _previous?: Library) {
  localStorage.setItem('zixu.preview.v1', JSON.stringify(state));
}
export async function writeDraft(state: Library) {
  validateDraftState(state);
  await writeLibrary(state);
}
export async function saveRecovery(state: Library) {
  localStorage.setItem('zixu.recovery', JSON.stringify(state));
}
export async function readRecovery(): Promise<Library | null> {
  const raw = localStorage.getItem('zixu.recovery');
  return raw ? validateLibrary(JSON.parse(raw)) : null;
}
let config: ModelConfig = {
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  key: '',
};
export async function readConfig() {
  return config;
}
export async function writeConfig(value: ModelConfig) {
  config = value;
}

const privatePreferences = new Map<string, string>();
const persistedPreferences = new Set(['welcome-v1', 'last-backup', 'appearance', 'accent']);
export async function readPreference(name: string) {
  if (persistedPreferences.has(name)) return localStorage.getItem('zixu.' + name);
  return privatePreferences.get(name) || null;
}
export async function writePreference(name: string, value: string) {
  if (persistedPreferences.has(name)) {
    localStorage.setItem('zixu.' + name, value);
    return;
  }
  privatePreferences.set(name, value);
}
