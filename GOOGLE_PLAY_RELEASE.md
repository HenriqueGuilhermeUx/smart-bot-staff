# Staff — Google Play Release

Aplicativo: **Staff: Assistente com IA**  
Nome no aparelho: **Staff**  
Package Android: `br.com.alternativeventures.staff`  
Versão: `2.2.1`  
Version code: `23`

## URLs públicas obrigatórias

- Política de Privacidade: `https://app.smartbots.club/privacy.html`
- Exclusão de conta: `https://app.smartbots.club/account-deletion.html`
- Termos de Uso: `https://app.smartbots.club/terms.html`

A exclusão está disponível de duas formas:

1. dentro do app em `Mais → Configurações → Excluir conta e dados`, com exclusão autenticada;
2. pela página pública, com formulário real registrado pelo Netlify para usuários sem acesso ao app.

## Variáveis públicas do Supabase

O workflow não gera APK ou AAB se nenhuma chave pública estiver configurada. Em **GitHub → Settings → Secrets and variables → Actions**, cadastre uma destas opções:

```text
VITE_SUPABASE_PUBLISHABLE_KEY
```

ou, para compatibilidade:

```text
VITE_SUPABASE_ANON_KEY
```

A URL do projeto já está definida no workflow:

```text
https://dgtpfvjnuroxgamghicd.supabase.co
```

Nunca use `SUPABASE_SECRET_KEY`, `service_role` ou outra chave secreta no frontend ou no APK.

## Segredos de assinatura permanente

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

A chave permanente de upload não pode ser perdida, alterada ou enviada ao repositório. Guarde o `.jks`, alias e senhas em pelo menos dois locais seguros.

## Como gerar

```text
Actions → Build Staff Android Release → Run workflow → main
```

Artefatos esperados:

- `staff-android-debug-2.2.1`: APK para teste;
- `staff-google-play-release-2.2.1`: APK release e AAB assinados com a chave permanente;
- `staff-ci-release-not-for-play-2.2.1`: somente validação técnica quando os segredos de assinatura não existem;
- `staff-google-play-images-2.2.1`: ícone 512×512, feature graphic 1024×500 e splash.

O arquivo correto para envio à Play é:

```text
staff-google-play-release-2.2.1/app-release.aab
```

## Identidade da ficha

A cópia completa está em `GOOGLE_PLAY_LISTING_PT_BR.md`.

- Nome: `Staff: Assistente com IA`
- Descrição curta: `Organize agenda, tarefas e rotinas com voz e inteligência artificial.`
- Categoria: `Produtividade`
- Desenvolvedor: `Alternative Ventures Ltda`

## Permissões declaradas

- `android.permission.RECORD_AUDIO`: comando de voz iniciado pelo usuário;
- `android.permission.SCHEDULE_EXACT_ALARM`: lembretes locais programados;
- notificações conforme a versão do Android.

O Staff não armazena áudio bruto. A transcrição pode usar o serviço de voz configurado no aparelho.

## Testes antes da publicação

1. instalar o APK debug em Android real;
2. testar cadastro, login e persistência no Supabase;
3. permitir microfone e testar comandos de agenda e tarefas;
4. testar respostas faladas nos três modos;
5. testar notificações e lembretes;
6. testar exclusão de conta com uma conta descartável;
7. enviar o AAB primeiro para teste interno ou fechado;
8. capturar screenshots exclusivamente do APK real.
