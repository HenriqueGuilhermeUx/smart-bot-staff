import { existsSync, readFileSync, writeFileSync } from 'node:fs'

// This patch is needed only when generating the native Android project.
// Do not mutate dependencies during Netlify/web installs.
if (process.env.NETLIFY === 'true') {
  console.log('[staff] Netlify web build detected; skipping Android speech manifest patch.')
  process.exit(0)
}

if (process.env.GITHUB_ACTIONS !== 'true' && process.env.STAFF_ANDROID_BUILD !== 'true') {
  console.log('[staff] Non-Android CI install detected; skipping speech manifest patch.')
  process.exit(0)
}

const manifestPath = 'node_modules/@capgo/capacitor-speech-recognition/android/src/main/AndroidManifest.xml'

if (!existsSync(manifestPath)) {
  console.warn('[staff] Speech recognition AndroidManifest not found; skipping patch.')
  process.exit(0)
}

let manifest = readFileSync(manifestPath, 'utf8')

if (!manifest.includes('android.speech.RecognitionService')) {
  const queries = `
    <queries>
        <intent>
            <action android:name="android.speech.RecognitionService" />
        </intent>
    </queries>
`

  manifest = manifest.replace('</manifest>', `${queries}</manifest>`)
  writeFileSync(manifestPath, manifest, 'utf8')
  console.log('[staff] Added RecognitionService package visibility query to speech plugin manifest.')
} else {
  console.log('[staff] RecognitionService package visibility query already present.')
}
