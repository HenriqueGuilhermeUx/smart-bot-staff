# Staff — Google Play Release

Aplicativo: **Staff — Assistente Pessoal com IA**  
Package Android: `br.com.alternativeventures.staff`  
Versão desta entrega: `2.2.0`  
Version code: `22`

## Artefatos gerados pelo GitHub Actions

O workflow `.github/workflows/build-android-debug.yml` gera:

- `staff-android-debug-2.2.0`: APK para instalação e testes;
- `staff-google-play-release-2.2.0`: APK release e AAB assinados com a chave permanente;
- `staff-ci-release-not-for-play-2.2.0`: APK/AAB assinados apenas para validação técnica quando os segredos permanentes ainda não existem;
- `staff-google-play-images-2.2.0`: ícone 512×512, feature graphic 1024×500 e splash 2732×2732.

## Segredos obrigatórios para o AAB definitivo

Em **GitHub → Settings → Secrets and variables → Actions → New repository secret**, criar:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

`ANDROID_KEYSTORE_BASE64` deve conter o conteúdo Base64, em uma única linha, do arquivo `.jks` permanente.

No Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("staff-upload-key.jks")) | Set-Clipboard
```

No Linux/macOS:

```bash
base64 -w 0 staff-upload-key.jks
```

Depois de criar os quatro segredos, execute:

```text
Actions → Build Staff Android Release → Run workflow → main
```

O artefato correto para a Play será:

```text
staff-google-play-release-2.2.0/app-release.aab
```

## Regra crítica

A chave permanente de upload não pode ser perdida, alterada ou colocada no repositório. Guarde o arquivo `.jks`, o alias e as senhas em pelo menos dois locais seguros.

O arquivo `staff-ci-release-not-for-play` nunca deve ser enviado à Google Play.

## Permissões declaradas

- `android.permission.RECORD_AUDIO`: reconhecimento de comandos de voz iniciado pelo usuário;
- `android.permission.SCHEDULE_EXACT_ALARM`: lembretes locais programados;
- notificações conforme a versão do Android.

O Staff não salva o áudio bruto. A transcrição pode ser processada localmente ou pelo serviço de voz configurado no aparelho.

## URLs públicas

- Política de privacidade: `https://app.smartbots.club/privacy.html`
- Exclusão de conta: `https://app.smartbots.club/account-deletion.html`

## Testes mínimos antes da publicação

1. instalar o APK debug em Android real;
2. permitir microfone;
3. falar: “Agende consulta amanhã às 14h e me avise 30 minutos antes”;
4. confirmar criação do evento e lembrete;
5. falar: “O que eu tenho hoje?”;
6. falar: “Abra minhas automações”;
7. testar respostas faladas nos três modos de configuração;
8. testar criação, edição e exclusão de evento;
9. testar exclusão de conta;
10. enviar o AAB para teste interno ou fechado antes da produção.
