import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Route as RouteIcon,
  Settings,
  X,
  Home,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { displayName, initials, useSession } from "@/lib/auth/useSession";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOnboardingResetEasterEgg } from "./useOnboardingResetEasterEgg";

interface NavLink {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  tint: string; // tailwind bg color for the icon chip
}

const PRIMARY: NavLink[] = [
  { to: "/dashboard", label: "Home", icon: Home, tint: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  { to: "/map", label: "My Road", icon: MapIcon, tint: "bg-teal-500/15 text-teal-600 dark:text-teal-400" },
  { to: "/settings", label: "Settings", icon: Settings, tint: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
];

// SECONDARY intentionally empty — legacy screens are hidden from primary nav.

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useOnboardingResetEasterEgg();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  // (secondary nav removed — primary nav has everything)

  useEffect(() => setOpen(false), [pathname]);

  const name = displayName(user);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const renderLink = (item: NavLink) => {
    const active = pathname === item.to || pathname.startsWith(item.to + "/");
    const Icon = item.icon;
    return (
      <Link
        key={item.to}
        to={item.to}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all",
          active
            ? "bg-primary/8 text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
            item.tint,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside
        data-app-sidebar
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform lg:static lg:transform-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
              <RouteIcon className="h-4 w-4" />
            </span>
            <span className="font-display text-base font-bold tracking-tight">RoadShare</span>
          </Link>
          <button
            className="lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {PRIMARY.map(renderLink)}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {initials(name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur lg:px-8">
          <button
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
            <span>Menu</span>
          </button>
          <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
              <RouteIcon className="h-4 w-4" />
            </span>
            <span className="font-display text-base font-bold tracking-tight">RoadShare</span>
          </Link>
          <div className="flex-1" />
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}