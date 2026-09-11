# Staff Smart Inbox — QA de release 2.4.0

Checklist antes do merge/publicação.

## Segurança e privacidade
- [x] Autenticação obrigatória para análise.
- [x] Bucket `staff-documents` privado e isolado por `auth.uid()`.
- [x] URLs de leitura temporárias/signed.
- [x] Nenhuma chave de API no frontend.
- [x] Identidade/saúde bloqueadas para provider externo por padrão.
- [x] Consentimento do usuário + flag de servidor exigidos para processamento sensível externo.
- [x] Telemetria permite apenas propriedades agregáveis, sem conteúdo/documento/valor/emissor.
- [x] Exclusão de conta remove arquivos e registros Smart Inbox.

## Document Intelligence
- [x] Tipos iniciais: RECEIPT, INVOICE, BILL, BANK_RECEIPT, CONTRACT, WARRANTY, IDENTITY_DOCUMENT, MEDICAL_DOCUMENT, OTHER.
- [x] Schema normalizado com confidence, itens, partes, obrigações, resumo e rawText.
- [x] Provider interface desacoplada.
- [x] InternalAIProvider.
- [x] DocStructProvider configurável.
- [x] MockProvider.
- [x] Imagem enviada como data URL; `input_file.file_data` usa base64 bruto.

## Smart Actions
- [x] Revisão humana antes das ações.
- [x] Registrar despesa somente após confirmação.
- [x] Criar lembrete usando tarefas/notificações existentes.
- [x] Adicionar compromisso usando Agenda existente.
- [x] Salvar/arquivar documento.
- [x] Adicionar memória com fonte documental.
- [x] Vincular a pessoa.
- [x] Ignorar/excluir documento.

## Finanças e duplicidade
- [x] Ledger `staff_financial_entries`.
- [x] Origem documental (`source_document_id`).
- [x] Fingerprint por documento/issuer+valor+data e fallback por hash de arquivo.
- [x] Verificação de documento/fingerprint antes do lançamento.
- [x] Índice único por documento de origem.

## Assistente e voz
- [x] Chat recebe fatos estruturados de documentos comuns confirmados.
- [x] Documentos sensíveis não entram no contexto externo geral.
- [x] Resposta instruída a citar `Fonte documental`.
- [x] Comandos por voz podem abrir Smart Inbox e Finanças.
- [x] Ações financeiras continuam exigindo confirmação na interface.

## Observabilidade
- [x] `document.uploaded`.
- [x] `document.classified`.
- [x] `document.extracted`.
- [x] `document.confirmed`.
- [x] `financial_entry.created_from_document`.
- [x] `reminder.created_from_document`.
- [x] View diária agregada preparada para AV OS.

## CI obrigatório
- [ ] `npm run test:smart-inbox` verde no PR.
- [ ] TypeScript verde no PR.
- [ ] Netlify Functions/esbuild verdes no PR.
- [ ] Supabase endpoint validado no PR.
- [ ] Web build verde no PR.
- [ ] Gradle APK/AAB verde no PR.
- [ ] Teste manual com recibo/boleto/contrato antes da produção.
