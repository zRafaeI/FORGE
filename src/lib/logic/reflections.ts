import type { DateKey } from "@/lib/domain/types";
import { diffDays } from "./dates";

/**
 * Reflexões diárias escritas para o FORGE: sóbrias, curtas, sem exagero motivacional.
 * A escolha é determinística por data — a mesma frase o dia inteiro, em qualquer dispositivo.
 */
const REFLECTIONS = [
  "Faça hoje o que você combinou consigo mesmo ontem.",
  "Consistência é escolher de novo, mesmo quando ninguém está olhando.",
  "Um dia mediano cumprido vale mais que um dia perfeito planejado.",
  "Descansar faz parte do plano. Abandonar, não.",
  "Comece pelo menor passo possível. Depois dê o próximo.",
  "Seu caráter se forma nas pequenas decisões repetidas.",
  "Não espere estar pronto. Esteja presente.",
  "Organize a manhã e a manhã organiza o resto do dia.",
  "Se o plano falhou, ajuste o plano — não a sua identidade.",
  "Progresso lento ainda é progresso.",
  "A disciplina de hoje é a liberdade de amanhã.",
  "Cumprir o básico com constância é raro. Seja raro.",
  "Termine o que começou antes de começar algo novo.",
  "Quem você quer ser já tem uma rotina. Viva um dia dela.",
  "Menos promessas, mais compromissos cumpridos.",
  "Cuide do corpo, da mente e do espírito. Um sustenta o outro.",
  "Recomeçar não é fracasso. É manutenção.",
  "O que você repete, você se torna.",
  "Preste atenção ao que drena sua energia e ao que a devolve.",
  "Um bom dia é feito de horas bem decididas.",
  "Faça o difícil primeiro enquanto a mente está descansada.",
];

const EPOCH: DateKey = "2026-01-01";

export function reflectionFor(date: DateKey): string {
  const n = Math.abs(diffDays(EPOCH, date));
  return REFLECTIONS[n % REFLECTIONS.length];
}
