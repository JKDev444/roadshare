import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Home as HomeIcon, MousePointerClick, RouteIcon, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Parcel, RoadSegment, Point } from "@/lib/community/api";
import { toPoints } from "@/lib/community/api";

/**
 * PlatEditor — an interactive plat canvas in local 0..100 units.
 *
 * Draggable home tiles, editable road polyline (drag vertices, double-click
 * to add a bend), plus an "Add home" button. Persistence is delegated: the
 * parent implements the callbacks and re-fetches parcels/segments.
 */

const VIEW = 100;

type Props = {
  parcels: Parcel[];
  segments: RoadSegment[];
  selectedIds?: string[];
  youId?: string | null;
  onSelectParcel?: (id: string) => void;

  onMoveParcel: (id: string, pos: { pos_x: number; pos_y: number }) => Promise<void> | void;
  onRenameParcel: (id: string, label: string) => Promise<void> | void;
  onDeleteParcel: (id: string) => Promise<void> | void;
  onCreateParcel: (label: string, pos: { pos_x: number; pos_y: number }) => Promise<void> | void;

  onUpdateRoad: (segmentId: string | null, geometry: Point[]) => Promise<void> | void;

  title?: string;
  className?: string;
};

type TilePos = { id: string; label: string; address: string | null; x: number; y: number };

