#!/usr/bin/env node

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const requiredRncoreHeaders = [
  'ShadowNodes.h',
  'States.h',
  'RCTComponentViewHelpers.h',
];

function resolveFromProject(request) {
  return require.resolve(request, { paths: [projectRoot] });
}

function getReactNativeRoot() {
  return path.dirname(resolveFromProject('react-native/package.json'));
}

function getMissingHeaders(reactNativeRoot) {
  const rncoreDir = path.join(
    reactNativeRoot,
    'ReactCommon',
    'react',
    'renderer',
    'components',
    'rncore',
  );

  return requiredRncoreHeaders.filter(
    (header) => !fs.existsSync(path.join(rncoreDir, header)),
  );
}

function runCodegen(reactNativeRoot) {
  const codegenScript = path.join(
    reactNativeRoot,
    'scripts',
    'generate-codegen-artifacts.js',
  );

  execFileSync(
    process.execPath,
    [
      codegenScript,
      '-p',
      projectRoot,
      '-o',
      path.join(projectRoot, 'ios'),
      '-t',
      'ios',
    ],
    { stdio: 'inherit' },
  );
}

const reactNativeRoot = getReactNativeRoot();
let missingHeaders = getMissingHeaders(reactNativeRoot);

if (missingHeaders.length === 0) {
  process.exit(0);
}

console.log(
  `[rncore-codegen] Missing generated React Native rncore headers: ${missingHeaders.join(', ')}`,
);
console.log('[rncore-codegen] Running React Native codegen for iOS before Xcode builds pods...');

runCodegen(reactNativeRoot);

missingHeaders = getMissingHeaders(reactNativeRoot);
if (missingHeaders.length > 0) {
  throw new Error(
    `React Native codegen completed, but rncore headers are still missing: ${missingHeaders.join(', ')}`,
  );
}

console.log('[rncore-codegen] React Native rncore headers are present.');
