import { formatMl } from "./nutrition";

/**
 * Frases dos lembretes de água. Leves e bem-humoradas, sem bronca, sem culpa
 * e sem promessas de saúde. O título varia; o corpo mostra o progresso real.
 */

/** Ainda não registrou água hoje. */
const FIRST = [
  "O primeiro copo do dia está te esperando.",
  "Seu copo mandou um oi. Ele está vazio.",
  "Bom momento para estrear o placar da água.",
  "A garrafa está se sentindo esquecida.",
  "Zero ml até agora. Bora abrir a conta?",
  "Missão do momento: um copo d'água. Só isso.",
];

/** Já começou, ainda longe da meta (ou sem meta). */
const MIDDLE = [
  "Hora de molhar a engrenagem.",
  "Pausa de 10 segundos: um gole e volta.",
  "Se você fosse uma planta, já estaria pedindo água.",
  "Seu copo está com saudade.",
  "Um gole agora, um você agradecido depois.",
  "Camelos aguentam dias. Você não precisa provar nada.",
  "Água: zero calorias, zero drama.",
  "Lembrete amigável da sua garrafa.",
  "Abasteça antes que o tanque reclame.",
  "Disciplina também é lembrar de beber água.",
  "Mais um copo para a coleção do dia.",
  "Um brinde a você. Com água, claro.",
  "Seu eu do futuro pediu para avisar: água.",
  "Intervalo técnico para hidratação.",
  "A água não vai se beber sozinha.",
  "Rápido: levanta, enche o copo, volta herói.",
];

/** Falta pouco para a meta (75% ou mais). */
const ALMOST = [
  "Reta final! Mais um copo e a meta é sua.",
  "Tá quase. Só mais uns goles.",
  "A meta já está avistando você chegar.",
  "Último esforço do dia (e é só água).",
  "Faltam poucos goles para fechar o dia bonito.",
  "Mais um copo e pode comemorar.",
];

/** Escolhe uma frase que muda a cada lembrete e de um dia para o outro. */
function pick(list: string[], now: Date): string {
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  const slot = Math.floor((now.getHours() * 60 + now.getMinutes()) / 30);
  return list[(day * 7 + slot) % list.length];
}

/** Texto do lembrete. `now` deve estar no horário de parede da pessoa. */
export function waterReminderText(input: { totalMl: number; goalMl?: number; now: Date }): { title: string; body: string } {
  const { totalMl, goalMl, now } = input;
  const list = totalMl <= 0 ? FIRST : goalMl && totalMl >= goalMl * 0.75 ? ALMOST : MIDDLE;
  const body = goalMl ? `Você bebeu ${formatMl(totalMl)} de ${formatMl(goalMl)} hoje.` : `Você bebeu ${formatMl(totalMl)} hoje.`;
  return { title: pick(list, now), body };
}

export const WATER_MESSAGES = { FIRST, MIDDLE, ALMOST };
