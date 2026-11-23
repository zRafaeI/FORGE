import { describe, expect, it } from "vitest";
import { expectedByNow, reminderState, reminderWindow } from "./water-reminder";

const day = (h: number, m = 0) => new Date(2026, 10, 23, h, m);
const settings = { enabled: true, intervalMin: 60, start: "06:00", end: "22:00", onlyWhenBehind: false };

describe("janela e ritmo", () => {
  it("janela normal e atravessando a meia-noite", () => {
    expect(reminderWindow("06:00", "22:00", day(5)).inside).toBe(false);
    expect(reminderWindow("06:00", "22:00", day(12)).inside).toBe(true);
    expect(reminderWindow("06:00", "22:00", day(23)).start.getDate()).toBe(24);
    expect(reminderWindow("08:00", "01:00", day(0, 30)).inside).toBe(true);
    expect(reminderWindow("08:00", "01:00", day(3)).inside).toBe(false);
  });
  it("ritmo esperado distribui a meta ao longo do dia", () => {
    expect(expectedByNow(2000, "06:00", "22:00", day(5))).toBe(0);
    expect(expectedByNow(2000, "06:00", "22:00", day(14))).toBe(1000);
    expect(expectedByNow(2000, "06:00", "22:00", day(23))).toBe(2000);
  });
});

describe("quando lembrar", () => {
  it("desligado ou fora da janela não lembra", () => {
    expect(reminderState({ settings: undefined, now: day(12), totalMl: 0 }).due).toBe(false);
    expect(reminderState({ settings, now: day(5), totalMl: 0 })).toMatchObject({ due: false, reason: "outside" });
  });
  it("conta a partir do início da janela, do último copo ou do último lembrete", () => {
    expect(reminderState({ settings, now: day(6, 30), totalMl: 0 })).toMatchObject({ due: false, reason: "waiting" });
    expect(reminderState({ settings, now: day(7), totalMl: 0 }).due).toBe(true);
    // beber às 06:50 empurra o próximo para 07:50
    const s = reminderState({ settings, now: day(7, 10), totalMl: 300, lastDrinkAt: day(6, 50) });
    expect(s.due).toBe(false);
    expect(s.nextAt?.getHours()).toBe(7);
    expect(s.nextAt?.getMinutes()).toBe(50);
    expect(reminderState({ settings, now: day(8), totalMl: 0, lastReminderAt: day(7, 30) }).due).toBe(false);
  });
  it("respeita a meta e o ritmo", () => {
    expect(reminderState({ settings, now: day(15), totalMl: 2000, goalMl: 2000 })).toMatchObject({ reason: "goal-reached" });
    const behind = { ...settings, onlyWhenBehind: true };
    expect(reminderState({ settings: behind, now: day(14), totalMl: 1200, goalMl: 2000 })).toMatchObject({ reason: "on-track" });
    expect(reminderState({ settings: behind, now: day(14), totalMl: 400, goalMl: 2000 }).due).toBe(true);
  });
  it("não agenda lembrete depois do fim da janela", () => {
    expect(reminderState({ settings, now: day(21, 30), totalMl: 0, lastDrinkAt: day(21, 20) })).toMatchObject({ due: false, nextAt: null });
  });
});
