import { useMemo } from "react";
import { Plus, Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Home as RoadHome } from "@/lib/roadshare/layout";

/**
 * Bottom-docked tray showing every home that isn't placed on the map yet.
 * Users drag a card onto the plat — nothing floats loose.
 */
export function HomesTray({
  homes,
  onAddHome,
  onBulkAdd,
  onOpenHome,
}: {
  homes: RoadHome[];
  onAddHome?: () => void;
  onBulkAdd?: () => void;
  onOpenHome?: (id: string) => void;
}) {
  const tray = useMemo(() => homes.filter((h) => !h.position), [homes]);
  const placedCount = homes.length - tray.length;

  if (homes.length === 0) return null;

  return (
    <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-lg ring-1 ring-border/40 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-sm font-bold leading-tight">Homes to place</p>
            <p className="text-[11px] text-muted-foreground">
              {placedCount} of {homes.length} placed
              {tray.length > 0 ? " — drag a card onto a road" : " — nice, everyone's on the map"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onBulkAdd && (
            <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={onBulkAdd}>
              + Add many
            </Button>
          )}
          {onAddHome && (
            <Button size="sm" variant="outline" className="h-7 rounded-full px-2 text-xs" onClick={onAddHome}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          )}
        </div>
      </div>

      {tray.length > 0 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {tray.map((h, i) => (
            <li key={h.id} className="shrink-0">
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("application/x-roadshare-home", h.id);
                  e.dataTransfer.setData("text/plain", h.id);
                }}
                onDoubleClick={() => onOpenHome?.(h.id)}
                className="flex min-w-[168px] cursor-grab items-center gap-2 rounded-xl border border-dashed border-primary/50 bg-background px-3 py-2 text-left text-xs shadow-sm transition-transform hover:-translate-y-0.5 hover:border-primary hover:shadow-md active:cursor-grabbing"
                title="Drag onto a road, or double-click to edit"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted font-mono text-[10px] font-bold">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{h.address ?? h.label}</span>
                  <span className="block text-[10px] text-muted-foreground">Drag onto a road</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}