import { describe, expect, it } from "vitest";
import { challengePushFor, type ChallengePushJob } from "./challenge-push";

const job = (over: Partial<ChallengePushJob> = {}): ChallengePushJob => ({
  challengeId: "c1",
  name: "Desafio FORGE 21",
  startDate: "2026-11-23",
  days: 21,
  userId: "u1",
  lastReminded: null,
  recent: [],
  subscriptions: [{ endpoint: "e", p256dh: "p", auth: "a", time_zone: "America/Sao_Paulo" }],
  ...over,
});
// 25/11/2026 23:30 UTC = 20:30 em São Paulo
const evening = new Date(Date.UTC(2026, 10, 25, 23, 30));

describe("lembrete do desafio", () => {
  it("à noite, com o dia incompleto, lembra com o número do dia", () => {
    expect(challengePushFor(job(), evening)).toEqual({
      due: true,
      day: "2026-11-25",
      title: "Desafio FORGE 21 · Dia 3 de 21",
      body: "As tarefas de hoje estão te esperando. Ainda dá tempo.",
    });
    const r = challengePushFor(job({ recent: [{ day: "2026-11-25", done: 2, total: 3, completed: false }] }), evening);
    expect(r.due && r.body).toBe("Falta só 1 tarefa para fechar o dia.");
    const r2 = challengePushFor(job({ recent: [{ day: "2026-11-25", done: 1, total: 4, completed: false }] }), evening);
    expect(r2.due && r2.body).toBe("Faltam 3 tarefas para fechar o dia.");
  });

  it("não lembra com o dia completo, já lembrado, fora da janela ou fora do desafio", () => {
    expect(challengePushFor(job({ recent: [{ day: "2026-11-25", done: 3, total: 3, completed: true }] }), evening).due).toBe(false);
    expect(challengePushFor(job({ lastReminded: "2026-11-25" }), evening).due).toBe(false);
    expect(challengePushFor(job(), new Date(Date.UTC(2026, 10, 25, 15, 0))).due).toBe(false); // 12h
    expect(challengePushFor(job(), new Date(Date.UTC(2026, 10, 26, 1, 30))).due).toBe(false); // 22h30
    expect(challengePushFor(job({ startDate: "2026-11-26" }), evening).due).toBe(false); // ainda não começou
    expect(challengePushFor(job({ startDate: "2026-11-01", days: 21 }), evening).due).toBe(false); // terminou
  });

  it("usa o fuso da pessoa, não o do servidor", () => {
    // 20:30 em São Paulo é 08:30 do dia seguinte em Tóquio: fora da janela
    const tokyo = job({ subscriptions: [{ endpoint: "e", p256dh: "p", auth: "a", time_zone: "Asia/Tokyo" }] });
    expect(challengePushFor(tokyo, evening).due).toBe(false);
  });
});
