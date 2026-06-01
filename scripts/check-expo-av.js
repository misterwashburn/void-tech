#!/usr/bin/env node

const missingDependencyMessage = [
  'Missing dependency: expo-av.',
  'MusicPlayer.tsx imports expo-av, but it is not installed in node_modules.',
  'Run `npm install` (or `npx expo install expo-av`) before starting Metro, then restart with `npm start -- --clear`.',
].join('\n');

function checkExpoAv() {
  try {
    require.resolve('expo-av/package.json');
  } catch {
    throw new Error(missingDependencyMessage);
  }
}

if (require.main === module) {
  try {
    checkExpoAv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = { checkExpoAv };
