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

25. **Lembretes de água rodam no navegador** (`WaterReminderService`, montado em todas as
    telas). A configuração é sincronizada com a conta; o horário do último lembrete é
    por dispositivo (`forge:water-reminder:last`) e serve também para que duas abas
    não avisem ao mesmo tempo. A decisão de lembrar é uma função pura
    (`reminderState`): janela do dia, intervalo contado do último copo ou lembrete,
    meta alcançada e "só abaixo do ritmo". Notificações com o app fechado exigem Web
    Push com service worker e servidor — próxima etapa, junto com a publicação/PWA.

26. **Versículos vêm de uma tradução de licença aberta, embutidos no app** (funcionam
    offline, sem depender de serviço externo). Fonte: Bíblia Livre (eBible.org,
    `porbr2018`, CC BY 4.0), conferida com a página oficial. Edições populares (ARA,
    NVI, NAA) têm direitos reservados e não podem ser usadas. A lista é gerada por
    `scripts/build-verses.py` a partir de `scripts/verse-refs.txt`; os ajustes
    (pontuação, notas, títulos do Salmo 119) e dois erros de digitação do original
    corrigidos estão documentados no topo de `src/lib/content/verses.ts`. O texto
    passou por verificação ortográfica.

27. **PWA sem loja.** `src/app/manifest.ts` (nome, cores, ícones em `public/icons/`,
    incluindo versões "maskable" para Android e `apple-touch-icon` para iPhone) e
    `public/sw.js`: páginas com rede primeiro (cada deploy chega na hora), arquivos
    `/_next/static` com cache primeiro (nomes com hash), pré-cache de todas as telas na
    instalação. Supabase e `/_vercel/*` nunca passam pelo service worker. Ele só é
    registrado em produção. Mude `VERSION` em `sw.js` apenas se a lógica dele mudar.
28. **Analytics só na Vercel** (`process.env.VERCEL`), para não gerar 404 ao rodar localmente.
29. **Lembrete de água por notificação push** (Web Push, padrão aberto, grátis):
    - aparelhos inscritos ficam em `forge_push_subscriptions`;
    - o pg_cron do Supabase chama `/api/push/water` a cada 5 min, com um segredo que só existe no banco (schema `forge_private`);
    - a rota repassa o segredo às funções do banco, decide com a mesma regra do app (`reminderState`, no fuso da pessoa) e envia;
    - o par de chaves VAPID é gerado na primeira execução e guardado no banco: a Vercel não guarda segredo nenhum e o site usa só a chave pública do Supabase;
    - aparelhos com push ativo não repetem o aviso localmente; com o app aberto e em foco, o service worker repassa o lembrete para um aviso dentro do app;
    - aparelhos sem push avisam o servidor (`forge_note_water_reminder`) quando mostram um lembrete, para não repetir em outro aparelho;
    - sair da conta remove a inscrição deste aparelho.
30. **Apoio via Pix** (`/apoiar`): o código copia e cola é gerado no app (`lib/logic/pix.ts`, BR Code estático com CRC16),
    sem serviço de pagamento. Chave, nome e cidade ficam em `lib/content/support.ts`. Nada é desbloqueado por apoiar;
    "Já apoiei" só guarda um agradecimento neste aparelho.
31. **Sugestões** (`forge_feedback`): envio só pela função `forge_send_feedback` (5 por pessoa a cada 24 h; e-mail
    só com consentimento). A tabela não tem políticas de RLS: ninguém lê pelo app. O aviso ao dono sai na mesma
    rodada do agendador dos lembretes (`/api/push/water`), para os aparelhos da conta em `admin_email`.
32. **Privacidade e exclusão**: `/privacidade` é a única rota pública (ver `PUBLIC_PATHS` em `providers.tsx`).
    `forge_delete_account` apaga o usuário em `auth.users` (cascata para documento, aparelhos e estado); o app
    desativa as notificações do aparelho antes e limpa as cópias locais depois, inclusive os dados de antes do cadastro.
33. **Sinal fraco não trava o app** (antes, "sem internet" funcionava, mas rede pendurada ficava carregando):
    - service worker: telas esperam a rede no máximo 2,5 s (abrir) e 1,5 s (dados de troca de tela); depois usam a cópia
      guardada e atualizam o cache quando a resposta chegar;
    - login: com sessão salva no aparelho, o app abre na hora e o Supabase confirma em seguida;
    - dados: com cópia no aparelho, espera o servidor no máximo 1,5 s; a versão do servidor chega depois, se for nova;
    - falha de rede ao renovar o login não desloga: só um `SIGNED_OUT` real (ou a sessão sumir do aparelho) volta
      para a tela de entrar; erros de rede de qualquer navegador (inclusive "Load failed" do iPhone) viram "Sem conexão".

