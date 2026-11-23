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

Não é preciso configurar nada: sem variáveis de ambiente, o FORGE salva tudo no
navegador (localStorage). Veja `.env.example` para a futura integração com Supabase.

## O que está pronto (v0.3)

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
- **Configurações**: editar perfil e ritmo, ativar/desativar a área espiritual,
  exportar/importar backup em JSON, apagar todos os dados.
- Responsivo (sidebar no desktop, navegação inferior no celular), acessível por
  teclado e leitores de tela, respeita "reduzir movimento".

## O que ainda falta

Seções sinalizadas como "chegando nas próximas versões" no menu:
Fé e propósito e Finanças.
Também: sincronização com Supabase e autenticação.

Detalhes de arquitetura e decisões: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).
