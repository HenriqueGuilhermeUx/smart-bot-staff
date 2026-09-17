# Staff ↔ NexOffice Business Bridge

O bridge `netlify/functions/nexoffice-assistant.mts` permite que o NexOffice use o Staff como engine conversacional para contexto **empresarial**.

## Privacidade por desenho

O endpoint não consulta `staff_memories`, `staff_documents`, Smart Inbox, saúde, família ou finanças pessoais do usuário. O único contexto permitido é o snapshot operacional enviado pelo próprio workspace NexOffice na requisição.

Isso evita misturar a memória pessoal do produto Staff com dados corporativos de uma empresa NexOffice.

## Autenticação

A função exige:

- `Authorization: Bearer <segredo de serviço>`
- `X-NexOffice-Workspace-ID: <workspace UUID>`

No runtime do Staff, configure um segredo server-side em `STAFF_NEXOFFICE_SERVICE_KEY`. O valor correspondente fica somente no backend do NexOffice como `STAFF_API_KEY`. Nunca exponha essa credencial no frontend.

## Rotas

A função Netlify é publicada em:

`/.netlify/functions/nexoffice-assistant`

`GET` autenticado retorna health/capabilities do bridge.

`POST` recebe `message`, `conversationHistory`, `agentRole`, `context` e `correlationId`. O `context.workspace.id` deve coincidir com `X-NexOffice-Workspace-ID`.

## Execução

O Staff responde e estrutura próximos passos, mas não executa pagamentos, assinaturas, mensagens, publicações ou outras ações externas. Essas ações continuam pertencendo ao NexOffice Core, com políticas de autonomia, aprovação, Agent Run e Outbox.

## Ativação segura

No NexOffice, `NEXOFFICE_STAFF_BRIDGE_ENABLED` deve permanecer `false` até os dois runtimes terem as credenciais de serviço configuradas e o health probe estar verde. A ativação não exige nem autoriza acesso às memórias pessoais do Staff.

### Gate de rollout

Antes de promover o bridge para uso pela Equipe Digital:

1. Publicar o commit que contém `nexoffice-assistant.mts` no runtime do Staff.
2. Confirmar que o `GET` autenticado do bridge responde `200` e declara o modo de privacidade empresarial.
3. Confirmar no NexOffice que o provider `staff` aparece como `connected` para um workspace controlado.
4. Executar uma conversa controlada e validar que o Staff recebe somente `context.workspace`, `pulse`, prioridades e histórico da conversa empresarial.
5. Somente então alterar `NEXOFFICE_STAFF_BRIDGE_ENABLED=true` no staging.

Se qualquer etapa falhar, o NexOffice deve continuar usando o engine interno e o bridge permanece desligado.