export function PlatEditor(props: Props) {
  const {
    parcels,
    segments,
    selectedIds,
    youId,
    onSelectParcel,
    onMoveParcel,
    onRenameParcel,
    onDeleteParcel,
    onCreateParcel,
    onUpdateRoad,
    title,
    className,
  } = props;

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Auto-lay tiles that don't have pos_x/pos_y yet along the road.
  const initialTiles = useMemo(() => layoutTiles(parcels), [parcels]);
  const [tiles, setTiles] = useState<TilePos[]>(initialTiles);
  useEffect(() => setTiles(initialTiles), [initialTiles]);

  // Road polyline (in 0..100 space). If the first segment has legacy plat
  // geometry (points {x,y} in 0..100), use it. Otherwise a straight midline.
  const initialRoad = useMemo(() => extractRoadPoints(segments), [segments]);
  const [road, setRoad] = useState<Point[]>(initialRoad);
  useEffect(() => setRoad(initialRoad), [initialRoad]);
  const roadSegmentId = segments[0]?.id ?? null;

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragVertex, setDragVertex] = useState<number | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const selected = new Set(selectedIds ?? []);

  function svgPoint(evt: React.PointerEvent | PointerEvent): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * VIEW;
    const y = ((evt.clientY - rect.top) / rect.height) * VIEW;
    return { x: clamp(x, 2, VIEW - 2), y: clamp(y, 2, VIEW - 2) };
  }

  // ---- Tile drag ----
  function onTilePointerDown(evt: React.PointerEvent, id: string) {
    if (adding) return;
    (evt.target as Element).setPointerCapture?.(evt.pointerId);
    setDragId(id);
  }
  function onTilePointerMove(evt: React.PointerEvent) {
    if (!dragId) return;
    const { x, y } = svgPoint(evt);
    setTiles((prev) => prev.map((t) => (t.id === dragId ? { ...t, x, y } : t)));
  }
  async function onTilePointerUp(evt: React.PointerEvent) {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    (evt.target as Element).releasePointerCapture?.(evt.pointerId);
    const t = tiles.find((x) => x.id === id);
    if (!t) return;
    await onMoveParcel(id, { pos_x: round(t.x), pos_y: round(t.y) });
  }

  // ---- Road vertex drag ----
  function onVertexPointerDown(evt: React.PointerEvent, i: number) {
    (evt.target as Element).setPointerCapture?.(evt.pointerId);
    setDragVertex(i);
  }
  function onVertexPointerMove(evt: React.PointerEvent) {
    if (dragVertex == null) return;
    const p = svgPoint(evt);
    setRoad((prev) => prev.map((v, i) => (i === dragVertex ? p : v)));
  }
  async function onVertexPointerUp(evt: React.PointerEvent) {
    if (dragVertex == null) return;
    setDragVertex(null);
    (evt.target as Element).releasePointerCapture?.(evt.pointerId);
    await onUpdateRoad(roadSegmentId, road.map((p) => ({ x: round(p.x), y: round(p.y) })));
  }

  // Double-click on the road adds a bend at that spot.
  async function onRoadDoubleClick(evt: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * VIEW;
    const y = ((evt.clientY - rect.top) / rect.height) * VIEW;
    const { insertAt } = nearestSegment(road, { x, y });
    const next = [...road.slice(0, insertAt), { x: round(x), y: round(y) }, ...road.slice(insertAt)];
    setRoad(next);
    await onUpdateRoad(roadSegmentId, next);
  }

  // ---- Add home ----
  async function submitAdd() {
    const label = newLabel.trim() || `Home ${parcels.length + 1}`;
    // Place near the road midpoint, alternating above/below by count parity.
    const mid = road[Math.floor(road.length / 2)] ?? { x: 50, y: 50 };
    const dx = (parcels.length % 2 === 0 ? -1 : 1) * 6;
    const dy = (parcels.length % 4 < 2 ? -1 : 1) * 10;
    await onCreateParcel(label, {
      pos_x: round(clamp(mid.x + dx, 6, VIEW - 6)),
      pos_y: round(clamp(mid.y + dy, 6, VIEW - 6)),
    });
    setAdding(false);
    setNewLabel("");
  }

  const roadD = road.length >= 2
    ? road.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
    : "";

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card/80 px-4 py-2.5">
        <span className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight">
          <RouteIcon className="h-4 w-4 text-primary" />
          {title ?? "Your road"}
        </span>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="hidden items-center gap-1 sm:inline-flex">
            <MousePointerClick className="h-3 w-3" /> Drag tiles or road
          </span>
          {!adding ? (
            <Button size="sm" variant="outline" className="h-7" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" /> Add home
            </Button>
          ) : (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                void submitAdd();
              }}
            >
              <Input
                autoFocus
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={`Home ${parcels.length + 1}`}
                className="h-7 w-32 text-xs"
              />
              <Button size="sm" className="h-7" type="submit">
                Add
              </Button>
              <Button size="sm" variant="ghost" className="h-7" type="button" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </form>
          )}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="block w-full select-none"
        style={{ aspectRatio: "16 / 9", touchAction: "none" }}
        onPointerMove={(e) => {
          onTilePointerMove(e);
          onVertexPointerMove(e);
        }}
        onPointerUp={(e) => {
          void onTilePointerUp(e);
          void onVertexPointerUp(e);
        }}
      >
        <defs>
          <linearGradient id="pe-land" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(140 30% 96%)" />
            <stop offset="100%" stopColor="hsl(140 25% 92%)" />
          </linearGradient>
          <pattern id="pe-grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="hsl(220 20% 40%)" strokeWidth="0.15" opacity="0.15" />
          </pattern>
          <filter id="pe-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0.25" stdDeviation="0.35" floodOpacity="0.18" />
          </filter>
        </defs>

        <rect width={VIEW} height={VIEW} fill="url(#pe-land)" />
        <rect width={VIEW} height={VIEW} fill="url(#pe-grid)" />

        {/* Road */}
        {roadD && (
          <g onDoubleClick={onRoadDoubleClick} className="cursor-pointer">
            <path
              d={roadD}
              fill="none"
              stroke="hsl(220 15% 30%)"
              strokeWidth={4.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={roadD}
              fill="none"
              stroke="hsl(220 10% 45%)"
              strokeWidth={3.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={roadD}
              fill="none"
              stroke="hsl(48 90% 78%)"
              strokeWidth={0.32}
              strokeDasharray="1.8 1.6"
              strokeLinecap="round"
              opacity={0.9}
            />
          </g>
        )}

        {/* Road vertex handles */}
        {road.map((v, i) => (
          <circle
            key={`v-${i}`}
            cx={v.x}
            cy={v.y}
            r={1.6}
            fill="hsl(0 0% 100%)"
            stroke="var(--primary, hsl(220 60% 40%))"
            strokeWidth={0.6}
            className="cursor-grab"
            onPointerDown={(e) => onVertexPointerDown(e, i)}
          >
            <title>Drag to reshape road · double-click road to add a bend</title>
          </circle>
        ))}

        {/* Home tiles */}
        {tiles.map((t) => {
          const isSel = selected.has(t.id);
          const isYou = youId === t.id;
          const size = 6.5;
          let fill = "hsl(210 40% 96%)";
          let stroke = "hsl(220 15% 65%)";
          let sw = 0.25;
          if (isSel) {
            fill = "color-mix(in oklch, var(--color-selected, hsl(200 80% 55%)) 22%, hsl(210 40% 96%))";
            stroke = "var(--color-selected, hsl(200 80% 55%))";
            sw = 0.4;
          }
          if (isYou) {
            fill = "color-mix(in oklch, var(--color-gold, hsl(42 90% 60%)) 34%, hsl(210 40% 96%))";
            stroke = "var(--color-gold, hsl(42 90% 60%))";
            sw = 0.5;
          }
          return (
            <g
              key={t.id}
              className={dragId === t.id ? "cursor-grabbing" : "cursor-grab"}
              onPointerDown={(e) => onTilePointerDown(e, t.id)}
              onClick={(e) => {
                if (dragId) return;
                e.stopPropagation();
                setOpenId(t.id);
                onSelectParcel?.(t.id);
              }}
            >
              <rect
                x={t.x - size / 2}
                y={t.y - size / 2}
                width={size}
                height={size}
                rx={1.1}
                fill={fill}
                stroke={stroke}
                strokeWidth={sw}
                filter="url(#pe-shadow)"
              />
              <text
                x={t.x}
                y={t.y + 0.2}
                fill="hsl(220 25% 25%)"
                fontSize={1.9}
                fontWeight={isSel || isYou ? 700 : 500}
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                {shortLabel(t.label)}
              </text>
            </g>
          );
        })}

        {/* North arrow */}
        <g transform={`translate(${VIEW - 6}, ${VIEW - 8})`} pointerEvents="none">
          <circle r={3} fill="hsl(0 0% 100%)" stroke="hsl(220 15% 80%)" strokeWidth={0.2} opacity={0.92} />
          <path d="M 0 -2 L 0.9 1.4 L 0 0.6 L -0.9 1.4 Z" fill="var(--primary, hsl(200 80% 55%))" />
          <text x={0} y={-2.3} fill="hsl(220 25% 25%)" fontSize={1.5} fontWeight={700} textAnchor="middle">
            N
          </text>
        </g>
      </svg>

      {/* Tile action popover (rendered outside the SVG so shadcn Popover behaves) */}
      {openId && (
        <TileActions
          key={openId}
          tile={tiles.find((t) => t.id === openId) ?? null}
          onClose={() => setOpenId(null)}
          onRename={async (label) => {
            await onRenameParcel(openId, label);
            setOpenId(null);
          }}
          onDelete={async () => {
            await onDeleteParcel(openId);
            setOpenId(null);
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border/70 bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <HomeIcon className="h-3 w-3" /> {parcels.length} {parcels.length === 1 ? "home" : "homes"}
        </span>
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-primary" /> Drag to move. Double-click the road to add a bend.
        </span>
      </div>
    </div>
  );
}

function TileActions({
  tile,
  onClose,
  onRename,
  onDelete,
}: {
  tile: TilePos | null;
  onClose: () => void;
  onRename: (label: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [label, setLabel] = useState(tile?.label ?? "");
  useEffect(() => setLabel(tile?.label ?? ""), [tile?.id]);
  if (!tile) return null;
  return (
    <Popover open onOpenChange={(v) => !v && onClose()}>
      <PopoverTrigger asChild>
        <span
          className="pointer-events-none absolute"
          style={{
            left: `${(tile.x / VIEW) * 100}%`,
            top: `${(tile.y / VIEW) * 100}%`,
          }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-64" align="center">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Home
            </p>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="destructive" onClick={() => void onDelete()}>
              Remove
            </Button>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void onRename(label.trim() || tile.label)}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------- helpers ----------------

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function round(v: number) {
  return Math.round(v * 10) / 10;
}
function shortLabel(s: string): string {
  const t = (s ?? "").trim();
  if (t.length <= 6) return t;
  const num = t.match(/^(?:Lot|Home|House)?\s*(\d+)/i);
  if (num) return num[1];
  return t.slice(0, 6);
}

function extractRoadPoints(segments: RoadSegment[]): Point[] {
  const first = segments[0];
  if (first) {
    const pts = toPoints(first.geometry);
    if (pts.length >= 2) return pts;
    // LineString with plat-space coords
    const g = first.geometry as { type?: string; coordinates?: unknown };
    if (g && g.type === "LineString" && Array.isArray(g.coordinates)) {
      const coords = g.coordinates as [number, number][];
      // If coords look like plat units (0..100), use directly.
      if (coords.every(([x, y]) => x >= 0 && x <= 100 && y >= 0 && y <= 100)) {
        return coords.map(([x, y]) => ({ x: Number(x), y: Number(y) }));
      }
    }
  }
  return [
    { x: 10, y: 50 },
    { x: 90, y: 50 },
  ];
}

function layoutTiles(parcels: Parcel[]): TilePos[] {
  const out: TilePos[] = [];
  const needsLayout: Parcel[] = [];
  for (const p of parcels) {
    if (typeof p.pos_x === "number" && typeof p.pos_y === "number" && p.pos_x !== 0) {
      out.push({
        id: p.id,
        label: p.label ?? "Home",
        address: p.address ?? null,
        x: clamp(Number(p.pos_x), 2, VIEW - 2),
        y: clamp(Number(p.pos_y), 2, VIEW - 2),
      });
    } else {
      needsLayout.push(p);
    }
  }
  const half = Math.ceil(needsLayout.length / 2);
  const cols = Math.max(1, half);
  const marginX = 8;
  const stepX = (VIEW - marginX * 2) / Math.max(1, cols);
  const yTop = 38;
  const yBot = 62;
  needsLayout.forEach((p, i) => {
    const north = i < half;
    const idx = north ? i : i - half;
    const x = marginX + stepX * idx + stepX / 2;
    const y = north ? yTop : yBot;
    out.push({
      id: p.id,
      label: p.label ?? "Home",
      address: p.address ?? null,
      x,
      y,
    });
  });
  return out;
}

function nearestSegment(road: Point[], p: { x: number; y: number }): { insertAt: number } {
  let bestI = 1;
  let bestD = Infinity;
  for (let i = 1; i < road.length; i++) {
    const a = road[i - 1];
    const b = road[i];
    const d = pointToSegmentDist(p, a, b);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return { insertAt: bestI };
}

function pointToSegmentDist(p: { x: number; y: number }, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(p.x - px, p.y - py);
}