import { useEffect, useRef, useState } from "react";
import { Pencil, MousePointer2, Trash2, Undo2, Check, X, Plus, HelpCircle, Move, PencilRuler } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { pathLengthFt, toPoints, type Parcel, type Point, type RoadSegment } from "@/lib/community/api";

type Mode = "select" | "draw";

const ONBOARD_KEY = "roadshare.gis.onboarded";

const RESP_COLOR: Record<string, string> = {
  shared: "var(--color-primary)",
  private: "var(--color-gold)",
  public: "var(--color-map-road)",
};

export function GisEditor({
  parcels,
  segments,
  selectedId,
  onSelect,
  onCreate,
  onUpdateGeometry,
  onDelete,
  onMoveParcel,
}: {
  parcels: Parcel[];
  segments: RoadSegment[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (geometry: Point[]) => void;
  onUpdateGeometry: (id: string, geometry: Point[]) => void;
  onDelete: (segment: RoadSegment) => void;
  onMoveParcel: (id: string, pos: Point) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mode, setMode] = useState<Mode>("select");
  const [draft, setDraft] = useState<Point[]>([]);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(ONBOARD_KEY)) setShowGuide(true);
  }, []);

  function closeGuide() {
    setShowGuide(false);
    try { window.localStorage.setItem(ONBOARD_KEY, "1"); } catch { /* ignore */ }
  }

  const [drag, setDrag] = useState<
    | { kind: "vertex"; segId: string; index: number; pts: Point[] }
    | { kind: "parcel"; id: string; pos: Point }
    | null
  >(null);

  function toLocal(e: { clientX: number; clientY: number }): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, +x.toFixed(2))), y: Math.max(0, Math.min(100, +y.toFixed(2))) };
  }

  function handleCanvasClick(e: React.MouseEvent) {
    if (mode !== "draw") return;
    setDraft((d) => [...d, toLocal(e)]);
  }

  function finishDraft() {
    if (draft.length >= 2) onCreate(draft);
    setDraft([]);
    setMode("select");
  }

  const selected = segments.find((s) => s.id === selectedId) ?? null;

  function onVertexDown(seg: RoadSegment, index: number) {
    if (mode !== "select") return;
    setDrag({ kind: "vertex", segId: seg.id, index, pts: toPoints(seg.geometry) });
  }
  function onParcelDown(p: Parcel) {
    if (mode !== "select") return;
    onSelect(null);
    setDrag({ kind: "parcel", id: p.id, pos: { x: p.pos_x, y: p.pos_y } });
  }

  function onMove(e: React.MouseEvent) {
    if (!drag) return;
    const pt = toLocal(e);
    if (drag.kind === "vertex") {
      const pts = drag.pts.map((p, i) => (i === drag.index ? pt : p));
      setDrag({ ...drag, pts });
    } else {
      setDrag({ ...drag, pos: pt });
    }
  }
  function onUp() {
    if (!drag) return;
    if (drag.kind === "vertex") onUpdateGeometry(drag.segId, drag.pts);
    else onMoveParcel(drag.id, drag.pos);
    setDrag(null);
  }

  function deleteLastVertex() {
    if (!selected) return;
    const pts = toPoints(selected.geometry);
    if (pts.length <= 2) return;
    onUpdateGeometry(selected.id, pts.slice(0, -1));
  }

  const liveVertexPts = drag?.kind === "vertex" ? drag.pts : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          <button
            onClick={() => { setMode("select"); setDraft([]); }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              mode === "select" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MousePointer2 className="h-4 w-4" /> Select & move
          </button>
          <button
            onClick={() => { setMode("draw"); onSelect(null); }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              mode === "draw" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Pencil className="h-4 w-4" /> Draw road
          </button>
        </div>

        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setShowGuide(true)}>
          <HelpCircle className="h-4 w-4" /> How it works
        </Button>

        {mode === "draw" && (
          <>
            <span className="text-sm text-muted-foreground">
              Click the map to drop points ({draft.length}).
            </span>
            <Button size="sm" onClick={finishDraft} disabled={draft.length < 2}>
              <Check className="h-4 w-4" /> Finish road
            </Button>
            {draft.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setDraft((d) => d.slice(0, -1))}>
                <Undo2 className="h-4 w-4" /> Undo point
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => { setDraft([]); setMode("select"); }}>
              <X className="h-4 w-4" /> Cancel
            </Button>
          </>
        )}

        {mode === "select" && selected && (
          <>
            <span className="text-sm font-medium">{selected.name}</span>
            <Button size="sm" variant="outline" onClick={deleteLastVertex} disabled={toPoints(selected.geometry).length <= 2}>
              <Undo2 className="h-4 w-4" /> Remove last point
            </Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDelete(selected)}>
              <Trash2 className="h-4 w-4" /> Delete segment
            </Button>
          </>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className={cn("h-[420px] w-full touch-none select-none", mode === "draw" ? "cursor-crosshair" : "cursor-default")}
          onClick={handleCanvasClick}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
        >
          <defs>
            <pattern id="gis-dots" width="4" height="4" patternUnits="userSpaceOnUse">
              <circle cx="0.5" cy="0.5" r="0.35" fill="var(--color-foreground)" opacity="0.12" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="100" height="100" fill="url(#gis-dots)" />

          {/* Segments */}
          {segments.map((seg) => {
            const pts = liveVertexPts && drag?.kind === "vertex" && drag.segId === seg.id ? liveVertexPts : toPoints(seg.geometry);
            if (pts.length < 2) return null;
            const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
            const active = seg.id === selectedId;
            return (
              <g key={seg.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={RESP_COLOR[seg.responsibility] ?? "var(--color-map-road)"}
                  strokeWidth={active ? 2.4 : 1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={active ? 1 : 0.8}
                  className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); if (mode === "select") onSelect(seg.id); }}
                  vectorEffect="non-scaling-stroke"
                  style={{ strokeWidth: active ? 5 : 3.5 }}
                />
                {active && mode === "select" &&
                  pts.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={1.4}
                      fill="var(--color-background)"
                      stroke="var(--color-primary)"
                      strokeWidth={0.6}
                      className="cursor-grab"
                      onMouseDown={(e) => { e.stopPropagation(); onVertexDown(seg, i); }}
                    />
                  ))}
              </g>
            );
          })}

          {/* Draft */}
          {draft.length > 0 && (
            <g>
              <path
                d={draft.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ")}
                fill="none"
                stroke="var(--color-primary)"
                strokeDasharray="2 2"
                style={{ strokeWidth: 3.5 }}
                strokeLinecap="round"
              />
              {draft.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={1.3} fill="var(--color-primary)" />
              ))}
            </g>
          )}

          {/* Parcels */}
          {parcels.map((p) => {
            const pos = drag?.kind === "parcel" && drag.id === p.id ? drag.pos : { x: p.pos_x, y: p.pos_y };
            return (
              <g
                key={p.id}
                onMouseDown={(e) => { e.stopPropagation(); onParcelDown(p); }}
                className={mode === "select" ? "cursor-grab" : "cursor-default"}
              >
                <rect
                  x={pos.x - 4}
                  y={pos.y - 3}
                  width={8}
                  height={6}
                  rx={1.2}
                  fill="var(--color-map-parcel)"
                  stroke="var(--color-map-parcel-edge)"
                  strokeWidth={0.3}
                />
                <text x={pos.x} y={pos.y + 1} textAnchor="middle" fontSize={2.6} fontWeight={700} fill="var(--color-map-ink)">
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>

        {parcels.length === 0 && segments.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-full bg-background/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
              Empty canvas — switch to <span className="font-semibold">Draw road</span> to start.
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <Legend color="var(--color-primary)" label="Shared responsibility" />
        <Legend color="var(--color-gold)" label="Private" />
        <Legend color="var(--color-map-road)" label="Public" />
        {selected && (
          <span className="ml-auto inline-flex items-center gap-1.5 font-medium text-foreground">
            <Plus className="h-3.5 w-3.5" /> {pathLengthFt(toPoints(selected.geometry))} ft
          </span>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-4 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}