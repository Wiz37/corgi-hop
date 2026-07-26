#!/usr/bin/env node
/**
 * Corgi Hop — postinstall patcher (rebuilt from scratch, all patches inline).
 *
 * Applies four idempotent patches to node_modules that would otherwise be
 * lost every time a fresh install runs (Codemagic does a clean install per
 * build, so this hook is the only reliable way to persist them):
 *
 *   PATCH 1 — @capacitor/cli tar v7 ESM shim.
 *     The repo pins `tar@7.5.19` via `resolutions` (security fix). tar@7 is
 *     ESM-only and drops the CJS `default` export. Capacitor 6's CLI
 *     (`dist/util/template.js`) still uses `tar.default.extract(...)`, which
 *     throws "Cannot read properties of undefined (reading 'extract')" the
 *     moment you run `npx cap add ios/android` or `npx cap sync`. This
 *     patch makes the require tolerant of both shapes.
 *
 *   PATCH 2 — expo→vite shim.
 *     Supervisor runs `yarn expo start --port 3000`. The real @expo/cli
 *     would launch Metro against an `app/` route tree, but this project is
 *     a Vite + Phaser game with no expo-router files. The shim intercepts
 *     `expo start` and spawns Vite instead. Non-start subcommands
 *     (`expo-doctor`, autolinking, etc.) fall through to the real CLI.
 *
 *   PATCH 3 — @capacitor-community/admob@6.2.0 UMP-3.0 rewrite.
 *     The plugin's ConsentExecutor.swift was written against
 *     GoogleUserMessagingPlatform < 3.0. CocoaPods now resolves UMP 3.x
 *     transitively under Google-Mobile-Ads-SDK 11.3.0, and Xcode 26
 *     rejects the plugin file with:
 *       'UMPConsentStatus' has been renamed to 'ConsentStatus'
 *       'ConsentInformation.sharedInstance' has been renamed to
 *       'ConsentInformation.shared'
 *       'ConsentForm.load(completionHandler:)' has been renamed to
 *       'ConsentForm.load(with:)'
 *       'tagForUnderAgeOfConsent' has been renamed to
 *       'isTaggedForUnderAgeOfConsent'
 *     This patch renames every Swift-overlay identifier the plugin uses.
 *     Objective-C class names (still with `UMP*` prefix) elsewhere are
 *     NOT touched — this patch only ever edits ConsentExecutor.swift.
 *     The plugin's JavaScript-facing API is untouched.
 *
 *   PATCH 4 — HARD verification gate.
 *     Immediately after PATCH 3, we re-read ConsentExecutor.swift and
 *     process.exit(1) if any obsolete Swift form survives. This catches
 *     upstream drift before Xcode is ever invoked, saving a 15-minute
 *     archive failure on Codemagic.
 *
 *  Safety properties (all deliberate):
 *    • Idempotent — a second run skips already-patched files.
 *    • Verifies each target file exists (skips gracefully otherwise).
 *    • Fails LOUDLY (process.exit(1)) if neither the expected legacy nor
 *      the modern forms are present (upstream shape changed).
 *    • Never downloads remote code.
 *    • Never touches game source, corgi artwork, RevenueCat, or the Bone
 *      economy.
 *    • Never commits node_modules.
 *    • Verification gate is scoped strictly to ConsentExecutor.swift so
 *      unrelated Objective-C headers are never falsely rejected.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CLI_TEMPLATE       = path.join(ROOT, 'node_modules/@capacitor/cli/dist/util/template.js');
const EXPO_BIN           = path.join(ROOT, 'node_modules/.bin/expo');
const ADMOB_CONSENT_SWIFT = path.join(
  ROOT,
  'node_modules/@capacitor-community/admob/ios/Sources/AdMobPlugin/Consent/ConsentExecutor.swift'
);

function log(msg) { console.log(`[postinstall] ${msg}`); }
function die(msg) {
  console.error(`[postinstall] FATAL: ${msg}`);
  process.exit(1);
}

// ==========================================================================
// PATCH 1 — @capacitor/cli tar v7 ESM shim
// ==========================================================================
try {
  if (fs.existsSync(CLI_TEMPLATE)) {
    const src = fs.readFileSync(CLI_TEMPLATE, 'utf8');
    const NEEDLE = 'const tar_1 = tslib_1.__importDefault(require("tar"));';
    const PATCH = [
      'const tar_mod = require("tar");',
      '// tar@7 is ESM-only (no default export); tar@6 exposes default. Support both.',
      'const tar_1 = tar_mod && tar_mod.default ? tar_mod : { default: tar_mod };',
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

// ==========================================================================
// PATCH 2 — expo → Vite shim
// ==========================================================================
try {
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

// ==========================================================================
// PATCH 3 — AdMob plugin UMP-3.0 rewrite
// ==========================================================================
// The rewrites live in two arrays:
//   • WORD_RENAMES  — bare Swift identifiers matched with \b word-boundary
//   • LITERAL_RENAMES — substrings containing dots / parens / colons that
//                       are not \b-clean; replaced with plain split/join.
// Order matters (longer names first) so we never partially rewrite a longer
// identifier inside a shorter one.
try {
  if (!fs.existsSync(ADMOB_CONSENT_SWIFT)) {
    log('skipping AdMob UMP patch: @capacitor-community/admob not installed');
  } else {
    const original = fs.readFileSync(ADMOB_CONSENT_SWIFT, 'utf8');

    const WORD_RENAMES = [
      ['UMPConsentInformation',              'ConsentInformation'],
      ['UMPConsentStatus',                   'ConsentStatus'],
      ['UMPConsentForm',                     'ConsentForm'],
      ['UMPFormStatus',                      'FormStatus'],
      ['UMPRequestParameters',               'RequestParameters'],
      ['UMPDebugSettings',                   'DebugSettings'],
      ['UMPDebugGeography',                  'DebugGeography'],
      // Forward-guard (not currently referenced in the file):
      ['UMPPrivacyOptionsRequirementStatus', 'PrivacyOptionsRequirementStatus'],
    ];

    // IMPORTANT: `parameters.tagForUnderAgeOfConsent` is scoped with the
    // `parameters.` prefix so that the Swift METHOD ARGUMENT of the same
    // bare name (still `tagForUnderAgeOfConsent: Bool` in the function
    // signature) is NOT renamed. The RHS variable on the assignment line
    // is likewise preserved:
    //   parameters.tagForUnderAgeOfConsent = tagForUnderAgeOfConsent
    //   →
    //   parameters.isTaggedForUnderAgeOfConsent = tagForUnderAgeOfConsent
    const LITERAL_RENAMES = [
      ['ConsentInformation.sharedInstance',    'ConsentInformation.shared'],
      ['ConsentForm.load(completionHandler:',  'ConsentForm.load(with:'],
      ['parameters.tagForUnderAgeOfConsent',   'parameters.isTaggedForUnderAgeOfConsent'],
    ];

    let currentText = original;

    const oldStillPresent = () =>
      WORD_RENAMES.some(([o])    => new RegExp('\\b' + o + '\\b').test(currentText)) ||
      LITERAL_RENAMES.some(([o]) => currentText.includes(o));
    const newAlreadyPresent = () =>
      WORD_RENAMES.some(([, n])    => new RegExp('\\b' + n + '\\b').test(currentText)) ||
      LITERAL_RENAMES.some(([, n]) => currentText.includes(n));

    if (!oldStillPresent() && newAlreadyPresent()) {
      log('AdMob UMP patch already applied — skipped');
    } else {
      // Fail loudly if NONE of the expected legacy forms exist — upstream
      // has changed shape and this patch is stale.
      const anyOldFound =
        WORD_RENAMES.slice(0, 7).some(([o]) => new RegExp('\\b' + o + '\\b').test(original)) ||
        LITERAL_RENAMES.some(([o]) => original.includes(o));
      if (!anyOldFound) {
        die(
          'ConsentExecutor.swift no longer contains any of the expected legacy UMP*/sharedInstance/\n' +
          '                  completionHandler/tagForUnderAgeOfConsent forms.\n' +
          '                  The upstream @capacitor-community/admob plugin has changed shape\n' +
          '                  and this patch is stale. Inspect ' + ADMOB_CONSENT_SWIFT + '\n' +
          '                  and update scripts/postinstall.js accordingly.'
        );
      }

      const summary = [];

      // (A) word-boundary Swift identifier renames
      for (const [oldSym, newSym] of WORD_RENAMES) {
        const re = new RegExp('\\b' + oldSym + '\\b', 'g');
        const count = (currentText.match(re) || []).length;
        if (count > 0) {
          currentText = currentText.replace(re, newSym);
          summary.push(`${oldSym} → ${newSym} (${count}×)`);
        }
      }

      // (B) literal-substring renames
      for (const [oldStr, newStr] of LITERAL_RENAMES) {
        const count = currentText.split(oldStr).length - 1;
        if (count > 0) {
          currentText = currentText.split(oldStr).join(newStr);
          summary.push(`${oldStr} → ${newStr} (${count}×)`);
        }
      }

      fs.writeFileSync(ADMOB_CONSENT_SWIFT, currentText);
      log('applied AdMob UMP patch to ConsentExecutor.swift:');
      for (const line of summary) log('  • ' + line);
    }

    // ======================================================================
    // PATCH 4 — HARD verification gate (scoped only to ConsentExecutor.swift)
    // ======================================================================
    const finalText = fs.readFileSync(ADMOB_CONSENT_SWIFT, 'utf8');

    const FORBIDDEN = [
      // Explicit forms called out in the tasks:
      { name: 'sharedInstance',                        match: /\bsharedInstance\b/ },
      { name: 'UMPConsentStatus',                      match: /\bUMPConsentStatus\b/ },
      { name: 'UMPPrivacyOptionsRequirementStatus',    match: /\bUMPPrivacyOptionsRequirementStatus\b/ },
      { name: 'ConsentForm.load(completionHandler:',   literal: 'ConsentForm.load(completionHandler:' },
      { name: 'parameters.tagForUnderAgeOfConsent',    literal: 'parameters.tagForUnderAgeOfConsent' },
      // Additional forward-guards for any other legacy UMP* Swift identifier:
      { name: 'UMPConsentInformation',                 match: /\bUMPConsentInformation\b/ },
      { name: 'UMPConsentForm',                        match: /\bUMPConsentForm\b/ },
      { name: 'UMPFormStatus',                         match: /\bUMPFormStatus\b/ },
      { name: 'UMPRequestParameters',                  match: /\bUMPRequestParameters\b/ },
      { name: 'UMPDebugSettings',                      match: /\bUMPDebugSettings\b/ },
      { name: 'UMPDebugGeography',                     match: /\bUMPDebugGeography\b/ },
    ];

    const REQUIRED = [
      'ConsentInformation.shared',
      'ConsentForm.load(with:',
      'parameters.isTaggedForUnderAgeOfConsent',
    ];

    const survivors = FORBIDDEN.filter((f) =>
      f.match ? f.match.test(finalText) : finalText.includes(f.literal)
    );
    if (survivors.length > 0) {
      console.error('[postinstall] FATAL: obsolete Swift forms still present in ConsentExecutor.swift:');
      for (const s of survivors) console.error('                  • ' + s.name);
      die(
        'Xcode compile would fail. Fix scripts/postinstall.js and re-run\n' +
        '                  yarn install before pushing.'
      );
    }

    const missing = REQUIRED.filter((r) => !finalText.includes(r));
    if (missing.length > 0) {
      console.error('[postinstall] FATAL: required modern Swift forms missing from ConsentExecutor.swift:');
      for (const m of missing) console.error('                  • ' + m);
      die('Patch produced an incomplete rewrite — aborting.');
    }

    log('AdMob ConsentExecutor.swift verification passed (no obsolete forms; all required modern forms present)');
  }
} catch (e) {
  die(`AdMob UMP patch failed (${e && e.message})`);
}
