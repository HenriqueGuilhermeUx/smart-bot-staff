/// <reference types="@capacitor/local-notifications" />

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'br.com.alternativeventures.staff',
  appName: 'Staff',
  webDir: 'dist',
  backgroundColor: '#050816',
  loggingBehavior: 'production',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#050816',
    allowMixedContent: false,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    LocalNotifications: {
      iconColor: '#a855f7',
    },
  },
}

export default config
