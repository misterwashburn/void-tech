#!/usr/bin/env node

try {
  require.resolve('expo-av/package.json');
} catch {
  console.error(
    [
      'Missing dependency: expo-av.',
      'MusicPlayer.tsx imports expo-av, but it is not installed in node_modules.',
      'Run `npm install` (or `npx expo install expo-av`) before starting Metro, then restart with `npm start -- --clear`.',
    ].join('\n')
  );
  process.exit(1);
}
