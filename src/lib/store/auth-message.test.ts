import { describe, expect, it } from "vitest";
import { authMessage } from "./auth";

describe("mensagens de erro do login", () => {
  it("reconhece falta de rede em qualquer navegador", () => {
    const net = "Sem conexão com o servidor. Confira a internet e tente de novo.";
    expect(authMessage({ name: "AuthRetryableFetchError", message: "Load failed", status: 0 })).toBe(net); // iPhone (Safari)
    expect(authMessage(new TypeError("Load failed"))).toBe(net);
    expect(authMessage(new TypeError("Failed to fetch"))).toBe(net); // Chrome
    expect(authMessage(new TypeError("NetworkError when attempting to fetch resource."))).toBe(net); // Firefox
    expect(authMessage(new Error("The network connection was lost."))).toBe(net);
    expect(authMessage(new Error("The Internet connection appears to be offline."))).toBe(net);
  });

  it("mantém as mensagens específicas", () => {
    expect(authMessage({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("E-mail ou senha incorretos.");
    expect(authMessage({ message: "algo inesperado" })).toBe("Não foi possível concluir. Tente de novo em instantes.");
  });
});
