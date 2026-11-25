# Ligando o FORGE ao Supabase

Com o Supabase, o FORGE passa a ter login e sincroniza seus dados entre dispositivos.
Sem ele, tudo continua funcionando só no navegador.

## 1. Criar a estrutura do banco (uma vez)

1. No painel do Supabase, abra **SQL Editor → New query**.
2. Cole todo o conteúdo de [`supabase/schema.sql`](../supabase/schema.sql) e clique em **Run**.
3. Deve aparecer "Success. No rows returned".

O script cria a tabela `forge_documents`, liga a segurança por linha (cada usuário só
acessa os próprios dados) e a função que grava com controle de versão. Pode ser
rodado de novo sem problema.

## 1b. Notificações de lembrete de água (uma vez)

1. No **SQL Editor**, abra uma nova query, cole todo o conteúdo de [`supabase/push.sql`](../supabase/push.sql) e clique em **Run**.
2. Pronto: o agendador (pg_cron) passa a chamar `/api/push/water` a cada 5 minutos.
   Na primeira chamada o site cria sozinho o par de chaves de envio e guarda no banco.
   Nenhuma chave precisa ser copiada para a Vercel.
3. Para conferir: **Integrations → Cron → Jobs** mostra `forge-water-push`, e o histórico de execuções.
4. Se o endereço do site mudar, troque a URL no fim do `push.sql` e rode só o trecho do `cron.schedule`.

## 1c. Sugestões dos usuários (uma vez)

1. No **SQL Editor**, rode [`supabase/feedback.sql`](../supabase/feedback.sql) (depois do `push.sql`).
2. As mensagens aparecem em **Table Editor → forge_feedback**. A coluna `read` serve para você marcar o que já leu.
3. Quem recebe o aviso por notificação é a conta com o e-mail em `forge_private.config` (`admin_email`),
   desde que tenha ativado as notificações em algum aparelho (Alimentação → Água hoje).

## 1d. Excluir conta (uma vez)

No **SQL Editor**, rode [`supabase/account.sql`](../supabase/account.sql). Ele cria a função usada pelo botão
**Excluir minha conta** (Configurações): apaga o login e, em cascata, os registros, os aparelhos de notificação
e o estado dos lembretes. Sugestões enviadas ficam, mas sem ligação com a pessoa.

## 1e. Desafios (uma vez)

No **SQL Editor**, rode [`supabase/challenges.sql`](../supabase/challenges.sql) (depois do `account.sql`). Ele cria:
- as tabelas de desafios, participantes e progresso diário (só números);
- as funções usadas pelo app e pelo painel `/desafios/admin` (só para a conta em `admin_email`);
- o lembrete à noite, na mesma rodada do agendador;
- o bucket privado `challenge-photos`, em que cada pessoa só lê e grava na própria pasta.

## 2. Endereços de retorno (links de e-mail)

Em **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: adicione `http://localhost:3000/**`

Quando o FORGE estiver publicado na internet, adicione também o endereço público.

## 3. Confirmação de e-mail (opcional)

Por padrão, o Supabase pede que você confirme o e-mail ao criar a conta. O link leva
para `localhost:3000`, então abra o e-mail **no computador onde o FORGE está rodando**.

Se preferir pular essa etapa (conta pessoal), desligue em
**Authentication → Sign In / Providers → Email → Confirm email**.

## 4. Variáveis de ambiente

O arquivo `.env.local` na raiz do projeto já contém:

```
NEXT_PUBLIC_SUPABASE_URL=https://fmtcpylfrrjhjcrwfyai.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Só a chave **pública** (publishable/anon) vai no app. **Nunca** coloque a chave
`secret`/`service_role` nem a senha do banco no projeto.

Depois de mudar o `.env.local`, pare e inicie de novo o `npm run dev`.

## 5. Primeiro acesso

1. `npm install` (há uma dependência nova: `@supabase/supabase-js`) e `npm run dev`.
2. Abra `http://localhost:3000` e escolha **Criar conta**.
3. Se este navegador já tinha dados do FORGE, eles são enviados para a sua conta
   automaticamente — não é preciso refazer a configuração inicial.

## Como a sincronização funciona

- Cada alteração é salva primeiro no navegador (instantâneo) e enviada em seguida.
- Sem internet, o FORGE continua funcionando e envia tudo quando a conexão volta.
- Ao voltar para a aba, o FORGE busca o que mudou em outros dispositivos.
- Se dois dispositivos salvarem ao mesmo tempo, vale a versão que chegou primeiro ao
  servidor e a tela avisa que foi atualizada.
- **Sair da conta** não apaga nada. **Apagar dados** (Configurações) apaga da conta.

## Usar no celular

O FORGE precisa estar acessível pelo celular: publique-o (por exemplo, na Vercel,
com as mesmas duas variáveis de ambiente) e adicione o endereço publicado em
**Redirect URLs**. Depois é só entrar com a mesma conta.
