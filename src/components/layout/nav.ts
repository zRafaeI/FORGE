import {
  BookOpen,
  CalendarClock,
  Dumbbell,
  Flag,
  HandHeart,
  LayoutGrid,
  LineChart,
  Repeat,
  Settings,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Seções ainda não construídas aparecem no menu sem link, sinalizadas como "em breve". */
  available: boolean;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Hoje", icon: LayoutGrid, available: true },
  { href: "/rotina", label: "Minha rotina", short: "Rotina", icon: CalendarClock, available: true },
  { href: "/habitos", label: "Hábitos", short: "Hábitos", icon: Repeat, available: true },
  { href: "/treinamento", label: "Treinamento", short: "Treino", icon: Dumbbell, available: true },
  { href: "/alimentacao", label: "Alimentação", short: "Alimentação", icon: UtensilsCrossed, available: true },
  { href: "/estudos", label: "Estudos", short: "Estudos", icon: BookOpen, available: true },
  { href: "/fe", label: "Fé e propósito", short: "Fé", icon: HandHeart, available: true },
  { href: "/financas", label: "Finanças", short: "Finanças", icon: Wallet, available: true },
  { href: "/desafios", label: "Desafios", short: "Desafios", icon: Flag, available: true },
  { href: "/evolucao", label: "Evolução", short: "Evolução", icon: LineChart, available: true },
  { href: "/configuracoes", label: "Configurações", short: "Ajustes", icon: Settings, available: true },
];
