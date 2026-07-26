import { useMemo, useState } from "react";
import { X, ArrowRight, Route as RouteIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Segment } from "@/lib/roadshare/layout";
import { cn } from "@/lib/utils";

const FT_PER_UNIT = 1.25;
const VIEW_W = 900;
const VIEW_H = 620;

type Mode = "extend" | "cross" | "standalone";
type Dir = "right" | "left" | "up" | "down";
type CrossAt = "start" | "middle" | "end";

export interface AddRoadSpec {
  name: string;
  widthFt: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export function AddRoadDialog({
  segments,
  onClose,
  onConfirm,
}: {
  segments: Segment[];
  onClose: () => void;
  onConfirm: (spec: AddRoadSpec) => void;
}) {
  const hasExisting = segments.length > 0 && segments.some((s) => s.geometry);
  const [mode, setMode] = useState<Mode>(hasExisting ? "extend" : "standalone");
  const [name, setName] = useState(`Road ${segments.length + 1}`);
  const [widthFt, setWidthFt] = useState(20);
  const [lengthFt, setLengthFt] = useState(400);

  // "Extend" params
  const firstWithGeom = segments.find((s) => s.geometry);
  const [attachTo, setAttachTo] = useState<string>(firstWithGeom?.id ?? segments[0]?.id ?? "");
  const [attachEnd, setAttachEnd] = useState<"a" | "b">("b");
  const [dir, setDir] = useState<Dir>("right");

  // "Cross" params
  const [crossAt, setCrossAt] = useState<CrossAt>("middle");

  const canGo = useMemo(() => {
    if (lengthFt < 40) return false;
    if (mode !== "standalone" && segments.length === 0) return false;
    if (mode !== "standalone" && !attachTo) return false;
    return true;
  }, [lengthFt, mode, segments.length, attachTo]);

  function dirVec(d: Dir): [number, number] {
    switch (d) {
      case "right": return [1, 0];
      case "left": return [-1, 0];
      case "up": return [0, -1];
      case "down": return [0, 1];
    }
  }

  function compute(): AddRoadSpec | null {
    const lenU = lengthFt / FT_PER_UNIT;
    if (mode === "standalone" || !hasExisting) {
      // Center-ish placement.
      const cx = VIEW_W / 2;
      const cy = VIEW_H / 2;
      const [ux, uy] = dirVec(dir);
      const ax = Math.round(cx - (ux * lenU) / 2);
      const ay = Math.round(cy - (uy * lenU) / 2);
      const bx = Math.round(cx + (ux * lenU) / 2);
      const by = Math.round(cy + (uy * lenU) / 2);
      return { name: name.trim() || "New road", widthFt, ax, ay, bx, by };
    }
    const src = segments.find((s) => s.id === attachTo);
    if (!src || !src.geometry) return null;
    const g = src.geometry;
    if (mode === "extend") {
      const ax = attachEnd === "a" ? g.ax : g.bx;
      const ay = attachEnd === "a" ? g.ay : g.by;
      const [ux, uy] = dirVec(dir);
      const bx = Math.round(ax + ux * lenU);
      const by = Math.round(ay + uy * lenU);
      return { name: name.trim() || "New road", widthFt, ax, ay, bx, by };
    }
    // cross: place perpendicular through src at chosen point.
    const t = crossAt === "start" ? 0.15 : crossAt === "end" ? 0.85 : 0.5;
    const cx = g.ax + (g.bx - g.ax) * t;
    const cy = g.ay + (g.by - g.ay) * t;
    const dxRoad = g.bx - g.ax;
    const dyRoad = g.by - g.ay;
    const rlen = Math.hypot(dxRoad, dyRoad) || 1;
    // perpendicular unit vector
    const nx = -dyRoad / rlen;
    const ny = dxRoad / rlen;
    const ax = Math.round(cx - nx * (lenU / 2));
    const ay = Math.round(cy - ny * (lenU / 2));
    const bx = Math.round(cx + nx * (lenU / 2));
    const by = Math.round(cy + ny * (lenU / 2));
    return { name: name.trim() || "New road", widthFt, ax, ay, bx, by };
  }

  function submit() {
    const spec = compute();
    if (!spec) return;
    onConfirm(spec);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-background/85 backdrop-blur" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Add a road"
        className="mx-4 w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Add a road</p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
              How does this road connect?
            </h2>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Pick a shape below — we'll place the road for you. You can nudge it later.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <ModeCard
            active={mode === "extend"}
            onClick={() => setMode("extend")}
            disabled={!hasExisting}
            title="Extend an existing road"
            help="Continue from the end of a road you've already placed."
          />
          <ModeCard
            active={mode === "cross"}
            onClick={() => setMode("cross")}
            disabled={!hasExisting}
            title="Cross another road"
            help="Place a new road perpendicular to one you have."
          />
          <ModeCard
            active={mode === "standalone"}
            onClick={() => setMode("standalone")}
            title="Standalone road"
            help="A new road not touching the others (yet)."
          />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Road name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="Side Road" />
          </label>
          <label className="block">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Length (feet)</Label>
            <Input
              type="number"
              min={50}
              max={5000}
              step={20}
              value={lengthFt}
              onChange={(e) => setLengthFt(Math.max(50, Number(e.target.value) || 0))}
              className="mt-1"
            />
          </label>
          <label className="block">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Width</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={String(widthFt)}
              onChange={(e) => setWidthFt(Number(e.target.value))}
            >
              <option value="12">1 lane · 12 ft</option>
              <option value="16">Narrow · 16 ft</option>
              <option value="20">2 lane · 20 ft</option>
              <option value="24">Wide · 24 ft</option>
              <option value="30">Extra wide · 30 ft</option>
            </select>
          </label>

          {mode !== "standalone" && (
            <label className="block">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {mode === "extend" ? "Extend from" : "Cross this road"}
              </Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={attachTo}
                onChange={(e) => setAttachTo(e.target.value)}
              >
                {segments
                  .filter((s) => s.geometry)
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
            </label>
          )}

          {mode === "extend" && (
            <>
              <label className="block">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attach at</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={attachEnd}
                  onChange={(e) => setAttachEnd(e.target.value as "a" | "b")}
                >
                  <option value="a">Start of that road</option>
                  <option value="b">End of that road</option>
                </select>
              </label>
              <label className="block">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Direction</Label>
                <div className="mt-1 grid grid-cols-4 gap-1">
                  {(["left", "right", "up", "down"] as Dir[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDir(d)}
                      className={cn(
                        "h-10 rounded-md border text-xs font-semibold capitalize",
                        dir === d ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent",
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </label>
            </>
          )}

          {mode === "cross" && (
            <label className="block sm:col-span-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cross at</Label>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {(["start", "middle", "end"] as CrossAt[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCrossAt(c)}
                    className={cn(
                      "h-10 rounded-md border text-xs font-semibold capitalize",
                      crossAt === c ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent",
                    )}
                  >
                    Near {c}
                  </button>
                ))}
              </div>
            </label>
          )}

          {mode === "standalone" && (
            <label className="block">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Direction</Label>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {(["left", "right", "up", "down"] as Dir[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDir(d)}
                    className={cn(
                      "h-10 rounded-md border text-xs font-semibold capitalize",
                      dir === d ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </label>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={!canGo}>
            <RouteIcon className="mr-1 h-4 w-4" /> Add this road <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  disabled,
  title,
  help,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  help: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-start rounded-2xl border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span className="text-sm font-semibold">{title}</span>
      <span className="mt-0.5 text-xs text-muted-foreground">{help}</span>
    </button>
  );
}