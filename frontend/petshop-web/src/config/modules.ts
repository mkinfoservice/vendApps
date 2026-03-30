import {
  ShoppingBag,
  Headphones,
  CalendarDays,
  Package,
  BarChart3,
  DollarSign,
  CreditCard,
  Boxes,
  ShoppingCart,
  Truck,
  Route,
  Bike,
  Users,
  Star,
  Tag,
  Receipt,
  Printer,
  Scale,
  RefreshCw,
  Settings,
  Monitor,
  FileText,
  Sparkles,
  Store,
  type LucideIcon,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ModuleGroup =
  | "OPERACAO"
  | "COMERCIAL"
  | "LOGISTICA"
  | "GESTAO"
  | "PLATAFORMA";

export interface AppModule {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  /** Rota destino. Aponta para /admin/* enquanto a migração incremental ocorre. */
  route: string;
  group: ModuleGroup;
  /** null = visível para todos os perfis */
  roles: string[] | null;
  isActive: boolean;
}

// ── Metadados dos grupos ───────────────────────────────────────────────────────

export const MODULE_GROUPS: Record<
  ModuleGroup,
  { label: string; description: string }
> = {
  OPERACAO: {
    label: "Operação",
    description: "Atendimento, pedidos e agenda do dia",
  },
  COMERCIAL: {
    label: "Comercial",
    description: "Produtos, promoções e clientes",
  },
  LOGISTICA: {
    label: "Logística",
    description: "Entregadores, rotas e rastreamento",
  },
  GESTAO: {
    label: "Gestão",
    description: "Financeiro, caixa, estoque e relatórios",
  },
  PLATAFORMA: {
    label: "Plataforma",
    description: "Equipe, integrações e configurações",
  },
};

export function getGroupOrder(): ModuleGroup[] {
  return ["OPERACAO", "COMERCIAL", "LOGISTICA", "GESTAO", "PLATAFORMA"];
}

// ── Registro de módulos ────────────────────────────────────────────────────────

export const APP_MODULES: AppModule[] = [
  // ── OPERAÇÃO ──────────────────────────────────────────────────────────────
  {
    id: "pdv",
    label: "Frente de Caixa",
    description: "Abrir o PDV e registrar vendas no balcão",
    icon: Monitor,
    iconColor: "#7c5cf8",
    iconBg: "rgba(124,92,248,0.12)",
    route: "/pdv",
    group: "OPERACAO",
    roles: null,
    isActive: true,
  },
  {
    id: "orcamento",
    label: "Orçamento / DAV",
    description: "Montar orçamento para o cliente levar ao caixa",
    icon: FileText,
    iconColor: "#10b981",
    iconBg: "rgba(16,185,129,0.12)",
    route: "/app/atendimento/pedido",
    group: "OPERACAO",
    roles: null,
    isActive: true,
  },
  {
    id: "pedidos",
    label: "Pedidos",
    description: "Acompanhe e gerencie todos os pedidos em andamento",
    icon: ShoppingBag,
    iconColor: "#7c5cf8",
    iconBg: "rgba(124,92,248,0.12)",
    route: "/app/pedidos",
    group: "OPERACAO",
    roles: null,
    isActive: true,
  },
  {
    id: "atendimento",
    label: "Atendimento",
    description: "Central de atendimento e pedidos por telefone",
    icon: Headphones,
    iconColor: "#0ea5e9",
    iconBg: "rgba(14,165,233,0.12)",
    route: "/app/atendimento",
    group: "OPERACAO",
    roles: null,
    isActive: true,
  },
  {
    id: "agenda",
    label: "Agenda",
    description: "Agendamentos de serviços, banho & tosa",
    icon: CalendarDays,
    iconColor: "#10b981",
    iconBg: "rgba(16,185,129,0.12)",
    route: "/app/agenda",
    group: "OPERACAO",
    roles: null,
    isActive: true,
  },
  {
    id: "impressao",
    label: "Impressão",
    description: "Fila de impressão de recibos e etiquetas",
    icon: Printer,
    iconColor: "#f59e0b",
    iconBg: "rgba(245,158,11,0.12)",
    route: "/app/impressao",
    group: "OPERACAO",
    roles: null,
    isActive: true,
  },

  // ── COMERCIAL ─────────────────────────────────────────────────────────────
  {
    id: "produtos",
    label: "Produtos",
    description: "Cadastro e edição do catálogo de produtos",
    icon: Package,
    iconColor: "#8b5cf6",
    iconBg: "rgba(139,92,246,0.12)",
    route: "/app/produtos",
    group: "COMERCIAL",
    roles: null,
    isActive: true,
  },
  {
    id: "clientes",
    label: "Clientes",
    description: "Base de clientes e histórico de compras",
    icon: Users,
    iconColor: "#06b6d4",
    iconBg: "rgba(6,182,212,0.12)",
    route: "/app/clientes",
    group: "COMERCIAL",
    roles: null,
    isActive: true,
  },
  {
    id: "fidelidade",
    label: "Fidelidade",
    description: "Programa de pontos e recompensas para clientes",
    icon: Star,
    iconColor: "#f59e0b",
    iconBg: "rgba(245,158,11,0.12)",
    route: "/app/fidelidade",
    group: "COMERCIAL",
    roles: ["admin", "gerente"],
    isActive: true,
  },
  {
    id: "promocoes",
    label: "Promoções",
    description: "Descontos, cupons e ofertas especiais",
    icon: Tag,
    iconColor: "#ec4899",
    iconBg: "rgba(236,72,153,0.12)",
    route: "/app/promocoes",
    group: "COMERCIAL",
    roles: ["admin", "gerente"],
    isActive: true,
  },

  // ── LOGÍSTICA ─────────────────────────────────────────────────────────────
  {
    id: "rotas",
    label: "Rotas",
    description: "Planejamento e rastreamento de rotas de entrega",
    icon: Route,
    iconColor: "#3b82f6",
    iconBg: "rgba(59,130,246,0.12)",
    route: "/app/logistica/rotas",
    group: "LOGISTICA",
    roles: null,
    isActive: true,
  },
  {
    id: "entregadores",
    label: "Entregadores",
    description: "Cadastro e gestão dos entregadores",
    icon: Bike,
    iconColor: "#f97316",
    iconBg: "rgba(249,115,22,0.12)",
    route: "/app/logistica/entregadores",
    group: "LOGISTICA",
    roles: ["admin", "gerente"],
    isActive: true,
  },
  {
    id: "compras",
    label: "Compras",
    description: "Pedidos de compra e reposição de estoque",
    icon: ShoppingCart,
    iconColor: "#84cc16",
    iconBg: "rgba(132,204,22,0.12)",
    route: "/app/compras",
    group: "LOGISTICA",
    roles: ["admin", "gerente"],
    isActive: true,
  },
  {
    id: "fornecedores",
    label: "Fornecedores",
    description: "Cadastro e gestão de fornecedores",
    icon: Truck,
    iconColor: "#6366f1",
    iconBg: "rgba(99,102,241,0.12)",
    route: "/app/fornecedores",
    group: "LOGISTICA",
    roles: ["admin", "gerente"],
    isActive: true,
  },
  {
    id: "insumos",
    label: "Insumos",
    description: "Materiais operacionais e alerta de estoque mínimo",
    icon: Boxes,
    iconColor: "#0ea5e9",
    iconBg: "rgba(14,165,233,0.12)",
    route: "/app/insumos",
    group: "LOGISTICA",
    roles: ["admin", "gerente"],
    isActive: true,
  },

  // ── GESTÃO ────────────────────────────────────────────────────────────────
  {
    id: "financeiro",
    label: "Financeiro",
    description: "Fluxo de caixa e lançamentos financeiros",
    icon: DollarSign,
    iconColor: "#10b981",
    iconBg: "rgba(16,185,129,0.12)",
    route: "/app/financeiro",
    group: "GESTAO",
    roles: ["admin", "gerente"],
    isActive: true,
  },
  {
    id: "caixa",
    label: "Caixa / PDV",
    description: "Configurar terminais e visualizar sessões de caixa",
    icon: CreditCard,
    iconColor: "#7c5cf8",
    iconBg: "rgba(124,92,248,0.12)",
    route: "/app/caixa",
    group: "GESTAO",
    roles: null,
    isActive: true,
  },
  {
    id: "estoque",
    label: "Estoque",
    description: "Controle de inventário e movimentações",
    icon: Boxes,
    iconColor: "#f59e0b",
    iconBg: "rgba(245,158,11,0.12)",
    route: "/app/estoque",
    group: "GESTAO",
    roles: ["admin", "gerente"],
    isActive: true,
  },
  {
    id: "relatorios",
    label: "Relatórios",
    description: "Análises, métricas e indicadores de performance",
    icon: BarChart3,
    iconColor: "#0ea5e9",
    iconBg: "rgba(14,165,233,0.12)",
    route: "/app/relatorios",
    group: "GESTAO",
    roles: ["admin", "gerente"],
    isActive: true,
  },

  // ── PLATAFORMA ────────────────────────────────────────────────────────────
  {
    id: "equipe",
    label: "Equipe",
    description: "Usuários, perfis de acesso e permissões",
    icon: Users,
    iconColor: "#8b5cf6",
    iconBg: "rgba(139,92,246,0.12)",
    route: "/app/equipe",
    group: "PLATAFORMA",
    roles: ["admin"],
    isActive: true,
  },
  {
    id: "fiscal",
    label: "Fiscal",
    description: "Configuração de impostos e emissão de NF",
    icon: Receipt,
    iconColor: "#64748b",
    iconBg: "rgba(100,116,139,0.12)",
    route: "/app/fiscal",
    group: "PLATAFORMA",
    roles: ["admin"],
    isActive: true,
  },
  {
    id: "balanca",
    label: "Balança",
    description: "Agentes de integração com balanças eletrônicas",
    icon: Scale,
    iconColor: "#94a3b8",
    iconBg: "rgba(148,163,184,0.12)",
    route: "/app/balanca",
    group: "PLATAFORMA",
    roles: ["admin"],
    isActive: true,
  },
  {
    id: "sync",
    label: "Sincronização",
    description: "Importação e sync com sistemas externos",
    icon: RefreshCw,
    iconColor: "#22c55e",
    iconBg: "rgba(34,197,94,0.12)",
    route: "/app/sync",
    group: "PLATAFORMA",
    roles: ["admin"],
    isActive: false,
  },
  {
    id: "enriquecimento",
    label: "Enriquecimento",
    description: "Normaliza nomes e busca imagens automaticamente para o catálogo",
    icon: Sparkles,
    iconColor: "#7c5cf8",
    iconBg: "rgba(124,92,248,0.12)",
    route: "/app/enriquecimento",
    group: "PLATAFORMA",
    roles: ["admin", "gerente"],
    isActive: true,
  },
  {
    id: "loja-online",
    label: "Loja Online",
    description: "Banner rotativo, cores e identidade visual da loja",
    icon: Store,
    iconColor: "#ec4899",
    iconBg: "rgba(236,72,153,0.12)",
    route: "/app/configuracao-loja",
    group: "PLATAFORMA",
    roles: ["admin", "gerente"],
    isActive: true,
  },
  {
    id: "configuracoes",
    label: "Configurações",
    description: "Configurações gerais da empresa e do sistema",
    icon: Settings,
    iconColor: "#64748b",
    iconBg: "rgba(100,116,139,0.12)",
    route: "/app/equipe",
    group: "PLATAFORMA",
    roles: ["admin"],
    isActive: true,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Retorna true se o usuário com `role` pode acessar o módulo.
 * - `module.roles === null` → aberto para todos os perfis autenticados
 * - caso contrário, o role deve estar na lista
 */
export function canAccess(module: AppModule, role: string | null): boolean {
  if (module.roles === null) return true;
  if (role === null) return false;
  return module.roles.includes(role);
}

export function getModulesByGroup(): Record<ModuleGroup, AppModule[]> {
  return APP_MODULES.reduce(
    (acc, mod) => {
      if (!acc[mod.group]) acc[mod.group] = [];
      acc[mod.group].push(mod);
      return acc;
    },
    {} as Record<ModuleGroup, AppModule[]>,
  );
}

export function getModuleById(id: string): AppModule | undefined {
  return APP_MODULES.find((m) => m.id === id);
}
