import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nuur.islamicapp',
  appName: 'NUUR',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
