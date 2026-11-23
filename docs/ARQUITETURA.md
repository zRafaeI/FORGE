# FORGE — Arquitetura e decisões

## Stack

| Camada       | Escolha                               | Por quê |
| ------------ | ------------------------------------- | ------- |
| Framework    | Next.js 16 (App Router) + React 19    | Rotas por arquivo, build estático, caminho natural para Supabase/SSR |
| Linguagem    | TypeScript estrito                    | O modelo de domínio é compartilhado por todas as camadas |
| Estilo       | Tailwind CSS 4 com tokens em `@theme` | Tokens centralizados em `src/app/globals.css` |
| Ícones       | lucide-react                          | Traço consistente |
| Validação    | Zod                                   | Uma única fonte de regras para formulários e importação de backup |
| Tipografia   | Archivo Variable (eixo de largura), servida localmente via @fontsource | Funciona offline, sem depender do Google Fonts |
| Testes       | Vitest                                | Lógica pura testada sem navegador |

## Estrutura

```
src/
  app/                    Rotas (finas: só montam a feature)
    layout.tsx, providers.tsx, globals.css
    page.tsx              Dashboard
    rotina/ habitos/ configuracoes/
  components/
    ui/                   Botões, formulários, diálogo, menu, check, progresso, toasts
    layout/               AppShell (sidebar + nav mobile), navegação, logo, cabeçalhos
  features/
    onboarding/           Fluxo inicial
    dashboard/            Dashboard e régua do dia
    routine/              Rotina, formulário de atividade, editor de repetição
    habits/               Hábitos e formulário
    settings/             Perfil e dados
    shared/               Linha de item e ações comuns (concluir, descansar, editar, excluir)
  lib/
    domain/               Tipos, categorias, esquemas Zod
    logic/                Datas, recorrência, estatísticas, reflexões (funções puras + testes)
    store/                Operações puras sobre os dados + provider React + relógio
    data/                 Repositório (interface) + implementação local
```

**Separação de responsabilidades**

- `lib/domain` define *o que* existe.
- `lib/logic` calcula (o que está previsto hoje, progresso, sequências) sem React nem armazenamento.
- `lib/store/actions.ts` transforma dados (criar, editar, marcar) — funções puras.
- `lib/data` persiste. A interface não sabe onde os dados moram.
- `features/` e `components/` só exibem e disparam ações.

## Decisões importantes

1. **Datas de calendário como texto local (`YYYY-MM-DD`).** Evita o clássico bug de
   fuso horário em que um registro feito às 22h aparece no dia seguinte.
2. **Atividades e hábitos são entidades diferentes.** Atividade = compromisso com
   horário e prioridade. Hábito = comportamento acompanhado por consistência. Ambos
   geram registros (`CheckIn`) no mesmo formato.
3. **Descanso é um estado de primeira classe.** `status: "rest"` sai do cálculo de
   progresso e não quebra sequências. É a tradução técnica de "não puna o usuário por descansar".
4. **Itens não aparecem antes de existirem.** Um hábito criado hoje não gera
   "falhas" nos dias anteriores.
5. **Excluir remove o histórico do item**, com confirmação e opção de desfazer por alguns segundos.
6. **Sem dados falsos.** Tudo o que aparece vem do que o usuário criou. Resumos por
   área usam os hábitos/atividades daquela categoria até os módulos dedicados existirem.
7. **Seções futuras aparecem no menu sem link**, sinalizadas como "chegando nas
   próximas versões" — nenhum botão leva a uma tela vazia.
8. **Dados corrompidos nunca são apagados em silêncio**: o original é preservado
   numa chave de backup e o usuário é avisado.
9. **Reflexões diárias são originais**, sóbrias e escolhidas de forma determinística por data.

## Persistência e migração para Supabase

Hoje: `LocalRepository` grava o documento `ForgeData` em `localStorage`
(chave `forge:data:v1`, com `schemaVersion` para migrações futuras).

Para migrar:

1. Criar o projeto no Supabase e preencher `.env.local` a partir de `.env.example`.
2. Criar as tabelas (sugestão):
   ```sql
   create table profiles   (user_id uuid primary key references auth.users, name text, wake_time text, sleep_time text, focus_areas text[], faith_enabled bool, onboarded_at timestamptz);
   create table activities (id uuid primary key, user_id uuid references auth.users, title text, notes text, category text, priority text, time text, duration_min int, recurrence jsonb, created_at timestamptz, updated_at timestamptz, archived_at timestamptz);
   create table habits     (id uuid primary key, user_id uuid references auth.users, title text, category text, target_time text, recurrence jsonb, created_at timestamptz, updated_at timestamptz, archived_at timestamptz);
   create table check_ins  (id uuid primary key, user_id uuid references auth.users, item_id uuid, kind text, date date, status text, at timestamptz, unique (item_id, date));
   ```
   com Row Level Security restringindo cada linha a `auth.uid() = user_id`.
3. Implementar `SupabaseRepository` com a mesma interface `ForgeRepository`
   (`load`, `save`, `clear`) e retorná-lo em `src/lib/data/index.ts` quando as variáveis existirem.
4. Primeira sincronização: importar o backup local (Configurações → Exportar backup).

A interface do app e a lógica não mudam.

## Testes

`npm test` cobre datas, recorrência, validação, progresso, descanso, sequências,
edição/exclusão e o repositório local (incluindo recuperação de dados corrompidos).
A versão 0.1 também foi verificada ponta a ponta num navegador real (onboarding,
criação com validação, conclusão, persistência após recarregar, descanso, edição,
exclusão com desfazer, desktop e celular).
