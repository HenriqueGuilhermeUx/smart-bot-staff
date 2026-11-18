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

## Verificação automatizada de voz e captura iOS — 16/11/2026

- O histórico [run #42697832239](https://github.com/HenriqueGuilhermeUx/smart-bot-staff/actions/runs/42697832239) comprovou build unsigned e abertura no simulador iOS para versão anterior do código.
- O workflow na branch draft agora exige `CFBundleIdentifier=br.com.alternativeventures.staff`, captura screenshot após abrir no iPhone virtual e arquiva o arquivo de QA (commit `8b5b7e9`). A imagem ainda requer inspeção visual; não comprova teste de voz.
- O preparo iOS agora executa `scripts/ios/verify-voice-usage-descriptions.mjs` (commits `210eab6` / `b540fcf`), que adiciona e valida `NSMicrophoneUsageDescription` e `NSSpeechRecognitionUsageDescription` no `Info.plist` gerado. A finalidade de ambas é explicar o reconhecimento de comandos de voz em português. O script atua apenas em `ios/App/App/Info.plist` no macOS após `npx cap add/sync ios`; **não altera Android, produção ou credenciais**.
- Os componentes `src/lib/staffVoice.ts` e `src/lib/staffNotifications.ts` fazem uso das permissões nativas de voz e notificações. **A existência de descrições e a compilação não comprovam** prompts funcionais, reconhecimento no iPhone, negação/revogação, não retenção de áudio, disponibilidade do TTS, modo offline e entrega de notificações.
- Testar no iPhone real com microfone negado, autorizado e revogado; Speech Recognition negado; stop/cancel; notificações negadas e autorizadas; privacidade e exclusão de conta. O bundle ID e o cadastro Play/AAB ainda devem ser reconciliados. Não marcar Fase 2 aprovada.

## Permissões no binário e transparência de voz — 16/11/2026

- Commit `d3b396a`: o workflow inspeciona o `Info.plist` do **.app compilado** e exige valores não vazios para `NSMicrophoneUsageDescription` e `NSSpeechRecognitionUsageDescription`. Isso complementa a checagem anterior do `Info.plist` gerado; não constitui prova de concessão/revogação em um iPhone físico.
- Commit `3e0967e`: o aviso de privacidade de voz em `src/components/staff/VoiceButton.tsx` passa a mencionar os serviços de reconhecimento de **iOS, Android e navegador**, inclusive a possibilidade de processamento externo ao dispositivo. A UI é compartilhada entre plataformas: somente revisar/mesclar após verificar regressões Android/web. O áudio bruto ainda não foi auditado em serviços terceiros.
- [Workflow desta atualização](https://github.com/HenriqueGuilhermeUx/smart-bot-staff/actions/runs/43894954693) iniciado no GitHub. Status de CI pós-ajuste precisa ser conferido antes de aprovação.
- Não houve assinatura Apple, TestFlight, mudança em produção, emissão de certificados nem homologação funcional de voz no aparelho.
