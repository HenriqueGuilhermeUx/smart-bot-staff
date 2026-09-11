# Staff Smart Inbox

> **“Envie uma foto, PDF, recibo, nota, boleto ou documento. O Staff entende, organiza e age.”**

## Objetivo

O Smart Inbox é uma capacidade nativa do Staff. Ele não cria uma aplicação paralela: reutiliza a autenticação Supabase, o Storage privado, a bridge Android→Netlify, a memória, Tarefas, Agenda, notificações e o assistente IA já existentes.

Fluxo principal:

```text
foto / PDF / documento
        ↓
upload privado
        ↓
DocumentExtractionProvider
        ↓
classificação + extração estruturada
        ↓
normalização + confidence + dedupe
        ↓
revisão obrigatória do usuário
        ↓
finanças / lembrete / memória / pessoa / agenda / arquivo
```

Ações financeiras nunca são executadas automaticamente.

## Tipos iniciais

- `RECEIPT`
- `INVOICE`
- `BILL`
- `BANK_RECEIPT`
- `CONTRACT`
- `WARRANTY`
- `IDENTITY_DOCUMENT`
- `MEDICAL_DOCUMENT`
- `OTHER`

A lista fica centralizada no schema e no provider, permitindo adicionar novos tipos posteriormente.

## Schema normalizado

A extração retorna, com campos opcionais/nulos quando não houver evidência suficiente:

```json
{
  "documentType": "RECEIPT",
  "title": "Compra no Mercado XPTO",
  "issuer": "Mercado XPTO",
  "issuerDocument": null,
  "recipient": null,
  "documentNumber": "12345",
  "issueDate": "2026-09-10",
  "dueDate": null,
  "totalAmount": 138.90,
  "currency": "BRL",
  "paymentMethod": "cartão",
  "items": [],
  "parties": [],
  "obligations": [],
  "summary": "...",
  "rawText": "...",
  "confidence": 0.96,
  "sourceFile": {},
  "metadata": {}
}
```

## Providers

Contrato:

```ts
interface DocumentExtractionProvider {
  name: string
  external: boolean
  extract(input: DocumentProviderInput): Promise<Record<string, unknown>>
}
```

Implementações:

- `InternalAIProvider`: usa a API server-side já empregada pelo Staff para IA;
- `MockProvider`: determinístico, sem envio externo, destinado a desenvolvimento/testes;
- `DocStructProvider`: adapter opcional para um fornecedor configurado por URL/chave.

Seleção:

```env
STAFF_DOCUMENT_PROVIDER=internal_ai
```

Nenhuma chave de provider é enviada ao frontend.

## Privacidade de documentos sensíveis

Antes do upload o usuário deve classificar o arquivo como:

- documento comum;
- identidade;
- saúde.

`identity` e `medical` **não são enviados a provider externo por padrão**. Para permitir o processamento externo precisam existir simultaneamente:

1. `STAFF_ALLOW_SENSITIVE_EXTERNAL_PROCESSING=true` no servidor; e
2. consentimento explícito do usuário para aquele arquivo.

Sem essas duas condições, o arquivo pode ser guardado no Storage privado e revisado manualmente, mas o backend recusa a extração externa.

## Storage

Bucket: `staff-documents`

- privado;
- limite: 12 MB;
- políticas por `auth.uid()` no primeiro segmento do path;
- originais são abertos com signed URL temporária de 120 segundos;
- nenhum arquivo recebe URL pública permanente.

Path:

```text
staff-documents/{user_id}/{document_id}/{timestamp}-{filename}
```

## Banco

Migration:

```text
supabase/migrations/20260910_staff_smart_inbox_v1.sql
```

Cria:

- `staff_documents` — documento, extração e status;
- `staff_financial_entries` — ledger financeiro estruturado;
- `staff_document_actions` — trilha das ações confirmadas;
- `staff_document_links` — vínculos, inicialmente pessoa;
- `staff_telemetry_events` — observabilidade sem conteúdo documental;
- `staff_telemetry_daily` — visão agregada para integração futura com AV OS;
- `staff-documents` — bucket privado;
- `staff_memories.source_document_id` — origem documental da memória.

