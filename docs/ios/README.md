# Staff — iOS preparation

Existing Capacitor app: `br.com.alternativeventures.staff`; Capacitor major: 8; web build: `npm run build` → `dist`.

## Mac build workflow (not executed)
1. Install Node, Xcode, and CocoaPods where needed.
2. `npm ci`
3. `npm install --save-exact @capacitor/ios@8.4.1` (review and commit lockfile in a separate validated change).
4. `npm run build`
5. `npx cap add ios` if absent; otherwise `npx cap sync ios`.
6. `npx cap open ios`; configure team and signing, then device testing.

## Native iOS verification
- Validate speech recognition/synthesis packages on iOS, microphone and speech-usage descriptions, prompts and refusal paths.
- Check local notifications permissions and user flows.
- Check sign-in, messaging, user data deletion, privacy policy, account deletion and support.
- Use real device screenshots; do not submit a simple web-wrapper lacking native usability.
- Never commit signing credentials. No TestFlight upload or App Store submission performed.

## Automated local preparation

After installing the matching `@capacitor/ios` package and checking its lockfile, run `node scripts/prepare-ios.mjs` from the repository root on macOS with Xcode installed. The script refuses non-macOS execution and missing iOS dependencies; it builds the correct web assets then creates/synchronizes the local Capacitor iOS project. It does **not** sign, archive, run device tests or submit anything to Apple.
