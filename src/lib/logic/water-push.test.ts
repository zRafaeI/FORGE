import { describe, expect, it } from "vitest";
import { waterPushFor, wallClock } from "./water-push";

const reminder = { enabled: true, intervalMin: 60, start: "06:00", end: "22:00", onlyWhenBehind: false };
// 23/11/2026 15:00 UTC = 12:00 em São Paulo (UTC−3)
const now = new Date(Date.UTC(2026, 10, 23, 15, 0));

describe("lembrete por notificação (servidor)", () => {
  it("converte para o horário de parede do fuso da pessoa", () => {
    const w = wallClock(now, "America/Sao_Paulo");
    expect([w.getDate(), w.getHours(), w.getMinutes()]).toEqual([23, 12, 0]);
    expect(wallClock(now, "Asia/Tokyo").getHours()).toBe(0);
    expect(wallClock(now, "fuso/inexistente").getHours()).toBe(12);
  });

  it("não envia com o lembrete desligado ou sem dados", () => {
    expect(waterPushFor({ nutrition: null, timeZone: "America/Sao_Paulo", now }).due).toBe(false);
    expect(waterPushFor({ nutrition: { waterReminder: { ...reminder, enabled: false } }, timeZone: "America/Sao_Paulo", now }).due).toBe(false);
  });

  it("envia quando passou o intervalo, com o total do dia local", () => {
    const res = waterPushFor({
      nutrition: {
        waterReminder: reminder,
        waterGoalMl: 2000,
        water: [
          { id: "a", date: "2026-11-23", ml: 500, at: "2026-11-23T13:30:00.000Z" }, // 10:30 local
          { id: "b", date: "2026-11-22", ml: 900, at: "2026-11-22T20:00:00.000Z" }, // ontem
        ],
      },
      timeZone: "America/Sao_Paulo",
      now,
    });
    expect(res).toEqual({ due: true, title: "Hora de beber água", body: "Você bebeu 500 ml de 2 L hoje." });
  });

  it("respeita o último copo e o último lembrete enviado", () => {
    const base = { waterReminder: reminder, water: [{ id: "a", date: "2026-11-23", ml: 300, at: "2026-11-23T14:30:00.000Z" }] };
    expect(waterPushFor({ nutrition: base, timeZone: "America/Sao_Paulo", now }).due).toBe(false);
    expect(
      waterPushFor({ nutrition: { waterReminder: reminder }, timeZone: "America/Sao_Paulo", now, lastSentAt: new Date(Date.UTC(2026, 10, 23, 14, 20)) }).due,
    ).toBe(false);
  });

  it("não envia fora da janela no fuso da pessoa", () => {
    const night = new Date(Date.UTC(2026, 10, 24, 3, 0)); // 00:00 em São Paulo
    expect(waterPushFor({ nutrition: { waterReminder: reminder }, timeZone: "America/Sao_Paulo", now: night }).due).toBe(false);
  });
});