## Duplicidade

O backend calcula uma impressão digital preferindo:

```text
issuer + totalAmount + issueDate/dueDate + documentNumber
```

Quando esses dados não existem, usa o SHA-256 do arquivo como fallback.

Antes de criar um lançamento financeiro, o frontend verifica:

- `source_document_id` atual;
- `duplicate_of` detectado no Smart Inbox;
- `dedupe_fingerprint`.

Se já existir lançamento correspondente, informa o usuário e não duplica a despesa.

## Smart Actions

Após revisar e confirmar os dados:

- **Registrar despesa** — cria `staff_financial_entries` para recibo/nota/comprovante;
- **Criar lembrete** — reutiliza `staff_tasks` + notificações atuais;
- **Salvar documento** — arquiva o documento;
- **Adicionar à memória** — usa `staff_memories` com `source_document_id`;
- **Vincular a uma pessoa** — usa `staff_document_links`;
- **Adicionar compromisso** — reutiliza `staff_events` + lembretes da Agenda;
- **Ignorar** — mantém a trilha sem criar ações.

Garantias sugerem lembrete 30 dias antes; outros vencimentos usam 3 dias como padrão inicial.

## Assistente e voz

A conversa do Staff consulta somente documentos `confirmed`/`archived` e recebe **fatos estruturados**, nunca o arquivo bruto ou `raw_text` completo.

Quando uma resposta factual depende de documento, o prompt exige:

```text
Fonte documental: <título do documento>
```

Comandos de voz preparados incluem:

- “Staff, lança essa nota.”
- “Staff, quando vence isso?”
- “Guarda esse contrato.”
- “Quanto eu paguei nesse produto?”
- “Me lembra antes dessa garantia vencer.”

Comandos de ação documental abrem o Smart Inbox; não pulam a etapa de revisão/confirmação.

## Observabilidade e AV OS

Eventos permitidos:

- `document.uploaded`
- `document.classified`
- `document.extracted`
- `document.confirmed`
- `financial_entry.created_from_document`
- `reminder.created_from_document`

As propriedades passam por allowlist. Não são enviados para a telemetria:

- `raw_text`;
- imagem/PDF;
- emissor/partes;
- número de documento;
- itens;
- valores individuais;
- conteúdo da memória.

`staff_telemetry_daily` fornece somente `user_id`, dia, nome do evento e contagem. Uma integração futura com AV OS deve exportar apenas agregados e pode anonimizar/remover `user_id` antes do envio externo.

## Endpoints

### `POST /.netlify/functions/staff-document-analyze`

Requer `Authorization: Bearer <Supabase access token>`.

Body:

```json
{
  "document_id": "uuid",
  "sensitive_processing_consent": false
}
```

O arquivo é baixado pelo backend diretamente do Storage privado e só então enviado ao provider autorizado.

### Endpoints reutilizados

- `staff-chat-v2` — memória/conversa enriquecida com documentos confirmados;
- `delete-account` — também apaga Smart Inbox, ledger, telemetria e arquivos privados.

## Variáveis

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
OPENAI_API_KEY=
OPENAI_DOCUMENT_MODEL=gpt-5-mini
STAFF_DOCUMENT_PROVIDER=internal_ai
STAFF_ALLOW_SENSITIVE_EXTERNAL_PROCESSING=false
DOCSTRUCT_API_URL=
DOCSTRUCT_API_KEY=
```

`DOCSTRUCT_*` só é necessário quando `STAFF_DOCUMENT_PROVIDER=docstruct`.

## Testes

```bash
npm run test:smart-inbox
npm run typecheck
npm run build
```

O CI também empacota `staff-document-analyze.mts` com esbuild, valida Functions e compila o Android.

## Exclusão

A exclusão da conta remove primeiro:

- arquivos de `staff-documents`;
- arquivos de `staff-study-materials`;

Depois remove as tabelas associadas e finalmente a conta de autenticação. Assim não ficam objetos privados órfãos no Storage.
