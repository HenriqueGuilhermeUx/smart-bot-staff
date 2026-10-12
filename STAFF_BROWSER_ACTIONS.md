# Staff Browser Actions V1

## Objetivo

Transformar pedidos explícitos do usuário em ações web controladas. A primeira capacidade é reserva simples de restaurante por texto ou voz.

Exemplo:

> "Reserve uma mesa amanhã às 20h para 2 pessoas no restaurante X."

## Fluxo V1

1. O Staff identifica intenção de reserva.
2. O backend autentica a sessão e registra a ação em `staff_web_actions`.
3. Uma execução Browser Use V4 faz somente a descoberta: restaurante, canal oficial/provedor, disponibilidade e URL final.
4. Nenhum nome, e-mail ou telefone é enviado durante a descoberta.
5. Se o horário pedido não existir, o Staff oferece até 3 alternativas e aguarda a escolha do usuário.
6. Para concluir uma reserva simples, uma nova execução V4 recebe apenas bindings de nome, e-mail e telefone, limitados ao host da URL de reserva.
7. O Browser Use digita os bindings sem revelar seus valores ao agente.
8. Pagamento, depósito, cartão, login, criação de conta, OTP/2FA e aceite jurídico especial interrompem a automação.
9. Ao concluir, o Staff registra a confirmação e tenta criar o compromisso na Agenda.
10. O browser é localizado pelo `agentSessionId`, parado explicitamente e a sessão do agente é arquivada.

## Segurança

- `BROWSER_USE_API_KEY` existe somente no servidor/Netlify Functions.
- Browser Use API V4.
- `secretBindings` são run-scoped e limitados ao host final da reserva.
- A fase de descoberta não recebe dados pessoais de contato.
- Gravação do browser desativada.
- Conteúdo das páginas é tratado como dado não confiável.
- Uma ação web por usuário por vez.
- Limite de 10 inícios por usuário a cada 24h na V1.
- Teto de custo por fase:
  - descoberta: US$ 0,35;
  - reserva: US$ 0,45.
- O backend não envia cartão, senha, OTP ou credenciais bancárias.
- `staff_web_actions` é uma trilha operacional e não deve armazenar segredos.

## Dados para reserva

O usuário pode configurar em Ajustes → Ações na web:

- nome para reservas;
- telefone para reservas;
- ativar/desativar ações na web.

O e-mail vem da conta autenticada do Staff.

## Banco

Migration:

`supabase/migrations/20261011_staff_browser_actions_v1.sql`

Principais objetos:

- `staff_profiles.reservation_name`
- `staff_profiles.reservation_phone`
- `staff_profiles.web_actions_enabled`
- `staff_web_actions`

RLS permite que o usuário leia apenas sua própria trilha. Escritas da trilha são feitas pelo backend autenticado com credencial de servidor.

## Variável externa necessária

No Netlify, configurar como segredo de servidor:

`BROWSER_USE_API_KEY`

Nunca prefixar com `VITE_` e nunca expor no frontend.

## Antes de produção

- validar uma reserva real sem pagamento;
- validar horário indisponível → alternativas;
- validar restaurante ambíguo;
- validar bloqueio em pagamento/login/OTP;
- validar criação do evento na Agenda;
- validar cancelamento;
- revisar custos reais por reserva;
- manter o PR como draft até esses testes passarem.
