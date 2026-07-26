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
// overlay rewrite. UMP 3.0 renamed the Swift overlay identifiers AND changed
// two singleton / closure-label conventions:
//   • ConsentInformation.sharedInstance → ConsentInformation.shared
//   • ConsentForm.load(completionHandler:) → ConsentForm.load(with:)
// The plugin source (frozen at 6.2.0) still uses the pre-3.0 forms, so
// Codemagic's Xcode 26 archive fails at the Swift compile stage. This
// runs on every install so a clean CI install picks it up automatically.
try {
  if (!fs.existsSync(ADMOB_CONSENT_SWIFT)) {
    // AdMob plugin not installed on this workspace — nothing to patch.
    log('skipping UMP rename: @capacitor-community/admob not installed');
  } else {
    const original = fs.readFileSync(ADMOB_CONSENT_SWIFT, 'utf8');

    // -------------------------------------------------------------------
    // (A) Word-boundary Swift overlay renames. Order matters: longer names
    //     first so partial-prefix collisions are impossible.
    const WORD_RENAMES = [
      ['UMPConsentInformation', 'ConsentInformation'],
      ['UMPConsentStatus',      'ConsentStatus'],
      ['UMPConsentForm',        'ConsentForm'],
      ['UMPFormStatus',         'FormStatus'],
      ['UMPRequestParameters',  'RequestParameters'],
      ['UMPDebugSettings',      'DebugSettings'],
      ['UMPDebugGeography',     'DebugGeography'],
      // Not currently referenced by the file — forward-guard for future
      // plugin bumps that may introduce Privacy-Options Requirement checks.
      ['UMPPrivacyOptionsRequirementStatus', 'PrivacyOptionsRequirementStatus'],
    ];

    // (B) Literal-substring renames — these contain dots / parens / colons
    //     that are not \\b-clean, so we use plain replaceAll instead of a
    //     regex.
    const LITERAL_RENAMES = [
      // Singleton accessor rename in UMP 3.0.
      ['ConsentInformation.sharedInstance', 'ConsentInformation.shared'],
      // Closure argument-label rename in UMP 3.0.
      ['ConsentForm.load(completionHandler:', 'ConsentForm.load(with:'],
    ];

    // -------------------------------------------------------------------
    // Idempotency: patched-already if none of the OLD forms remain AND at
    // least one of the NEW forms is present.
    const anyOldRemaining = () =>
      WORD_RENAMES.some(([o]) => new RegExp('\\b' + o + '\\b').test(currentText)) ||
      LITERAL_RENAMES.some(([o]) => currentText.includes(o));
    const anyNewPresent = () =>
      WORD_RENAMES.some(([, n]) => new RegExp('\\b' + n + '\\b').test(currentText)) ||
      LITERAL_RENAMES.some(([, n]) => currentText.includes(n));

    let currentText = original;

    if (!anyOldRemaining() && anyNewPresent()) {
      log('AdMob UMP patch already applied — skipped');
    } else {
      // FAIL LOUDLY if none of the expected legacy forms are present in
      // the file. That means upstream has changed shape and this patch is
      // stale.
      const anyOldFound =
        WORD_RENAMES.slice(0, 7).some(([o]) => new RegExp('\\b' + o + '\\b').test(original)) ||
        LITERAL_RENAMES.some(([o]) => original.includes(o));
      if (!anyOldFound) {
        console.error(
          '[postinstall] FATAL: ConsentExecutor.swift no longer contains any of the expected\n' +
            '                  legacy UMP* Swift symbols nor .sharedInstance / .load(completionHandler:).\n' +
            '                  The upstream plugin has changed shape and this patch is stale.\n' +
            '                  Inspect ' + ADMOB_CONSENT_SWIFT + ' and update scripts/postinstall.js.'
        );
        process.exit(1);
      }

      const summary = [];

      // Apply (A) word renames.
      for (const [oldSym, newSym] of WORD_RENAMES) {
        const re = new RegExp('\\b' + oldSym + '\\b', 'g');
        const count = (currentText.match(re) || []).length;
        if (count > 0) {
          currentText = currentText.replace(re, newSym);
          summary.push(`${oldSym} → ${newSym} (${count}×)`);
        }
      }

      // Apply (B) literal renames.
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

    // -------------------------------------------------------------------
    // (C) HARD VERIFICATION GATE — fail the install BEFORE Xcode is ever
    //     invoked if any obsolete Swift form remains in ConsentExecutor.
    //     Scoped strictly to this one .swift file so unrelated Objective-C
    //     headers elsewhere in the plugin are never falsely rejected.
    const finalText = fs.readFileSync(ADMOB_CONSENT_SWIFT, 'utf8');
    const FORBIDDEN = [
      { name: 'sharedInstance',                    match: /\bsharedInstance\b/ },
      { name: 'UMPConsentStatus',                  match: /\bUMPConsentStatus\b/ },
      { name: 'UMPPrivacyOptionsRequirementStatus', match: /\bUMPPrivacyOptionsRequirementStatus\b/ },
      { name: 'ConsentForm.load(completionHandler:', literal: 'ConsentForm.load(completionHandler:' },
      // Forward-guard: catch any other legacy UMP* Swift identifiers
      // that appear if the plugin file ever changes.
      { name: 'UMPConsentInformation',             match: /\bUMPConsentInformation\b/ },
      { name: 'UMPConsentForm',                    match: /\bUMPConsentForm\b/ },
      { name: 'UMPFormStatus',                     match: /\bUMPFormStatus\b/ },
      { name: 'UMPRequestParameters',              match: /\bUMPRequestParameters\b/ },
      { name: 'UMPDebugSettings',                  match: /\bUMPDebugSettings\b/ },
      { name: 'UMPDebugGeography',                 match: /\bUMPDebugGeography\b/ },
    ];
    const survivors = FORBIDDEN.filter((f) =>
      f.match ? f.match.test(finalText) : finalText.includes(f.literal)
    );
    if (survivors.length > 0) {
      console.error('[postinstall] FATAL: obsolete Swift forms still present in ConsentExecutor.swift:');
      for (const s of survivors) console.error('                  • ' + s.name);
      console.error(
        '                  Xcode compile would fail. Fix scripts/postinstall.js\n' +
          '                  and re-run yarn install before pushing.'
      );
      process.exit(1);
    }
    log('AdMob ConsentExecutor.swift verification passed (no obsolete forms)');
  }
} catch (e) {
  console.error(`[postinstall] FATAL: AdMob UMP patch failed (${e && e.message})`);
  process.exit(1);
}
