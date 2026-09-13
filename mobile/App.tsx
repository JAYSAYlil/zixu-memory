import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Main from './src/Main';
import { ThemeProvider } from './src/theme';
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider><Main /></ThemeProvider>
    </SafeAreaProvider>
  );
}
