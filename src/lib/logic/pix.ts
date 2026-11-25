/**
 * Código Pix "copia e cola" estático (BR Code), no padrão EMV do Banco Central.
 * Gerado no próprio app: nada passa por banco ou serviço de terceiros.
 */

function field(id: string, value: string): string {
  return id + String(value.length).padStart(2, "0") + value;
}

/** Sem acentos e só com caracteres aceitos nos campos de nome e cidade. */
function clean(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-]/g, "")
    .trim()
    .slice(0, max);
}

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido no campo 63. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function pixPayload(input: { key: string; name: string; city: string; amountCents?: number; txid?: string }): string {
  const account = field("00", "br.gov.bcb.pix") + field("01", input.key.trim());
  const amount =
    input.amountCents && input.amountCents > 0 ? field("54", (Math.round(input.amountCents) / 100).toFixed(2)) : "";
  const txid = (input.txid ?? "***").replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***";
  const body =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    amount +
    field("58", "BR") +
    field("59", clean(input.name, 25)) +
    field("60", clean(input.city, 15)) +
    field("62", field("05", txid)) +
    "6304";
  return body + crc16(body);
}
