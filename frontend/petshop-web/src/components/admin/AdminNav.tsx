import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { clearToken } from "@/features/admin/auth/auth";

function NavItem({ to, label }: { to: string; label: string }) {
  const loc = useLocation();
  const active = loc.pathname === to || loc.pathname.startsWith(to + "/");

  return (
    <Link
      to={to}
      className={[
        "px-3 py-2 rounded-xl text-sm font-bold transition",
        active
          ? "bg-white text-black"
          : "text-zinc-200 hover:bg-zinc-900 hover:text-white border border-zinc-800",
      ].join(" ")}
    >
      {label}
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
    <div className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="font-extrabold text-zinc-50">Petshop Admin</div>

          <div className="hidden sm:flex items-center gap-2 ml-3">
            <NavItem to="/admin/orders" label="Pedidos" />
            <NavItem to="/admin/routes" label="Rotas" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* versão mobile: botões menores */}
          <div className="flex sm:hidden items-center gap-2">
            <NavItem to="/admin/orders" label="Pedidos" />
            <NavItem to="/admin/routes" label="Rotas" />
          </div>

          <Button
            variant="outline"
            className="rounded-xl"
            type="button"
            onClick={handleLogout}
          >
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
