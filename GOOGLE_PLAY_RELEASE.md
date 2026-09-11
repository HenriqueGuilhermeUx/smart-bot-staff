# Staff — Google Play Release

Aplicativo: **Staff: Assistente com IA**  
Nome no aparelho: **Staff**  
Package Android: `br.com.alternativeventures.staff`

## URLs públicas

- Política de Privacidade: `https://app.smartbots.club/privacy.html`
- Exclusão de conta: `https://app.smartbots.club/account-deletion.html`
- Termos de Uso: `https://app.smartbots.club/terms.html`

## Supabase

O Android usa a URL pública do projeto Staff no formato:

```text
https://<PROJECT_REF>.supabase.co
```

No GitHub Actions, o workflow monta essa URL a partir do project ref público e exige `VITE_SUPABASE_PUBLISHABLE_KEY` ou `VITE_SUPABASE_ANON_KEY`. Nunca use service role no frontend ou APK.

As migrations ficam em `supabase/migrations/` e devem ser executadas no projeto Supabase do Staff antes de publicar a capacidade correspondente.

## Netlify / IA

As Functions usam variáveis de servidor protegidas:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY)
OPENAI_API_KEY
```

Modelos opcionais:

```text
OPENAI_STUDY_MODEL=gpt-5-mini
OPENAI_DOCUMENT_MODEL=gpt-5-mini
```

Smart Inbox:

```text
STAFF_DOCUMENT_PROVIDER=internal_ai
STAFF_ALLOW_SENSITIVE_EXTERNAL_PROCESSING=false
```

A aplicação cliente nunca recebe chave OpenAI ou service role.

## Assinatura Android

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

## Release 2.4.0

Version code: `31`

Artefatos esperados:

- `staff-android-debug-2.4.0` — APK para teste;
- `staff-google-play-release-2.4.0` — AAB assinado para Google Play;
- `staff-smart-inbox-sql-2.4.0` — migration do Smart Inbox.

Arquivo correto para a Play:

```text
staff-google-play-release-2.4.0/app-release.aab
```

### Escopo 2.4.0

- Smart Inbox nativo;
- câmera/upload privado;
- classificação e extração estruturada;
- revisão antes de ações;
- ledger financeiro do Staff;
- deduplicação;
- agenda e lembretes a partir de documentos;
- memória com fonte documental;
- proteção reforçada para identidade e saúde;
- telemetria agregada sem conteúdo documental;
- manutenção das funções de voz, Família, Desafios Kids, Estudos e recuperação de senha.
