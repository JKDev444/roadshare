import { Link, useNavigate } from "@tanstack/react-router";
import { FileText, LogOut, Map as MapIcon, MoreHorizontal, Plus, Redo2, RotateCcw, RotateCw, Route as RouteIcon, Undo2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  roadName: string;
  active: "map" | "documents";
  onReset?: () => void;
  busy?: boolean;
  /** Optional map-editing toolbar (only shown on the Map page). */
  toolbar?: ReactNode;
}

export function AppHeader({ roadName, active, onReset, busy = false, toolbar }: Props) {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }
  const navLink = (to: "/my-road" | "/documents", label: string, Icon: typeof MapIcon, key: "map" | "documents") => (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
        active === key
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
  return (
    <header
      className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur"
      style={{ ["--rs-header-h" as string]: toolbar ? "113px" : "57px" }}
    >
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <Link to="/my-road" className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <RouteIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-bold leading-tight">{roadName}</span>
            <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">RoadShare</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navLink("/my-road", "Map", MapIcon, "map")}
          {navLink("/documents", "Documents", FileText, "documents")}
        </nav>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More options" disabled={busy}>
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {onReset && (
              <DropdownMenuItem onClick={onReset} disabled={busy}>
                <RotateCcw className="mr-2 h-4 w-4" /> Start over
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Mobile nav row */}
      <div className="flex items-center gap-1 border-t border-border/60 px-4 py-1.5 md:hidden">
        {navLink("/my-road", "Map", MapIcon, "map")}
        {navLink("/documents", "Documents", FileText, "documents")}
      </div>
      {toolbar && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 bg-background/80 px-4 py-2">
          {toolbar}
        </div>
      )}
    </header>
  );
}

/** Small button set the Map page passes into AppHeader's toolbar slot. */
export function MapToolbar({
  onAddHome,
  onAddSegment,
  onRotate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  placingRoadId,
  onCancelPlaceRoad,
}: {
  onAddHome?: () => void;
  onAddSegment?: () => void;
  onRotate?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  placingRoadId: string | null;
  onCancelPlaceRoad?: () => void;
}) {
  if (placingRoadId) {
    return (
      <div className="flex w-full items-center gap-3 rounded-lg bg-primary/10 px-3 py-1.5 text-sm text-primary">
        <span className="font-semibold">Placing a new road</span>
        <span className="text-primary/80">Click two points on the map to set start and end.</span>
        <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={onCancelPlaceRoad}>
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <>
      {onAddHome && (
        <Button size="sm" variant="outline" className="h-8" onClick={onAddHome}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add home
        </Button>
      )}
      {onAddSegment && (
        <Button size="sm" variant="outline" className="h-8" onClick={onAddSegment}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add road
        </Button>
      )}
      {onRotate && (
        <Button size="sm" variant="ghost" className="h-8" onClick={onRotate} aria-label="Rotate map">
          <RotateCw className="h-4 w-4" />
        </Button>
      )}
      <div className="ml-auto flex items-center gap-1">
        {onUndo && (
          <Button size="sm" variant="ghost" className="h-8" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
            <Undo2 className="h-4 w-4" />
          </Button>
        )}
        {onRedo && (
          <Button size="sm" variant="ghost" className="h-8" onClick={onRedo} disabled={!canRedo} aria-label="Redo">
            <Redo2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </>
  );
}