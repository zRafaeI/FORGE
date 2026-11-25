import { describe, expect, it } from "vitest";
import { crc16, pixPayload } from "./pix";

describe("código Pix copia e cola", () => {
  it("reproduz o exemplo oficial do manual do BR Code", () => {
    expect(
      pixPayload({ key: "123e4567-e12b-12d1-a456-426655440000", name: "Fulano de Tal", city: "BRASILIA" }),
    ).toBe(
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D",
    );
  });

  it("calcula o CRC16 padrão (CCITT-FALSE)", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("inclui o valor quando escolhido e limpa nome e cidade", () => {
    const code = pixPayload({ key: "eu@exemplo.com", name: "Rafaél Guerra da Silva Santos", city: "São Paulo", amountCents: 1000 });
    expect(code).toContain("540510.00");
    expect(code).toContain("5925Rafael Guerra da Silva Sa6009");
    expect(code).toContain("6009Sao Paulo");
    expect(code).toContain("0114eu@exemplo.com");
    expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)));
  });

  it("sem valor, a pessoa digita no banco", () => {
    expect(pixPayload({ key: "eu@exemplo.com", name: "A", city: "B" })).not.toContain("54");
    expect(pixPayload({ key: "eu@exemplo.com", name: "A", city: "B", amountCents: 0 })).not.toMatch(/5404/);
  });
});
