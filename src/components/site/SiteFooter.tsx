import { Link } from "@tanstack/react-router";
import { Route as RouteIcon } from "lucide-react";

import { FOOTER_GROUPS, SITE } from "@/lib/site/content";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                <RouteIcon className="h-5 w-5" />
              </span>
              <span className="font-display text-lg font-bold tracking-tight">RoadShare</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">{SITE.description}</p>
          </div>
          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="font-display text-sm font-semibold">{group.title}</h3>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} RoadShare. {SITE.tagline}.</p>
          <p>Sample Cedar Hollow data. Not legal, title, or engineering advice.</p>
        </div>
      </div>
    </footer>
  );
}
