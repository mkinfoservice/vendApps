import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, LayoutDashboard, ShoppingBag, Route, DollarSign, Package } from "lucide-react";
import { clearToken } from "@/features/admin/auth/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Pedidos", icon: ShoppingBag, exact: false },
  { to: "/admin/products", label: "Produtos", icon: Package, exact: false },
  { to: "/admin/routes", label: "Rotas", icon: Route, exact: false },
  { to: "/admin/financeiro", label: "Financeiro", icon: DollarSign, exact: false },
];

function NavItem({
  to,
  label,
  icon: Icon,
  exact,
}: {
  to: string;
  label: string;
  icon: React.ElementType;
  exact: boolean;
}) {
  const loc = useLocation();
  const active = exact
    ? loc.pathname === to
    : loc.pathname === to || loc.pathname.startsWith(to + "/");

  return (
    <Link
      to={to}
      className={[
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
        active
          ? "bg-brand text-white shadow-[0_0_20px_rgba(124,92,248,0.35)]"
          : "text-[--text-muted] hover:text-[--text] hover:bg-[--surface-2]",
      ].join(" ")}
    >
      <Icon size={16} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export function AdminNav() {
  const navigate = useNavigate();

  function handleLogout() {
    clearToken();
    navigate("/admin/login", { replace: true });
  }

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-sm"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="mx-auto max-w-[1400px] px-4 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center text-white text-xs font-black select-none">
            V
          </div>
          <span className="text-sm font-bold hidden md:block" style={{ color: "var(--text)" }}>
            vendApps Admin
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(239,68,68,0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
            }}
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
