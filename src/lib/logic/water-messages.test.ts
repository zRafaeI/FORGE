import { describe, expect, it } from "vitest";
import { WATER_MESSAGES, waterReminderText } from "./water-messages";

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);
const all = [...WATER_MESSAGES.FIRST, ...WATER_MESSAGES.MIDDLE, ...WATER_MESSAGES.ALMOST];

describe("frases dos lembretes de água", () => {
  it("são únicas, curtas e terminam com pontuação", () => {
    expect(new Set(all).size).toBe(all.length);
    for (const m of all) {
      expect(m.length).toBeLessThanOrEqual(60);
      expect(m).toMatch(/[.!?]$/);
    }
  });

  it("escolhem o grupo pelo momento do dia", () => {
    expect(WATER_MESSAGES.FIRST).toContain(waterReminderText({ totalMl: 0, goalMl: 2000, now: at(23, 9) }).title);
    expect(WATER_MESSAGES.MIDDLE).toContain(waterReminderText({ totalMl: 600, goalMl: 2000, now: at(23, 12) }).title);
    expect(WATER_MESSAGES.ALMOST).toContain(waterReminderText({ totalMl: 1600, goalMl: 2000, now: at(23, 18) }).title);
    expect(WATER_MESSAGES.MIDDLE).toContain(waterReminderText({ totalMl: 1600, now: at(23, 18) }).title);
  });

  it("variam entre lembretes seguidos e de um dia para o outro", () => {
    const day = [9, 10, 11, 12, 13, 14, 15, 16].map((h) => waterReminderText({ totalMl: 500, goalMl: 3000, now: at(23, h) }).title);
    for (let i = 1; i < day.length; i++) expect(day[i]).not.toBe(day[i - 1]);
    expect(new Set(day).size).toBeGreaterThanOrEqual(6);
    const sameHour = [23, 24, 25].map((d) => waterReminderText({ totalMl: 500, goalMl: 3000, now: at(d, 10) }).title);
    expect(new Set(sameHour).size).toBe(3);
  });

  it("mantém o progresso no texto", () => {
    expect(waterReminderText({ totalMl: 750, goalMl: 2500, now: at(23, 10) }).body).toBe("Você bebeu 750 ml de 2,5 L hoje.");
    expect(waterReminderText({ totalMl: 750, now: at(23, 10) }).body).toBe("Você bebeu 750 ml hoje.");
  });
});
