#!/usr/bin/env node
/**
 * Corgi Hop — postinstall patcher.
 *
 * Applies two idempotent, minimal patches to node_modules that would otherwise
 * be lost every time a fresh install runs. Fails soft: any patch that cannot
 * be applied is logged but does not abort the install (so CI installs still
 * succeed even if the underlying files change shape in a future dep upgrade).
 *
 * PATCH 1 — @capacitor/cli tar v7 ESM shim.
 *   The repo pins tar@7.5.19 via package.json `resolutions` (security fix).
 *   tar@7 is ESM-only and drops the CJS `default` export. Capacitor 6's CLI
 *   (`dist/util/template.js`) still uses `tar.default.extract(...)`, which
 *   throws "Cannot read properties of undefined (reading 'extract')" the
 *   moment you run `npx cap add ios/android` or `npx cap sync`. This patch
 *   makes the require tolerant of both shapes.
 *
 * PATCH 2 — expo→vite shim.
 *   Supervisor runs `yarn expo start --port 3000`. The real @expo/cli would
 *   launch Metro against `app/`, but this project is a Vite+Phaser game
 *   (no expo-router route tree). The shim intercepts `expo start` and
 *   spawns Vite instead. Non-start subcommands (`expo-doctor`, autolinking,
 *   etc.) fall through to the real CLI unchanged.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CLI_TEMPLATE = path.join(ROOT, 'node_modules/@capacitor/cli/dist/util/template.js');
const EXPO_BIN = path.join(ROOT, 'node_modules/.bin/expo');

function log(msg) { console.log(`[postinstall] ${msg}`); }

// ---- PATCH 1 -------------------------------------------------------------
try {
  if (fs.existsSync(CLI_TEMPLATE)) {
    const src = fs.readFileSync(CLI_TEMPLATE, 'utf8');
    const NEEDLE = "const tar_1 = tslib_1.__importDefault(require(\"tar\"));";
    const PATCH = [
      "const tar_mod = require(\"tar\");",
      "// tar@7 is ESM-only (no default export); tar@6 exposes default. Support both.",
      "const tar_1 = tar_mod && tar_mod.default ? tar_mod : { default: tar_mod };",
    ].join('\n');
    if (src.includes(NEEDLE)) {
      fs.writeFileSync(CLI_TEMPLATE, src.replace(NEEDLE, PATCH));
      log('applied tar-v7 shim to @capacitor/cli/dist/util/template.js');
    } else if (src.includes('tar_mod.default')) {
      log('tar-v7 shim already present in @capacitor/cli — skipped');
    } else {
      log('WARN: @capacitor/cli template.js shape changed; tar shim NOT applied');
    }
  } else {
    log('skipping tar shim: @capacitor/cli not installed');
  }
} catch (e) {
  log(`WARN: tar shim failed (${e && e.message}); continuing`);
}

// ---- PATCH 2 -------------------------------------------------------------
try {
  // Remove whatever yarn/npm just created (symlink to @expo/cli/bin/cli) and
  // replace it with our stand-alone JS shim.
  try { fs.rmSync(EXPO_BIN, { force: true }); } catch (_) {}
  const shim = [
    '#!/usr/bin/env node',
    '// Corgi Hop shim: `yarn expo start …` → run Vite dev server on the requested --port.',
    "'use strict';",
    'const args = process.argv.slice(2);',
    "if (args[0] === 'start') {",
    "  let port = '3000';",
    '  for (let i = 0; i < args.length; i++) {',
    "    if (args[i] === '--port' && args[i + 1]) { port = args[i + 1]; break; }",
    '  }',
    "  const path = require('path');",
    "  const vitePkgPath = require.resolve('vite/package.json');",
    "  const viteBin = path.resolve(path.dirname(vitePkgPath), require(vitePkgPath).bin.vite);",
    "  const child = require('child_process').spawn(process.execPath, [viteBin, '--port', port], {",
    "    stdio: 'inherit', env: process.env, cwd: path.resolve(__dirname, '../..'),",
    '  });',
    "  child.on('exit', (code) => process.exit(code == null ? 0 : code));",
    '  return;',
    '}',
    "require('@expo/cli');",
    '',
  ].join('\n');
  fs.writeFileSync(EXPO_BIN, shim);
  fs.chmodSync(EXPO_BIN, 0o755);
  log('installed expo→vite shim at node_modules/.bin/expo');
} catch (e) {
  log(`WARN: expo→vite shim failed (${e && e.message}); Metro will be used instead of Vite`);
}
