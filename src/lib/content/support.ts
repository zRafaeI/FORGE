/** Dados do apoio via Pix. A chave fica visível na página, por isso é o e-mail (não CPF nem celular). */
export const SUPPORT_PIX = {
  key: "eurafaelguerra@gmail.com",
  keyKind: "e-mail",
  name: "Rafael Guerra",
  city: "SAO PAULO",
} as const;

/** Valores sugeridos, em centavos. "Valor livre" deixa a pessoa digitar no banco. */
export const SUPPORT_AMOUNTS = [500, 1000, 2000, 5000];
