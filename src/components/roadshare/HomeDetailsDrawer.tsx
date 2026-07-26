import { useEffect, useState } from "react";
import { X, Trash2, FlipHorizontal2, ArrowUp, ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Home as RoadHome, Segment } from "@/lib/roadshare/layout";

export function HomeDetailsDrawer({
  home,
  segments,
  onClose,
  onSave,
  onDelete,
  onReturnToTray,
  onFlipSide,
  onMoveInOrder,
}: {
  home: RoadHome | null;
  segments: Segment[];
  onClose: () => void;
  onSave: (id: string, patch: Partial<RoadHome>) => void;
  onDelete?: (id: string) => void;
  onReturnToTray?: (id: string) => void;
  /** Move the home to the opposite side of its road. */
  onFlipSide?: (id: string) => void;
  /** Shift the home earlier/later in the ordering along its road (auto-spaces). */
  onMoveInOrder?: (id: string, dir: -1 | 1) => void;
}) {
  const [address, setAddress] = useState("");
  const [owner, setOwner] = useState("");
  const [frontage, setFrontage] = useState<string>("");
  const [segId, setSegId] = useState<string>("");
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    if (!home) return;
    setAddress(home.address ?? home.label ?? "");
    setOwner(home.ownerLabel ?? "");
    setFrontage(home.frontageFtOverride != null ? String(home.frontageFtOverride) : "");
    setSegId(home.segmentId ?? segments[0]?.id ?? "");
    setSkip(!!home.skipFromMath);
  }, [home, segments]);

  if (!home) return null;

  function save() {
    if (!home) return;
    const label = address.trim().slice(0, 80) || home.label;
    const patch: Partial<RoadHome> = {
      label,
      address: address.trim() || null,
      ownerLabel: owner.trim() || null,
      frontageFtOverride: frontage.trim() === "" ? null : Math.max(0, Number(frontage) || 0),
      segmentId: segId || home.segmentId,
      skipFromMath: skip,
    };
    onSave(home.id, patch);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-background/50 backdrop-blur-sm" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Home details"
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Home details</p>
            <h2 className="mt-1 truncate font-display text-xl font-bold">{home.address ?? home.label}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-accent" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address or label</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1" placeholder="123 Cedar Lane" />
          </label>

          <label className="block">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Owner or family (optional)</Label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} className="mt-1" placeholder="The Johnsons" />
          </label>

          <label className="block">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Road frontage in feet (optional)
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={2000}
              step={1}
              value={frontage}
              onChange={(e) => setFrontage(e.target.value)}
              className="mt-1"
              placeholder="Auto — use the map estimate"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Only fill this in if you have a plat or survey. Otherwise the map estimates it.
            </p>
          </label>

          {segments.length > 1 && (
            <label className="block">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Which road?</Label>
              <select
                value={segId}
                onChange={(e) => setSegId(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
            <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} className="h-4 w-4 rounded" />
            <span className="text-sm">
              <span className="block font-semibold">Skip from cost math</span>
              <span className="block text-xs text-muted-foreground">Keep on the map but don't include in the split.</span>
            </span>
          </label>
        </div>

        {(onFlipSide || onMoveInOrder) && home.position && (
          <div className="mt-5 rounded-2xl border border-border bg-background p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Position on the road</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {onFlipSide && (
                <Button variant="outline" size="sm" onClick={() => onFlipSide(home.id)}>
                  <FlipHorizontal2 className="h-4 w-4" /> Flip to other side
                </Button>
              )}
              {onMoveInOrder && (
                <>
                  <Button variant="outline" size="sm" onClick={() => onMoveInOrder(home.id, -1)}>
                    <ArrowUp className="h-4 w-4" /> Move earlier
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onMoveInOrder(home.id, 1)}>
                    <ArrowDown className="h-4 w-4" /> Move later
                  </Button>
                </>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Move earlier/later re-spaces every home on this road so nothing overlaps.
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          {onDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                onDelete(home.id);
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          ) : <span />}
          <div className="flex items-center gap-2">
            {onReturnToTray && home.position !== null && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onReturnToTray(home.id);
                  onClose();
                }}
              >
                Move to tray
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={save}>Save</Button>
          </div>
        </div>
      </aside>
    </div>
  );
}