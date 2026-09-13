import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { readPreference, writePreference } from './persistence';

export const lightColors = {
  paper: '#FFFFFF', ink: '#191C1B', muted: '#636967', accent: '#0F8F82',
  accentLight: '#CFF2EC', accentDark: '#0B6E64', line: '#D8DEDC', wash: '#F1F4F3',
  white: '#FFFFFF', green: '#2F7D5C', onAccent: '#FFFFFF', error: '#BA3131',
};
// 深色端沿用课表应用的中性深灰体系：页面近黑、卡片上浮，主色提亮保证暗处可读。
export const darkColors: typeof lightColors = {
  paper: '#0B0C0D', ink: '#E4E6E5', muted: '#9CA1A0', accent: '#3ADBC4',
  accentLight: '#12433D', accentDark: '#6FEADD', line: '#3A3D40', wash: '#232628',
  white: '#FFFFFF', green: '#8BD5B2', onAccent: '#08251F', error: '#FFB4AB',
};
export type ThemeMode = 'system' | 'light' | 'dark';
const Context = createContext({ C: lightColors, dark: false, mode: 'system' as ThemeMode,
  setMode: async (_mode: ThemeMode) => {} });
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, updateMode] = useState<ThemeMode>('system');
  useEffect(() => { void readPreference('appearance').then(value => {
    if (value === 'light' || value === 'dark' || value === 'system') updateMode(value);
  }).catch(() => {}); }, []);
  const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const value = useMemo(() => ({ C: dark ? darkColors : lightColors, dark, mode,
    setMode: async (next: ThemeMode) => { await writePreference('appearance', next); updateMode(next); },
  }), [mode, dark]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useTheme = () => useContext(Context);
