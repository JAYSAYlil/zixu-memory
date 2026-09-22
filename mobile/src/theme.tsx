import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { readPreference, writePreference } from './persistence';
import {
  accentPalettes,
  isThemeAccent,
  neutralColors,
  washFor,
  type ThemeAccent,
} from './palette';

export function themeColors(dark: boolean, accent: ThemeAccent) {
  const roles = accentPalettes[accent][dark ? 'dark' : 'light'];
  return {
    ...neutralColors[dark ? 'dark' : 'light'],
    ...roles,
    wash: washFor(dark, roles.accentLight),
  };
}
export type ThemeColors = ReturnType<typeof themeColors>;
export const lightColors: ThemeColors = themeColors(false, 'teal');
export const darkColors: ThemeColors = themeColors(true, 'teal');
export type ThemeMode = 'system' | 'light' | 'dark';
const Context = createContext({
  C: lightColors,
  dark: false,
  mode: 'system' as ThemeMode,
  accent: 'teal' as ThemeAccent,
  setMode: async (_mode: ThemeMode) => {},
  setAccent: async (_accent: ThemeAccent) => {},
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, updateMode] = useState<ThemeMode>('system');
  const [accent, updateAccent] = useState<ThemeAccent>('teal');
  useEffect(() => {
    void readPreference('appearance')
      .then((value) => {
        if (value === 'light' || value === 'dark' || value === 'system') updateMode(value);
      })
      .catch(() => {});
    void readPreference('accent')
      .then((value) => {
        if (isThemeAccent(value)) updateAccent(value);
      })
      .catch(() => {});
  }, []);
  const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
  // useStyles 等按 C 的引用缓存样式表，除换色与换明暗外不能产生新对象。
  const C = useMemo(() => themeColors(dark, accent), [dark, accent]);
  const value = useMemo(
    () => ({
      C,
      dark,
      mode,
      accent,
      setMode: async (next: ThemeMode) => {
        await writePreference('appearance', next);
        updateMode(next);
      },
      setAccent: async (next: ThemeAccent) => {
        await writePreference('accent', next);
        updateAccent(next);
      },
    }),
    [C, dark, mode, accent],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useTheme = () => useContext(Context);
