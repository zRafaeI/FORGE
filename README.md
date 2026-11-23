# FORGE

Sistema pessoal de disciplina, rotina e evolução.
*Não dependa da motivação. Construa uma vida baseada em compromisso.*

## Como executar

Requisitos: **Node.js 20.9 ou superior** (recomendado 22 LTS).

```bash
npm install
npm run dev        # http://localhost:3000
```

Outros comandos:

| Comando          | O que faz                                  |
| ---------------- | ------------------------------------------ |
| `npm run build`  | Build de produção                          |
| `npm start`      | Serve o build de produção                  |
| `npm test`       | Testes unitários da lógica e da persistência |
| `npm run lint`   | Checagem de tipos (TypeScript estrito)     |

**Dois modos de funcionamento:**

- **Com Supabase** (quando o `.env.local` existe): login com e-mail e senha e dados
  sincronizados entre dispositivos. Configuração passo a passo em
  [`docs/SUPABASE.md`](docs/SUPABASE.md).
- **Sem Supabase** (sem `.env.local`): tudo fica só neste navegador, sem conta.

## O que está pronto (v0.7)

- **Onboarding** em 4 etapas: nome, horários de acordar/dormir, áreas de foco e
  escolha dos primeiros hábitos (sugestões por área + hábitos personalizados).
- **Dashboard**: saudação por horário, data, reflexão diária, **régua do dia**
  (do acordar ao dormir, com compromissos no horário e o momento atual),
  próximo compromisso, compromissos e hábitos de hoje com conclusão direta,
  progresso do dia, consistência em 7 dias e resumo por área
  (treinamento, estudos, alimentação e — se ativada — vida espiritual).
- **Minha rotina**: criar, editar e excluir atividades (com desfazer); horário,
  duração, categoria, prioridade e repetição (uma vez, diária, dias da semana,
  a cada N dias). Visão por dia com navegação e filtro de pendentes/concluídas,
  lista completa com filtro e ordenação, histórico das últimas duas semanas.
- **Hábitos**: CRUD completo, sequência atual, taxa em 28 dias e grade
  clicável para corrigir registros passados.
- **Descanso consciente**: qualquer item pode ser marcado como "descansar hoje".
  Descanso não conta como falha e não quebra sequências.
- **Treinamento** *(novo na v0.2)*: registro de corridas (distância, tempo,
  ritmo médio calculado, esforço percebido), musculação (exercícios, séries,
  repetições, cargas; "copiar o último treino com o mesmo nome") e dias de
  descanso. Resumo da semana, gráfico das últimas 8 semanas (km ou sessões),
  histórico com edição/exclusão, recordes de corrida e progressão de carga por exercício.
- **Evolução** *(novo na v0.2)*: últimos 7 e 30 dias comparados ao período
  anterior, calendário mensal de conclusão (com marcação de dias de treino),
  taxa semanal das últimas 12 semanas, constância por hábito e conquistas
  que acumulam e nunca são perdidas.
- **Estudos** *(novo na v0.3)*: matérias com meta semanal opcional, temporizador
  de sessões (pausar, retomar; continua contando mesmo se a página for fechada e
  aparece em todas as telas enquanto roda), registro manual, horas por semana,
  dias seguidos, histórico de sessões, lista de livros (quero ler, lendo, lidos)
  com registro da página em que parou.
- **Alimentação** *(novo na v0.3)*: planejamento diário de refeições por horário,
  registro do que comeu (sem calorias, sem dietas), água com botões rápidos e meta
  definida por você, histórico de 7 dias e acompanhamento de peso **opcional**
  (desligado por padrão).
- **Lembretes de água** *(novo na v0.6)*: meta em destaque com o ritmo esperado ao
  longo do dia; lembretes no intervalo escolhido, só no seu horário acordado e,
  se quiser, só quando estiver abaixo do ritmo. Beber água reinicia a contagem e o
  aviso tem botão para registrar o copo. Com a aba visível, o aviso aparece no
  FORGE; em segundo plano, como notificação do sistema. **Funcionam enquanto o
  FORGE estiver aberto** (avisos com o navegador fechado exigem push, previsto
  para depois da publicação).
- **Fé e propósito** *(novo na v0.4, opcional)*: diário de devocional, leitura
  bíblica, oração, reflexão, gratidão e aprendizados; você escolhe quais práticas
  acompanhar. Pedidos de oração com registro de respostas. Sem pontuação,
  sequências ou comparações.
- **Versículo do dia** *(novo na v0.7)*: em Fé e propósito e no dashboard, um versículo
  diferente por dia (415 selecionados, mais de um ano sem repetir), com dias
  anteriores, copiar e "meditar e registrar" (abre o diário com a passagem
  preenchida). Texto da Bíblia Livre (CC BY 4.0), com crédito visível.
- **Finanças** *(novo na v0.4)*: entradas e despesas com categorias editáveis,
  resumo de saldo (com saldo inicial opcional), mês a mês com despesas por
  categoria, histórico de 6 meses, metas com valores guardados e retirados, e
  reserva de emergência mostrando quantos meses de despesas ela cobre. Nenhuma
  conta bancária é conectada.
- **Conta e sincronização** *(novo na v0.5)*: criar conta, entrar, recuperar senha,
  sair. Dados salvos no navegador e sincronizados com o Supabase, funcionando
  offline, com controle de conflito entre dispositivos. Dados que já existiam no
  navegador vão para a conta no primeiro acesso.
- **Configurações**: editar perfil e ritmo, ativar/desativar a área espiritual,
  exportar/importar backup em JSON, apagar todos os dados.
- Responsivo (sidebar no desktop, navegação inferior no celular), acessível por
  teclado e leitores de tela, respeita "reduzir movimento".

## O que ainda falta

Todas as seções do briefing existem e a sincronização com Supabase está pronta.
Próximos passos naturais: publicar o app (Vercel) para usar no celular, instalação
como app (PWA) e lembretes opcionais.

Detalhes de arquitetura e decisões: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).
