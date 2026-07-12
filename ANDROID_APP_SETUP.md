# Staff Android

## Identidade do aplicativo

- Nome: **Staff**
- Nome de loja: **Staff — Assistente Pessoal com IA**
- Application ID: `br.com.alternativeventures.staff`
- Responsável: **Alternative Ventures Ltda**
- CNPJ: **61.920.356/0001-38**

## O que já está configurado

- Capacitor 8;
- projeto preparado para Android;
- build web copiado da pasta `dist`;
- lembretes com notificações locais no aparelho;
- permissão de notificações no Android 13+;
- agendamento de lembretes mesmo com o aplicativo fechado;
- workflow do GitHub para gerar APK de teste.

## Variáveis necessárias no GitHub

No repositório, abra:

`Settings → Secrets and variables → Actions → New repository secret`

Crie:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use os mesmos valores configurados no Netlify do Staff.

## Gerar APK de teste sem terminal

1. Abra a aba **Actions** do repositório.
2. Abra **Build Staff Android Debug**.
3. Clique em **Run workflow**.
4. Aguarde a execução concluir.
5. Abra a execução concluída.
6. Em **Artifacts**, baixe `staff-android-debug`.
7. Extraia o ZIP e instale `app-debug.apk` em um celular Android para teste.

## Comandos disponíveis para desenvolvimento local

```bash
npm install
npm run android:init
npm run android:open
```

Depois da primeira criação do projeto Android:

```bash
npm run android:sync
```

## Próxima etapa para Google Play

- gerar ícones e splash screen finais;
- criar política de privacidade e termos;
- criar chave de assinatura;
- configurar secrets da assinatura;
- gerar Android App Bundle `.aab`;
- criar ficha do aplicativo na Play Console;
- iniciar teste fechado.
