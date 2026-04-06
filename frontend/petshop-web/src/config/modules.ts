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
  Coffee,
  HandCoins,
  Plug,
  Calculator,
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
  featureKey?: string;
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
    id: "mesas",
    label: "Mesas",
    description: "Auto-atendimento via QR Code e gestão de mesas",
    icon: Coffee,
    iconColor: "#C8953A",
    iconBg: "rgba(200,149,58,0.14)",
    route: "/app/mesas",
    group: "OPERACAO",
    roles: null,
    isActive: true,
  },
  {
    id: "pdv",
    label: "Frente de Caixa",
    description: "Abrir o PDV e registrar vendas no balcão",
    icon: Monitor,
    iconColor: "#C8953A",
    iconBg: "rgba(200,149,58,0.14)",
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
    iconColor: "#A07230",
    iconBg: "rgba(160,114,48,0.14)",
    route: "/app/atendimento/pedido",
    group: "OPERACAO",
    roles: null,
    featureKey: "dav_menu",
    isActive: true,
  },
  {
    id: "pedidos",
    label: "Pedidos",
    description: "Acompanhe e gerencie todos os pedidos em andamento",
    icon: ShoppingBag,
    iconColor: "#6B4F3A",
    iconBg: "rgba(107,79,58,0.14)",
    route: "/app/pedidos",
    group: "OPERACAO",
    roles: null,
    isActive: true,
  },
  {
    id: "atendimento",
    label: "Atendimento",
    description: "Atendimento presencial e montagem de pedidos no balcão",
    icon: Headphones,
    iconColor: "#C8953A",
    iconBg: "rgba(200,149,58,0.14)",
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
    iconColor: "#6B4F3A",
    iconBg: "rgba(107,79,58,0.14)",
    route: "/app/agenda",
    group: "OPERACAO",
    roles: null,
    featureKey: "agenda",
    isActive: true,
  },
  {
    id: "comissoes",
    label: "Comissões",
    description: "Cálculo de comissão e distribuição de gorjetas",
    icon: HandCoins,
    iconColor: "#A07230",
    iconBg: "rgba(160,114,48,0.14)",
    route: "/app/comissoes",
    group: "OPERACAO",
    roles: ["admin", "gerente"],
    featureKey: "commissions",
    isActive: true,
  },
  {
    id: "impressao",
    label: "Impressão",
    description: "Fila de impressão de recibos e etiquetas",
    icon: Printer,
    iconColor: "#A07230",
    iconBg: "rgba(160,114,48,0.14)",
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
    iconColor: "#6B4F3A",
    iconBg: "rgba(107,79,58,0.14)",
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
    iconColor: "#C8953A",
    iconBg: "rgba(200,149,58,0.14)",
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
    iconColor: "#C8953A",
    iconBg: "rgba(200,149,58,0.14)",
    route: "/app/fidelidade",
    group: "COMERCIAL",
    roles: ["admin", "gerente"],
    featureKey: "loyalty_program",
    isActive: true,
  },
  {
    id: "promocoes",
    label: "Promoções",
    description: "Descontos, cupons e ofertas especiais",
    icon: Tag,
    iconColor: "#A07230",
    iconBg: "rgba(160,114,48,0.14)",
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
    iconColor: "#6B4F3A",
    iconBg: "rgba(107,79,58,0.14)",
    route: "/app/logistica/rotas",
    group: "LOGISTICA",
    roles: null,
    featureKey: "own_delivery",
    isActive: true,
  },
  {
    id: "entregadores",
    label: "Entregadores",
    description: "Cadastro e gestão dos entregadores",
    icon: Bike,
    iconColor: "#A07230",
    iconBg: "rgba(160,114,48,0.14)",
    route: "/app/logistica/entregadores",
    group: "LOGISTICA",
    roles: ["admin", "gerente"],
    featureKey: "own_delivery",
    isActive: true,
  },
  {
    id: "entregas",
    label: "Entregas",
    description: "Acompanhar entregas em aberto e histórico de pedidos delivery",
    icon: Truck,
    iconColor: "#6B4F3A",
    iconBg: "rgba(107,79,58,0.14)",
    route: "/app/logistica/entregas",
    group: "LOGISTICA",
    roles: null,
    isActive: true,
  },
  {
    id: "compras",
    label: "Compras",
    description: "Pedidos de compra e reposição de estoque",
    icon: ShoppingCart,
    iconColor: "#6B4F3A",
    iconBg: "rgba(107,79,58,0.14)",
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
    iconColor: "#A07230",
    iconBg: "rgba(160,114,48,0.14)",
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
    iconColor: "#6B4F3A",
    iconBg: "rgba(107,79,58,0.14)",
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
    iconColor: "#C8953A",
    iconBg: "rgba(200,149,58,0.14)",
    route: "/app/financeiro",
    group: "GESTAO",
    roles: ["admin", "gerente"],
    featureKey: "financial_menu",
    isActive: true,
  },
  {
    id: "caixa",
    label: "Caixa / PDV",
    description: "Configurar terminais e visualizar sessões de caixa",
    icon: CreditCard,
    iconColor: "#A07230",
    iconBg: "rgba(160,114,48,0.14)",
    route: "/app/caixa",
    group: "GESTAO",
    roles: null,
    isActive: true,
  },
  {
    id: "vendas-pdv",
    label: "Vendas do Caixa",
    description: "Consultar vendas registradas no PDV com filtros fiscais",
    icon: Receipt,
    iconColor: "#A07230",
    iconBg: "rgba(160,114,48,0.14)",
    route: "/app/caixa/vendas",
    group: "GESTAO",
    roles: ["admin", "gerente"],
    isActive: true,
  },
  {
    id: "estoque",
    label: "Estoque",
    description: "Controle de inventário e movimentações",
    icon: Boxes,
    iconColor: "#6B4F3A",
    iconBg: "rgba(107,79,58,0.14)",
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
    iconColor: "#C8953A",
    iconBg: "rgba(200,149,58,0.14)",
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
    iconColor: "#6B4F3A",
    iconBg: "rgba(107,79,58,0.14)",
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
    iconColor: "#A07230",
    iconBg: "rgba(160,114,48,0.14)",
    route: "/app/fiscal",
    group: "PLATAFORMA",
    roles: ["admin"],
    isActive: true,
  },
  {
    id: "fiscal-documentos",
    label: "Documentos Fiscais",
    description: "Consultar NFC-e emitidas, status SEFAZ e notas em contingência",
    icon: FileText,
    iconColor: "#A07230",
    iconBg: "rgba(160,114,48,0.14)",
    route: "/app/fiscal/documentos",
    group: "PLATAFORMA",
    roles: ["admin", "gerente"],
    isActive: true,
  },
  {
    id: "contabilidade",
    label: "Contabilidade",
    description: "Fechamento contábil automático e envio ao contador",
    icon: Calculator,
    iconColor: "#7C5CF8",
    iconBg: "rgba(124,92,248,0.14)",
    route: "/app/configuracoes/contabilidade",
    group: "PLATAFORMA",
    roles: ["admin", "gerente"],
    featureKey: "accounting_email_dispatch",
    isActive: true,
  },
  {
    id: "balanca",
    label: "Balança",
    description: "Agentes de integração com balanças eletrônicas",
    icon: Scale,
    iconColor: "#6B4F3A",
    iconBg: "rgba(107,79,58,0.14)",
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
    iconColor: "#A07230",
    iconBg: "rgba(160,114,48,0.14)",
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
    iconColor: "#C8953A",
    iconBg: "rgba(200,149,58,0.14)",
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
    iconColor: "#A07230",
    iconBg: "rgba(160,114,48,0.14)",
    route: "/app/configuracao-loja",
    group: "PLATAFORMA",
    roles: ["admin", "gerente"],
    isActive: true,
  },
  {
    id: "marketplace",
    label: "Marketplaces",
    description: "Integrações com iFood e outros canais de venda",
    icon: Plug,
    iconColor: "#ea4c00",
    iconBg: "rgba(234,76,0,0.12)",
    route: "/app/marketplace",
    group: "PLATAFORMA",
    roles: ["admin"],
    isActive: true,
  },
  {
    id: "configuracoes",
    label: "Configurações",
    description: "Configurações gerais da empresa e do sistema",
    icon: Settings,
    iconColor: "#6B4F3A",
    iconBg: "rgba(107,79,58,0.14)",
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
export function canAccess(
  module: AppModule,
  role: string | null,
  features?: Record<string, boolean> | null,
): boolean {
  if (module.roles !== null) {
    if (role === null || !module.roles.includes(role)) return false;
  }

  if (module.featureKey) {
    return (features?.[module.featureKey] ?? true) === true;
  }

  return true;
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
