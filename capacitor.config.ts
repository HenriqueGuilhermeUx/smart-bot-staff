/// <reference types="@capacitor/local-notifications" />

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'br.com.alternativeventures.staff',
  appName: 'Staff',
  webDir: 'dist',
  backgroundColor: '#050816',
  loggingBehavior: 'debug',
  android: {
    backgroundColor: '#050816',
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#a855f7',
    },
  },
}

export default config
