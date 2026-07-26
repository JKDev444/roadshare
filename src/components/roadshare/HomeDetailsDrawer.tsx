import { useEffect, useMemo, useState } from "react";
import { X, Trash2, FlipHorizontal2, ArrowUp, ArrowDown, Copy, TrendingDown, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { Home as RoadHome, Segment } from "@/lib/roadshare/layout";

/** What the drawer asks the parent for as the user tweaks the pending home. */
export type HomePatchPreview = {
  frontageFtOverride: number | null;
  skipFromMath: boolean;
};
/** What the parent returns so the drawer can show the live share estimate. */
export type HomeShareEstimate = {
  ready: boolean;
  share: number; // 0..1
  perYear: number; // dollars/yr
  deltaVsEqual: number; // + means paying more than equal split
};

export function HomeDetailsDrawer({
  home,
  segments,
  onClose,
  onSave,
  onDelete,
  onReturnToTray,
  onFlipSide,
  onMoveInOrder,
  onDuplicate,
  livePreview,
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
  /** Duplicate this home (copies name, address, frontage) into the tray. */
  onDuplicate?: (id: string) => void;
  /** Live "your share" estimator. Given the pending patch, returns the share
   *  numbers so the user can see how their frontage/skip change moves the price. */
  livePreview?: (homeId: string, patch: HomePatchPreview) => HomeShareEstimate | null;
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

  // Live-preview: recompute the share whenever frontage / skip changes.
  const frontageNumber = frontage.trim() === "" ? null : Math.max(0, Number(frontage) || 0);
  const preview = useMemo(() => {
    if (!livePreview || !home) return null;
    return livePreview(home.id, { frontageFtOverride: frontageNumber, skipFromMath: skip });
  }, [livePreview, home, frontageNumber, skip]);
  const usdFmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-background/50 backdrop-blur-sm" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Home details"
        className="flex h-full w-full max-w-lg flex-col overflow-y-auto overflow-x-hidden border-l border-border bg-card p-5 shadow-2xl sm:p-6"
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

        {/* Live "your share" preview — this is the whole point of the app, so we
            show it right at the top and update it as the user drags the slider. */}
        {preview && (
          <div className="mt-4 rounded-2xl border border-gold/60 bg-gradient-to-br from-gold/20 to-gold/5 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">This home's share</div>
            {preview.ready ? (
              <>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-bold text-foreground">{usdFmt(preview.perYear)}</span>
                  <span className="text-xs text-muted-foreground">/ year</span>
                  <span className="ml-2 font-mono text-xs font-semibold text-foreground">{(preview.share * 100).toFixed(1)}%</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px]">
                  {Math.abs(preview.deltaVsEqual) < 1 ? (
                    <span className="text-muted-foreground">Same as an equal split.</span>
                  ) : preview.deltaVsEqual > 0 ? (
                    <span className="flex items-center gap-0.5 text-destructive">
                      <TrendingUp className="h-3 w-3" /> {usdFmt(preview.deltaVsEqual)} more than an equal split
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-selected">
                      <TrendingDown className="h-3 w-3" /> {usdFmt(-preview.deltaVsEqual)} less than an equal split
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                We'll show the yearly share once your road + entrances are set.
              </p>
            )}
          </div>
        )}

        <div className="mt-5 space-y-4">
          <label className="block">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address or label</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1" placeholder="123 Cedar Lane" />
          </label>

          <label className="block">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Owner or family (optional)</Label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} className="mt-1" placeholder="The Johnsons" />
          </label>

          <div className="rounded-2xl border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                How much road does this home touch?
              </Label>
              <span className="font-mono text-sm font-bold text-foreground">
                {frontageNumber != null ? `${frontageNumber} ft` : "Auto"}
              </span>
            </div>
            <Slider
              className="mt-3"
              min={10}
              max={400}
              step={5}
              value={[frontageNumber ?? 100]}
              onValueChange={(v) => setFrontage(String(v[0]))}
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Drag to override. More road = bigger share.</span>
              {frontageNumber != null && (
                <button
                  type="button"
                  onClick={() => setFrontage("")}
                  className="font-semibold text-primary hover:underline"
                >
                  Use map estimate
                </button>
              )}
            </div>
          </div>

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
              <span className="block font-semibold">Don't count in the split</span>
              <span className="block text-xs text-muted-foreground">Keep the home on the map but leave it out of the money math.</span>
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

        {/* Actions: two rows so nothing ever needs a horizontal scrollbar. */}
        <div className="mt-6 space-y-2 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="flex-1">Cancel</Button>
            <Button size="sm" onClick={save} className="flex-1">Save changes</Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
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
            <div className="flex flex-wrap items-center gap-2">
              {onDuplicate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onDuplicate(home.id);
                    onClose();
                  }}
                >
                  <Copy className="h-4 w-4" /> Duplicate
                </Button>
              )}
              {onReturnToTray && home.position !== null && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onReturnToTray(home.id);
                    onClose();
                  }}
                >
                  Take off the map
                </Button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}