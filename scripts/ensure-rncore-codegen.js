#!/usr/bin/env node

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const requiredRncoreFiles = [
  'ComponentDescriptors.cpp',
  'ComponentDescriptors.h',
  'EventEmitters.cpp',
  'EventEmitters.h',
  'Props.cpp',
  'Props.h',
  'RCTComponentViewHelpers.h',
  'ShadowNodes.cpp',
  'ShadowNodes.h',
  'States.cpp',
  'States.h',
];

function resolveFromProject(request) {
  return require.resolve(request, { paths: [projectRoot] });
}

function getReactNativeRoot() {
  return path.dirname(resolveFromProject('react-native/package.json'));
}

function getMissingRncoreFiles(reactNativeRoot) {
  const rncoreDir = path.join(
    reactNativeRoot,
    'ReactCommon',
    'react',
    'renderer',
    'components',
    'rncore',
  );

  return requiredRncoreFiles.filter(
    (file) => !fs.existsSync(path.join(rncoreDir, file)),
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

function ensureRncoreCodegen() {
  const reactNativeRoot = getReactNativeRoot();
  let missingFiles = getMissingRncoreFiles(reactNativeRoot);

  if (missingFiles.length === 0) {
    console.log('[rncore-codegen] React Native rncore generated files are present.');
    return;
  }

  console.log(
    `[rncore-codegen] Missing generated React Native rncore files: ${missingFiles.join(', ')}`,
  );
  console.log('[rncore-codegen] Running React Native codegen for iOS before Xcode builds pods...');

  runCodegen(reactNativeRoot);

  missingFiles = getMissingRncoreFiles(reactNativeRoot);
  if (missingFiles.length > 0) {
    throw new Error(
      `React Native codegen completed, but rncore files are still missing: ${missingFiles.join(', ')}`,
    );
  }

  console.log('[rncore-codegen] React Native rncore generated files are present.');
}

ensureRncoreCodegen();
