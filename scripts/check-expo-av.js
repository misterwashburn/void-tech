#!/usr/bin/env node

const missingDependencyMessage = [
  'Missing dependency: expo-av.',
  'MusicPlayer.tsx imports expo-av, but it is not installed in node_modules.',
  'Run `npm install` (or `npx expo install expo-av`) before starting Metro, then restart with `npm start -- --clear`.',
].join('\n');

function isExpoAvInstalled() {
  try {
    require.resolve('expo-av/package.json');
    return true;
  } catch {
    return false;
  }
}

function checkExpoAv({ exitOnMissing = false } = {}) {
  if (isExpoAvInstalled()) {
    return true;
  }

  if (exitOnMissing) {
    console.error(missingDependencyMessage);
    process.exit(1);
  }

  throw new Error(missingDependencyMessage);
}

if (require.main === module) {
  checkExpoAv({ exitOnMissing: true });
}

module.exports = { checkExpoAv, isExpoAvInstalled };
