#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PODFILE = path.join(ROOT, 'ios/App/Podfile');
const PROJECT = path.join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj');
const REQUIRED_TARGET = '15.0';

function patchFile(filePath, transform) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required iOS file: ${filePath}`);
  }

  const before = fs.readFileSync(filePath, 'utf8');
  const after = transform(before);
  if (after !== before) fs.writeFileSync(filePath, after);
  return after;
}

try {
  const podfile = patchFile(PODFILE, (source) =>
    source.replace(/platform :ios, ['"][0-9.]+['"]/, `platform :ios, '${REQUIRED_TARGET}'`),
  );

  const project = patchFile(PROJECT, (source) =>
    source.replace(
      /IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;/g,
      `IPHONEOS_DEPLOYMENT_TARGET = ${REQUIRED_TARGET};`,
    ),
  );

  if (!podfile.includes(`platform :ios, '${REQUIRED_TARGET}'`)) {
    throw new Error('Podfile iOS deployment target was not updated to 15.0.');
  }

  const targets = [...project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([0-9.]+);/g)]
    .map((match) => match[1]);

  if (targets.length === 0 || targets.some((target) => target !== REQUIRED_TARGET)) {
    throw new Error(`Xcode deployment targets are invalid: ${targets.join(', ') || 'none found'}`);
  }

  console.log(`[ios-target] Podfile and ${targets.length} Xcode build configurations set to iOS ${REQUIRED_TARGET}.`);
} catch (error) {
  console.error(`[ios-target] FATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
