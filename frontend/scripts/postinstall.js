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
 *
 * PATCH 3 — @capacitor-community/admob@6.2.0 UMP Swift-symbol rename.
 *   The plugin's ConsentExecutor.swift uses the pre-3.0 GoogleUserMessagingPlatform
 *   Swift overlay names (`UMPConsentStatus`, `UMPConsentInformation`, …). In
 *   UMP 3.0+ (which CocoaPods resolves under Google-Mobile-Ads-SDK 11.x)
 *   the Swift compiler rejects these with:
 *     "'UMPConsentStatus' has been renamed to 'ConsentStatus'"
 *   This patch rewrites all 7 renamed symbols to their current names.
 *   Objective-C class names stay UMP*; only Swift overlay identifiers change.
 *   The plugin's JS-facing API is untouched.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CLI_TEMPLATE = path.join(ROOT, 'node_modules/@capacitor/cli/dist/util/template.js');
const EXPO_BIN = path.join(ROOT, 'node_modules/.bin/expo');
const ADMOB_CONSENT_SWIFT = path.join(
  ROOT,
  'node_modules/@capacitor-community/admob/ios/Sources/AdMobPlugin/Consent/ConsentExecutor.swift'
);

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

// ---- PATCH 3 -------------------------------------------------------------
// @capacitor-community/admob@6.2.0 — GoogleUserMessagingPlatform 3.0 Swift
// overlay rename. This runs on every install so Codemagic (which does a
// clean install per build) picks it up automatically.
try {
  if (!fs.existsSync(ADMOB_CONSENT_SWIFT)) {
    // AdMob plugin not installed on this workspace — nothing to patch.
    log('skipping UMP rename: @capacitor-community/admob not installed');
  } else {
    const original = fs.readFileSync(ADMOB_CONSENT_SWIFT, 'utf8');

    // Precise renames — Swift overlay identifiers only. Order matters:
    // longer-prefix names first so we do not partially rewrite
    // `UMPConsentInformation` inside `UMPConsentInfo…` etc.
    const RENAMES = [
      ['UMPConsentInformation', 'ConsentInformation'],
      ['UMPConsentStatus',      'ConsentStatus'],
      ['UMPConsentForm',        'ConsentForm'],
      ['UMPFormStatus',         'FormStatus'],
      ['UMPRequestParameters',  'RequestParameters'],
      ['UMPDebugSettings',      'DebugSettings'],
      ['UMPDebugGeography',     'DebugGeography'],
      // PATCH GUARDS — these are documented in the task but not currently
      // referenced by this file. If they are added upstream in a future
      // plugin bump, they will be renamed transparently.
      ['UMPPrivacyOptionsRequirementStatus', 'PrivacyOptionsRequirementStatus'],
    ];

    // Detect whether we've already patched: presence of the new symbols
    // *without* the old ones in the same word-boundary context.
    const oldStillPresent = RENAMES.some(([oldSym]) =>
      new RegExp('\\b' + oldSym + '\\b').test(original)
    );
    const newAlreadyPresent = RENAMES.some(([, newSym]) =>
      new RegExp('\\b' + newSym + '\\b').test(original)
    );

    if (!oldStillPresent && newAlreadyPresent) {
      log('UMP-rename patch already applied — skipped');
    } else {
      // FAIL LOUDLY if NONE of the expected old patterns are present —
      // the upstream file has changed shape and this patch is stale.
      const anyOldFound = RENAMES.slice(0, 7).some(([oldSym]) =>
        new RegExp('\\b' + oldSym + '\\b').test(original)
      );
      if (!anyOldFound) {
        console.error(
          '[postinstall] FATAL: ConsentExecutor.swift no longer contains any of the expected legacy UMP* Swift symbols.\n' +
            '                  The upstream plugin has changed and this patch is stale.\n' +
            '                  Inspect ' + ADMOB_CONSENT_SWIFT + ' and update scripts/postinstall.js.'
        );
        process.exit(1);
      }

      let patched = original;
      const summary = [];
      for (const [oldSym, newSym] of RENAMES) {
        const re = new RegExp('\\b' + oldSym + '\\b', 'g');
        const count = (patched.match(re) || []).length;
        if (count > 0) {
          patched = patched.replace(re, newSym);
          summary.push(`${oldSym} → ${newSym} (${count}×)`);
        }
      }

      // Verification: no legacy Swift-overlay symbol survives.
      for (const [oldSym] of RENAMES) {
        const re = new RegExp('\\b' + oldSym + '\\b');
        if (re.test(patched)) {
          console.error(`[postinstall] FATAL: ${oldSym} still present after rename — patch aborted`);
          process.exit(1);
        }
      }

      fs.writeFileSync(ADMOB_CONSENT_SWIFT, patched);
      log('applied UMP-rename patch to ConsentExecutor.swift:');
      for (const line of summary) log('  • ' + line);
    }
  }
} catch (e) {
  console.error(`[postinstall] FATAL: UMP rename patch failed (${e && e.message})`);
  process.exit(1);
}
