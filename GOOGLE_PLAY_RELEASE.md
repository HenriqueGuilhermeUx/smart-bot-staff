# Staff — Google Play Release 2.3.0

Aplicativo: **Staff: Assistente com IA**  
Nome no aparelho: **Staff**  
Package Android: `br.com.alternativeventures.staff`  
Versão: `2.3.0`  
Version code: `26`

## URLs públicas

- Política de Privacidade: `https://app.smartbots.club/privacy.html`
- Exclusão de conta: `https://app.smartbots.club/account-deletion.html`
- Termos de Uso: `https://app.smartbots.club/terms.html`

## Supabase

Project URL usado pelo Android:

```text
https://mkwkljnfaqszvcjzhajn.supabase.co
```

No GitHub Actions, deve existir `VITE_SUPABASE_PUBLISHABLE_KEY` ou `VITE_SUPABASE_ANON_KEY`. Nunca use service role no frontend ou APK.

Para ativar Família, Desafios Kids, Estudos e Progresso, execute no SQL Editor do Supabase:

```text
supabase/migrations/20260819_staff_family_studies_v1.sql
```

A migração cria tabelas com RLS e o bucket privado `staff-study-materials`.

## Netlify / Estudos

A função Estudos usa as variáveis de servidor já protegidas:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY)
OPENAI_API_KEY
```

Opcional:

```text
OPENAI_STUDY_MODEL=gpt-5-mini
```

A função de análise nunca deve receber uma chave OpenAI no app. O responsável envia o material ao backend autenticado, que chama o provedor de IA.

## Assinatura Android

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

## Como validar a PR

A abertura de PR contra `main` executa o workflow `Staff Android Release 2.3.0`, com:

- instalação das dependências;
- TypeScript;
- validação do Supabase;
- build web;
- geração Android;
- APK debug;
- compilação do AAB release sem publicação.

## Como gerar o AAB definitivo

Após merge em `main`:

```text
Actions → Staff Android Release 2.3.0 → Run workflow → main
```

Artefatos esperados:

- `staff-android-debug-2.3.0` — APK para teste;
- `staff-google-play-release-2.3.0` — AAB assinado para Google Play;
- `staff-family-studies-sql-2.3.0` — migração do banco.

Arquivo correto para a Play:

```text
staff-google-play-release-2.3.0/app-release.aab
```

## Escopo 2.3.0

- correção de voz Android já validada em aparelho real;
- Staff Família com perfis infantis administrados pelo responsável;
- Desafios Kids em quatro faixas etárias;
- TTS para atividades selecionadas;
- sessões de 5, 10 ou 15 minutos;
- PIN parental para mais tempo ou saída da sessão;
- Estudos por foto/PDF;
- resumo, texto, pontos-chave, perguntas e flashcards;
- biblioteca por filho;
- histórico de desafios, estudos e progresso;
- exclusão de conta atualizada para remover dados e arquivos da Família.

## Testes obrigatórios antes da Play

1. instalar `app-debug.apk` em Android real;
2. testar login e persistência;
3. testar voz Android e retorno da interface nativa;
4. executar a migração e cadastrar um perfil de filho;
5. criar PIN e completar uma sessão de Desafios Kids;
6. confirmar bloqueio por PIN no fim da sessão;
7. fotografar uma página escolar e gerar estudo;
8. testar PDF;
9. completar perguntas e validar progresso;
10. excluir um material;
11. excluir uma conta descartável e confirmar remoção dos dados e arquivos;
12. revisar na Play Console Público-alvo e conteúdo e Segurança dos dados para as novas funções familiares;
13. enviar primeiro para teste interno/fechado.
