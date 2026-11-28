import type { CategoryId, Priority } from "./types";

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  /** Tom usado em pequenos marcadores. Mantido dentro da família verde/neutra. */
  tone: string;
}

export const CATEGORIES: Record<CategoryId, CategoryMeta> = {
  disciplina: { id: "disciplina", label: "Disciplina", tone: "#0CD56F" },
  treino: { id: "treino", label: "Treinamento", tone: "#C3CDA0" },
  alimentacao: { id: "alimentacao", label: "Alimentação", tone: "#B8A98A" },
  estudos: { id: "estudos", label: "Estudos", tone: "#9FB4B0" },
  fe: { id: "fe", label: "Fé e propósito", tone: "#C9BFA4" },
  financas: { id: "financas", label: "Finanças", tone: "#8FA38A" },
  trabalho: { id: "trabalho", label: "Trabalho", tone: "#9AA39A" },
  pessoal: { id: "pessoal", label: "Pessoal", tone: "#B3B9AE" },
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const PRIORITY_WEIGHT: Record<Priority, number> = { alta: 0, media: 1, baixa: 2 };

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAY_LONG = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
