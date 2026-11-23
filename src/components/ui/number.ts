/** Lê números digitados em pt-BR ("5,2" ou "5.2"). Vazio → undefined; inválido → NaN. */
export function parseDecimal(input: string): number | undefined {
  const s = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return undefined;
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN;
}

/** Número → texto editável em pt-BR. */
export const decimalToInput = (n: number | undefined) => (n === undefined ? "" : String(n).replace(".", ","));
