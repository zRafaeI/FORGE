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
    training/             Treinamento: corridas, musculação, descanso, progressão
    evolution/            Evolução: comparações, calendário, conquistas
    study/                Estudos: matérias, temporizador, sessões, livros
    nutrition/            Alimentação: plano, refeições, água, peso opcional
    faith/                Fé e propósito: diário por prática, pedidos de oração
    finance/              Finanças: lançamentos, categorias, metas, reserva
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
10. **Treinos são registros, não tarefas** (v0.2). Corridas e musculação guardam o que
    foi feito; para lembrar de treinar, use um hábito ou atividade de rotina.
11. **Semanas de treino vão de segunda a domingo**, como na maioria dos planos de treino.
12. **Recordes e progressão só usam dados reais.** "Melhor ritmo" considera corridas
    a partir de 1 km; exercícios são agrupados pelo nome (sem diferenciar maiúsculas/espaços).
13. **Descanso de treino é um por dia**; registrar de novo no mesmo dia só atualiza a observação.
14. **Conquistas acumulam e nunca expiram**, e não comparam o usuário com ninguém.
15. **Gráficos de série única** na cor de destaque, barras finas, tooltip por mouse e
    teclado e tabela equivalente para leitores de tela.

16. **O temporizador de estudo é salvo como dado** (`study.timer`: início e tempo
    acumulado), não como contador em memória. Por isso sobrevive a recarregar,
    fechar a aba ou trocar de tela, e pausas não contam tempo.
17. **Alimentação sem prescrição.** Não há calorias, macros, metas sugeridas ou
    julgamento de refeições. A meta de água é opcional e definida pelo usuário,
    com indicação de procurar um profissional em caso de dúvida.
18. **Peso é opcional e desligado por padrão**, uma pesagem por dia, sem meta de peso,
    com orientação de observar tendências e não oscilações diárias.
19. **Excluir uma matéria remove suas sessões**; remover um item do plano de
    refeições mantém os registros antigos (eles viram refeições avulsas).

20. **Fé e propósito não tem métricas.** Nada de sequências, pontuação ou
    conquistas espirituais; o dashboard mostra só o último registro. A seção é
    opcional e desativá-la não apaga nada.
21. **Dinheiro em centavos inteiros** para evitar erros de arredondamento; a
    entrada aceita "49,90", "1.234,56" e "R$ 10".
22. **Valores guardados em metas saem do saldo disponível**, já que estão separados.
    Sem saldo inicial, o resumo mostra o "resultado registrado" — nunca finge saber
    o saldo real da conta.
23. **Categorias financeiras vêm com um conjunto inicial editável** (configuração,
    não dados). Categorias com lançamentos não podem ser removidas.
24. **A reserva de emergência mostra cobertura em meses** a partir da média de
    despesas dos últimos meses registrados. Os atalhos de 3 e 6 meses são
    referências informativas, não recomendação financeira.

## Versões dos dados

O documento salvo tem `schemaVersion`. A v0.2 introduziu a versão 2 (`training`), a
v0.3 a versão 3 (`study`, `nutrition`) e a v0.4 a versão 4 (`faith`, `finance`).
Dados e backups de qualquer versão anterior são migrados automaticamente ao
carregar ou importar — nada é perdido.

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
   create table runs       (id uuid primary key, user_id uuid references auth.users, date date, distance_km numeric, duration_sec int, effort int, notes text, created_at timestamptz);
   create table workouts   (id uuid primary key, user_id uuid references auth.users, date date, title text, exercises jsonb, duration_min int, notes text, created_at timestamptz);
   create table subjects   (id uuid primary key, user_id uuid references auth.users, name text, weekly_goal_min int, created_at timestamptz);
   create table study_sessions (id uuid primary key, user_id uuid references auth.users, subject_id uuid references subjects on delete cascade, date date, minutes int, notes text, source text, created_at timestamptz);
   create table books      (id uuid primary key, user_id uuid references auth.users, title text, author text, total_pages int, current_page int, status text, started_on date, finished_on date, created_at timestamptz);
   create table reading_logs (id uuid primary key, user_id uuid references auth.users, book_id uuid references books on delete cascade, date date, from_page int, to_page int, created_at timestamptz);
   create table planned_meals (id uuid primary key, user_id uuid references auth.users, name text, time text);
   create table meals      (id uuid primary key, user_id uuid references auth.users, date date, time text, name text, description text, planned_meal_id uuid, created_at timestamptz);
   create table water_logs (id uuid primary key, user_id uuid references auth.users, date date, ml int, at timestamptz);
   create table weights    (id uuid primary key, user_id uuid references auth.users, date date, kg numeric, created_at timestamptz, unique (user_id, date));
   create table faith_entries (id uuid primary key, user_id uuid references auth.users, date date, kind text, reference text, text text, items text[], created_at timestamptz);
   create table prayers    (id uuid primary key, user_id uuid references auth.users, text text, created_at timestamptz, answered_on date, answer_note text);
   create table finance_categories (id uuid primary key, user_id uuid references auth.users, name text, flow text);
   create table transactions (id uuid primary key, user_id uuid references auth.users, date date, flow text, amount_cents bigint, category_id uuid references finance_categories, description text, created_at timestamptz);
   create table goals      (id uuid primary key, user_id uuid references auth.users, name text, target_cents bigint, deadline date, emergency bool, created_at timestamptz);
   create table goal_contributions (id uuid primary key, user_id uuid references auth.users, goal_id uuid references goals on delete cascade, date date, amount_cents bigint, created_at timestamptz);
   -- temporizador em andamento, meta de água, preferência de peso, práticas de fé e saldo inicial: colunas em profiles
   create table rest_days  (id uuid primary key, user_id uuid references auth.users, date date, note text, created_at timestamptz, unique (user_id, date));
   ```
   com Row Level Security restringindo cada linha a `auth.uid() = user_id`.
3. Implementar `SupabaseRepository` com a mesma interface `ForgeRepository`
   (`load`, `save`, `clear`) e retorná-lo em `src/lib/data/index.ts` quando as variáveis existirem.
4. Primeira sincronização: importar o backup local (Configurações → Exportar backup).

A interface do app e a lógica não mudam.

## Testes

`npm test` (54 testes) cobre datas, recorrência, validação, progresso, descanso, sequências,
edição/exclusão, o repositório local (incluindo recuperação de dados corrompidos),
treinamento (ritmo, volume, progressão, semanas, recordes), evolução, estudos (temporizador, metas, leitura), alimentação (plano, água, peso)
fé (diário, orações), finanças (valores, totais, metas, reserva) e as migrações
de todas as versões anteriores para a v4.
A versão 0.1 também foi verificada ponta a ponta num navegador real (onboarding,
criação com validação, conclusão, persistência após recarregar, descanso, edição,
exclusão com desfazer, desktop e celular).
