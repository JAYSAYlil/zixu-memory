import { emptyLibrary, validateLibrary, type Library, type ModelConfig } from './core';
export async function readLibrary(): Promise<Library> {
  const raw = localStorage.getItem('zixu.preview.v1');
  return raw ? validateLibrary(JSON.parse(raw)) : emptyLibrary();
}
export async function writeLibrary(state: Library) {
  localStorage.setItem('zixu.preview.v1', JSON.stringify(state));
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
export async function readPreference(name: string) {
  return name === 'appearance' ? localStorage.getItem('zixu.appearance') : privatePreferences.get(name) || null;
}
export async function writePreference(name: string, value: string) {
  if (name === 'appearance') localStorage.setItem('zixu.appearance', value);
  else privatePreferences.set(name, value);
}