## Versões dos dados

O documento salvo tem `schemaVersion`. A v0.2 introduziu a versão 2 (`training`), a
v0.3 a versão 3 (`study`, `nutrition`) e a v0.4 a versão 4 (`faith`, `finance`).
Dados e backups de qualquer versão anterior são migrados automaticamente ao
carregar ou importar — nada é perdido.

## Persistência e sincronização

- **Sem Supabase configurado**: `LocalRepository` grava o documento `ForgeData` em
  `localStorage` (chave `forge:data:v1`).
- **Com Supabase** (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`):
  o app exige login e usa `SyncedRepository`:
  - cache local por usuário (`forge:data:v1:user:<id>`) — leitura instantânea e uso offline;
  - um documento por usuário na tabela `public.forge_documents` (JSONB), protegido por RLS;
  - gravação pela função `save_forge_document(data, versão, revisão esperada)`, que só
    aceita se a revisão no servidor for a esperada (controle otimista de concorrência);
  - envios em fila, sempre com a versão mais recente; sem rede, fica pendente e é
    reenviado no evento `online`;
  - ao voltar para a aba, busca alterações de outros dispositivos;
  - no primeiro login, os dados que já existiam no navegador (modo sem conta) são
    enviados para a conta e o espaço anônimo é liberado (com cópia de segurança).

**Por que um documento por usuário, e não uma tabela por entidade?** O app sempre lê e
grava o estado completo de um único usuário, que é pequeno (centenas de KB mesmo após
anos). Um documento mantém a interface `ForgeRepository` idêntica nos dois modos,
torna as migrações de formato (`schemaVersion`) triviais e evita dezenas de tabelas e
políticas. Se no futuro houver recursos que dependam de consultas no servidor (ex.:
relatórios, compartilhamento), as coleções podem ser normalizadas em tabelas sem
mudar a interface.

Passo a passo de configuração: [`SUPABASE.md`](SUPABASE.md). Estrutura do banco:
[`supabase/schema.sql`](../supabase/schema.sql).

## Testes

`npm test` (69 testes) cobre datas, recorrência, validação, progresso, descanso, sequências,
edição/exclusão, o repositório local (incluindo recuperação de dados corrompidos),
treinamento (ritmo, volume, progressão, semanas, recordes), evolução, estudos (temporizador, metas, leitura), alimentação (plano, água, peso)
fé (diário, orações), finanças (valores, totais, metas, reserva) e as migrações
de todas as versões anteriores para a v4, e a sincronização (conta nova com dados
locais, dois dispositivos, conflito, offline, fila de envios, apagar dados).
O login e a sincronização também foram verificados num navegador real contra um
servidor Supabase simulado (cadastro, senha errada, dois dispositivos, conflito,
offline, troca de conta, recuperação de senha). A versão 0.1 também foi verificada ponta a ponta num navegador real (onboarding,
criação com validação, conclusão, persistência após recarregar, descanso, edição,
exclusão com desfazer, desktop e celular).

34. **Desafios**: a definição (nome, datas, tarefas, código) e quem participa ficam no servidor; o que a pessoa marcou fica
    no documento dela (`challenges`, opcional no schema v4), então funciona offline. O app envia ao servidor só
    "feitas/total" de hoje e de ontem (`forge_challenge_report`) para o progresso do grupo, sem nomes.
    - Tarefas automáticas (`autoDone`) olham os registros do próprio app: água (meta), treino, refeições (quantidade),
      leitura, estudo e fé. Manual é um check.
    - Calendário sem "falhou": dia passado sem nada fica só vazio. A pessoa pode completar dias que já passaram.
    - Fotos: bucket privado, caminho `<usuário>/<desafio>/<dia>.jpg`, reduzidas para 1280 px. Sair do desafio e
      excluir a conta apagam as fotos (pela API de armazenamento, antes de apagar a conta).
    - Lembrete: entre 19h e 22h no fuso da pessoa, uma vez por dia, só com o dia incompleto (`challengePushFor`).
35. **Painel do FORGE** (`/admin`): só para a conta em `admin_email` (checado no banco por `forge_is_admin`); para os
    demais, a página aparece como "não encontrada" e nenhum atalho é mostrado. "Uso" = a pessoa registrou algo (gatilho
    em `forge_documents` grava o dia em `forge_private.daily_active`). Mostra nome do perfil, data da conta e último uso.
