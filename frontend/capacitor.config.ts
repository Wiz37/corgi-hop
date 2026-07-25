import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.corgihop.game',
  appName: 'Corgi Hop',
  webDir: 'dist',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'always',
    backgroundColor: '#3fa7ff',
  },
  android: {
    backgroundColor: '#3fa7ff',
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    AdMob: {
      // Test-mode by default in dev builds. Production IDs supplied via env at build time.
      requestTrackingAuthorization: true,
      testingDevices: [],
      initializeForTesting: true,
    },
  },
};

export default config;
