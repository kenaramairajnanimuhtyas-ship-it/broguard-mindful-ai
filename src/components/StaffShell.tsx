import { Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileQuestion, Users, BarChart3, LogOut, Shield, Loader2 } from "lucide-react";
import { useEffect } from "react";

export function StaffShell() {
  const { user, loading, isStaff, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-medium">Akun Anda belum memiliki akses staff.</p>
          <p className="mt-2 text-sm text-muted-foreground">Hubungi admin sekolah.</p>
          <Button className="mt-4" onClick={signOut}>Keluar</Button>
        </div>
      </div>
    );
  }

  const nav = [
    { to: "/dashboard", label: "Beranda", icon: LayoutDashboard },
    { to: "/dashboard/questionnaires", label: "Kuesioner", icon: FileQuestion },
    { to: "/dashboard/students", label: "Siswa", icon: Users },
    { to: "/dashboard/results", label: "Hasil & Analisis", icon: BarChart3 },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 flex-col border-r border-border/60 bg-card/70 p-5 backdrop-blur md:flex">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-lg font-bold leading-none">BroGuardAI</p>
            <p className="text-xs text-muted-foreground">Panel Guru BK</p>
          </div>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((n) => {
            const active = location.pathname === n.to || (n.to !== "/dashboard" && location.pathname.startsWith(n.to));
            return (
              <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? "bg-primary/15 text-primary font-medium" : "text-foreground/70 hover:bg-muted"}`}>
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 rounded-xl bg-muted/60 p-3 text-xs">
          <p className="truncate font-medium">{user.email}</p>
          <Button size="sm" variant="ghost" className="mt-2 w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5" /> Keluar
          </Button>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-border/60 bg-card/50 px-6 py-3 backdrop-blur md:hidden">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <Shield className="h-5 w-5 text-primary" /> BroGuardAI
          </Link>
          <Button size="sm" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
