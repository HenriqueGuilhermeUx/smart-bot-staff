# Staff v2 — instalação do núcleo

Esta versão transforma o Staff em um produto independente com:

- tela **Hoje**;
- tarefas e lembretes persistentes;
- histórico do chat em nuvem;
- interpretação de comandos em português;
- central por áreas da vida;
- integração Nexa opcional;
- notificações do navegador enquanto o app/PWA estiver ativo.

## 1. Criar as tabelas no Supabase

No projeto Supabase usado pelo Staff:

1. Abra **SQL Editor**.
2. Abra o arquivo `supabase/migrations/20260712_staff_core.sql` deste repositório.
3. Copie todo o conteúdo.
4. Execute no SQL Editor.

A migração cria as tabelas `staff_profiles`, `staff_tasks`, `staff_messages`, `staff_memories` e `staff_notification_preferences`, com RLS para cada usuário acessar somente os próprios dados.

Sem a migração, a interface continua funcionando com fallback local, mas não haverá sincronização entre dispositivos.

## 2. Variáveis do Netlify

Mantenha configuradas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

A função existente `/.netlify/functions/staff-chat` continua sendo usada para conversas gerais com IA.

## 3. Limite atual das notificações

Nesta entrega, os lembretes disparam notificações quando o site ou PWA está aberto/ativo. Notificações Android em segundo plano exigirão a próxima etapa com Capacitor + Firebase Cloud Messaging ou um serviço de push.

## 4. Teste principal

Após fazer login, escreva no campo rápido ou no chat:

> Me lembra de pagar a conta de luz amanhã às 9h.

O Staff deverá criar a tarefa, salvar no Supabase e exibi-la em **Hoje** e **Tarefas**.
