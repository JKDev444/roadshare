import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Route as RouteIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PRIMARY_NAV } from "@/lib/site/content";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <RouteIcon className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">RoadShare</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/contact">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/tools/cedar-hollow">Build a free scenario</Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-border/70 md:hidden",
          open ? "max-h-96" : "max-h-0",
        )}
        style={{ transition: "max-height 250ms ease" }}
      >
        <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Button className="mt-2" asChild onClick={() => setOpen(false)}>
            <Link to="/tools/cedar-hollow">Build a free scenario</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
