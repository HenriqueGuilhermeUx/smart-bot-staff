import { existsSync, readFileSync, writeFileSync } from 'node:fs'

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
