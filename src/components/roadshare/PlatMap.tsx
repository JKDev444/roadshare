import { useEffect, useRef, useState } from "react";

import type { Layout } from "@/lib/roadshare/layout";
import { nearestPointOnSegments, snapHomeTileToRoad } from "@/lib/roadshare/layout";

interface PlatMapProps {
  layout: Layout;
  selected: string[];
  you: string | null;
  entrances: string[];
  hovered: string | null;
  activeStep?: "home" | "road" | "neighbors" | "entrances" | "review";
  title?: string;
  rotation?: 0 | 90 | 180 | 270;
  onToggleParcel: (id: string) => void;
  onHoverParcel: (id: string | null) => void;
  onToggleEntrance: (id: string) => void;
  onRenameParcel?: (id: string) => void;
  onDeleteParcel?: (id: string) => void;
  /** Called when a home is dragged to a new SVG position (top-left of bbox). */
  onMoveHome?: (id: string, x: number, y: number) => void;
  /** Called when a home should be re-assigned to a different road segment. */
  onAssignHomeSegment?: (homeId: string, segmentId: string) => void;
  /** Called when the user double-clicks a home to edit its details. */
  onEditHome?: (id: string) => void;
  /** Called when a tray card is dropped onto the map. Snaps to nearest segment. */
  onDropHomeAt?: (homeId: string, x: number, y: number, segmentId: string) => void;
  /** Called when a whole road segment is translated. */
  onMoveSegment?: (id: string, ax: number, ay: number, bx: number, by: number) => void;
  /** Called when a single endpoint of a road is moved. */
  onMoveSegmentEndpoint?: (id: string, endpoint: "a" | "b", x: number, y: number) => void;
  /** Called when the user clicks the midpoint "+ corner" handle to add a bend. */
  onSplitSegment?: (id: string, x: number, y: number) => void;
  /** When set, the map is in tap-to-place mode for this tray home id. */
  pendingTrayHomeId?: string | null;
  onCancelPendingHome?: () => void;
  /** When set, the map is in place-a-road mode for this segment id. */
  placingRoadId?: string | null;
  onPlaceRoad?: (segmentId: string, ax: number, ay: number, bx: number, by: number) => void;
  onCancelPlaceRoad?: () => void;
}

// Axis-aligned bounding box for a rectangular parcel polygon.
function bbox(poly: [number, number][]) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

const DRAG_THRESHOLD = 4;

type DragState =
  | { kind: "home"; id: string; startX: number; startY: number; dx: number; dy: number; moved: boolean }
  | { kind: "segMove"; id: string; startX: number; startY: number; dx: number; dy: number; moved: boolean }
  | { kind: "segEndpoint"; id: string; endpoint: "a" | "b"; startX: number; startY: number; dx: number; dy: number; moved: boolean };

export function PlatMap({
  layout,
  selected,
  you,
  entrances,
  hovered,
  activeStep = "home",
  title,
  rotation = 0,
  onToggleParcel,
  onHoverParcel,
  onToggleEntrance,
  onRenameParcel,
  onDeleteParcel,
  onMoveHome,
  onAssignHomeSegment,
  onEditHome,
  onDropHomeAt,
  onMoveSegment,
  onMoveSegmentEndpoint,
  onSplitSegment,
  pendingTrayHomeId = null,
  onCancelPendingHome,
  placingRoadId = null,
  onPlaceRoad,
  onCancelPlaceRoad,
}: PlatMapProps) {
  const { view: VIEW, nodes: NODES, edges: EDGES, entrances: ENTRANCES, parcels: PARCELS } = layout;
  const node = (id: string) => NODES[id];
  const hoveredParcel = PARCELS.find((p) => p.id === hovered);
  // For labels: only draw named-road text overlays for the Cedar Hollow sample.
  const isCedar = ENTRANCES.some((e) => e.id === "north");

  const gRef = useRef<SVGGElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [placeFirst, setPlaceFirst] = useState<{ x: number; y: number } | null>(null);
  const [placeHover, setPlaceHover] = useState<{ x: number; y: number } | null>(null);
  const placing = !!placingRoadId;
  const pendingPlacement = !!pendingTrayHomeId;

  function toSvg(clientX: number, clientY: number): { x: number; y: number } | null {
    const g = gRef.current;
    if (!g) return null;
    const svg = g.ownerSVGElement;
    if (!svg) return null;
    const ctm = g.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function startDrag(kind: DragState["kind"], id: string, endpoint: "a" | "b" | undefined, e: React.PointerEvent) {
    if (placing) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const pt = toSvg(e.clientX, e.clientY);
    if (!pt) return;
    if (kind === "segEndpoint") {
      setDrag({ kind, id, endpoint: endpoint!, startX: pt.x, startY: pt.y, dx: 0, dy: 0, moved: false });
    } else {
      setDrag({ kind: kind as "home" | "segMove", id, startX: pt.x, startY: pt.y, dx: 0, dy: 0, moved: false });
    }
  }

  function handleMove(e: React.PointerEvent) {
    const pt = toSvg(e.clientX, e.clientY);
    if (!pt) return;
    if (placing) {
      setPlaceHover(pt);
      return;
    }
    if (!drag) return;
    const dx = pt.x - drag.startX;
    const dy = pt.y - drag.startY;
    const moved = drag.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD;
    setDrag({ ...drag, dx, dy, moved });
  }

  function handleUp(e: React.PointerEvent) {
    if (placing) {
      const pt = toSvg(e.clientX, e.clientY);
      if (!pt) return;
      if (!placeFirst) {
        setPlaceFirst(pt);
        setPlaceHover(pt);
      } else {
        if (placingRoadId && onPlaceRoad) {
          onPlaceRoad(placingRoadId, placeFirst.x, placeFirst.y, pt.x, pt.y);
        }
        setPlaceFirst(null);
        setPlaceHover(null);
      }
      return;
    }
    if (!drag) return;
    if (drag.moved) {
      if (drag.kind === "home" && onMoveHome) {
        const parcel = PARCELS.find((p) => p.id === drag.id);
        if (parcel) {
          const { x, y } = bbox(parcel.poly);
          // Snap the tile so it stays attached to the nearest road segment.
          const cx = x + drag.dx + bbox(parcel.poly).w / 2;
          const cy = y + drag.dy + bbox(parcel.poly).h / 2;
          const segs = EDGES.map((edge) => {
            const na = NODES[edge.a];
            const nb = NODES[edge.b];
            return { id: edge.id, ax: na.x, ay: na.y, bx: nb.x, by: nb.y };
          });
          const snap = nearestPointOnSegments(cx, cy, segs);
          if (snap) {
            const seg = segs.find((s) => s.id === snap.segmentId)!;
            const pos = snapHomeTileToRoad(seg.ax, seg.ay, seg.bx, seg.by, snap.x, snap.y, snap.side);
            onMoveHome(drag.id, pos.x, pos.y);
            if (onAssignHomeSegment) onAssignHomeSegment(drag.id, snap.segmentId);
          } else {
            onMoveHome(drag.id, x + drag.dx, y + drag.dy);
          }
        }
      } else if (drag.kind === "segMove" && onMoveSegment) {
        const a = NODES[`${drag.id}_W`];
        const b = NODES[`${drag.id}_E`];
        if (a && b) onMoveSegment(drag.id, a.x + drag.dx, a.y + drag.dy, b.x + drag.dx, b.y + drag.dy);
      } else if (drag.kind === "segEndpoint" && onMoveSegment) {
        const a = NODES[`${drag.id}_W`];
        const b = NODES[`${drag.id}_E`];
        if (a && b) {
          const ax = drag.endpoint === "a" ? a.x + drag.dx : a.x;
          const ay = drag.endpoint === "a" ? a.y + drag.dy : a.y;
          const bx = drag.endpoint === "b" ? b.x + drag.dx : b.x;
          const by = drag.endpoint === "b" ? b.y + drag.dy : b.y;
          onMoveSegment(drag.id, ax, ay, bx, by);
        }
      }
    }
    setDrag(null);
  }

  // Escape or right-click cancels placement.
  useEffect(() => {
    if (!placing && !pendingPlacement) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPlaceFirst(null);
        setPlaceHover(null);
        onCancelPlaceRoad?.();
        onCancelPendingHome?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placing, pendingPlacement, onCancelPlaceRoad, onCancelPendingHome]);

  function segDelta(id: string): { dax: number; day: number; dbx: number; dby: number } {
    if (!drag) return { dax: 0, day: 0, dbx: 0, dby: 0 };
    if (drag.kind === "segMove" && drag.id === id) return { dax: drag.dx, day: drag.dy, dbx: drag.dx, dby: drag.dy };
    if (drag.kind === "segEndpoint" && drag.id === id) {
      return drag.endpoint === "a"
        ? { dax: drag.dx, day: drag.dy, dbx: 0, dby: 0 }
        : { dax: 0, day: 0, dbx: drag.dx, dby: drag.dy };
    }
    return { dax: 0, day: 0, dbx: 0, dby: 0 };
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      {/* Map title bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/70 bg-card/80 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold tracking-tight">
            {title ?? layout.roadName}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {placing
              ? placeFirst
                ? "Click to place the far end · Esc to cancel"
                : "Click to place the road start · Esc to cancel"
              : activeStep === "home"
              ? "Tap a home to start"
              : activeStep === "neighbors"
                ? "Tap homes to add or remove"
                : activeStep === "entrances"
                  ? "Tap entrance pins"
                  : "Review the selected group"}
          </span>
        </div>
        <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-gold" /> You
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-selected" /> Sharing the road
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-border bg-card" />
            Available
          </span>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
      {/* Friendly topo-paper backdrop (matches the homepage hero demo). */}
      <div className="topo-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        preserveAspectRatio="xMidYMid meet"
        className={"relative block h-full max-h-full w-full select-none " + (placing || pendingPlacement ? "cursor-crosshair" : "")}
        role="img"
        aria-label={`${title ?? layout.roadName} plat map`}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onClickCapture={(e) => {
          if (!pendingPlacement || !onDropHomeAt || !pendingTrayHomeId) return;
          const pt = toSvg(e.clientX, e.clientY);
          if (!pt) return;
          const segs = EDGES.map((edge) => {
            const na = NODES[edge.a];
            const nb = NODES[edge.b];
            return { id: edge.id, ax: na.x, ay: na.y, bx: nb.x, by: nb.y };
          });
          const snap = nearestPointOnSegments(pt.x, pt.y, segs);
          if (!snap) return;
          const seg = segs.find((s) => s.id === snap.segmentId)!;
          const pos = snapHomeTileToRoad(seg.ax, seg.ay, seg.bx, seg.by, snap.x, snap.y, snap.side);
          onDropHomeAt(pendingTrayHomeId, pos.x, pos.y, snap.segmentId);
          e.stopPropagation();
          e.preventDefault();
        }}
        onDragOver={(e) => {
          if (!onDropHomeAt) return;
          if (Array.from(e.dataTransfer.types).includes("application/x-roadshare-home")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(e) => {
          if (!onDropHomeAt) return;
          const id = e.dataTransfer.getData("application/x-roadshare-home") || e.dataTransfer.getData("text/plain");
          if (!id) return;
          e.preventDefault();
          const pt = toSvg(e.clientX, e.clientY);
          if (!pt) return;
          const segs = EDGES.map((edge) => {
            const na = NODES[edge.a];
            const nb = NODES[edge.b];
            return { id: edge.id, ax: na.x, ay: na.y, bx: nb.x, by: nb.y };
          });
          const snap = nearestPointOnSegments(pt.x, pt.y, segs);
          if (!snap) return;
          const seg = segs.find((s) => s.id === snap.segmentId)!;
          const pos = snapHomeTileToRoad(seg.ax, seg.ay, seg.bx, seg.by, snap.x, snap.y, snap.side);
          onDropHomeAt(id, pos.x, pos.y, snap.segmentId);
        }}
        onContextMenu={(e) => {
          if (placing) {
            e.preventDefault();
            setPlaceFirst(null);
            setPlaceHover(null);
            onCancelPlaceRoad?.();
          }
        }}
      >
        <g
          ref={gRef}
          transform={
            rotation
              ? `rotate(${rotation} ${VIEW.w / 2} ${VIEW.h / 2})`
              : undefined
          }
          style={{ transition: "transform 300ms ease" }}
        >
        <defs>
          <filter id="parcelShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* Public road stubs at each entrance */}
        {ENTRANCES.map((e) => (
          <PublicRoad
            key={`pub-${e.id}`}
            d={
              e.y < 100
                ? `M ${e.x} 8 L ${e.x} ${e.y}`
                : e.y > VIEW.h - 100
                  ? `M ${e.x} ${e.y} L ${e.x} ${VIEW.h - 8}`
                  : e.x < 100
                    ? `M 8 ${e.y} L ${e.x} ${e.y}`
                    : `M ${e.x} ${e.y} L ${VIEW.w - 8} ${e.y}`
            }
            width={16}
          />
        ))}

        {/* Private road casing + asphalt */}
        {EDGES.map((e) => {
          const a = node(e.a);
          const b = node(e.b);
          const d = segDelta(e.id);
          return (
            <line key={`c-${e.id}`} x1={a.x + d.dax} y1={a.y + d.day} x2={b.x + d.dbx} y2={b.y + d.dby} stroke="var(--color-map-asphalt-edge)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
          );
        })}
        {isCedar && NODES.E && (
          <>
            <circle cx={NODES.E.x} cy={NODES.E.y} r="26" fill="var(--color-map-asphalt-edge)" />
            <circle cx={NODES.E.x} cy={NODES.E.y} r="21" fill="var(--color-map-asphalt)" />
          </>
        )}
        {EDGES.map((e) => {
          const a = node(e.a);
          const b = node(e.b);
          const d = segDelta(e.id);
          return (
            <line
              key={`a-${e.id}`}
              x1={a.x + d.dax}
              y1={a.y + d.day}
              x2={b.x + d.dbx}
              y2={b.y + d.dby}
              stroke="var(--color-map-asphalt)"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ cursor: onMoveSegment ? "grab" : "pointer" }}
              onPointerDown={(ev) => {
                if (onMoveSegment) {
                  ev.stopPropagation();
                  startDrag("segMove", e.id, undefined, ev);
                }
              }}
            />
          );
        })}
        {/* Dashed lane centerlines */}
        {EDGES.map((e) => {
          const a = node(e.a);
          const b = node(e.b);
          const d = segDelta(e.id);
          return (
            <line
              key={`l-${e.id}`}
              x1={a.x + d.dax}
              y1={a.y + d.day}
              x2={b.x + d.dbx}
              y2={b.y + d.dby}
              stroke="var(--color-map-lane)"
              strokeWidth="2"
              strokeDasharray="10 10"
              strokeLinecap="round"
              opacity="0.85"
              style={{ animation: "rs-dash 2s linear infinite", pointerEvents: "none" }}
            />
          );
        })}

        {/* Midpoint "+ corner" handle — click to add a bend / split the segment */}
        {onSplitSegment && !placing && !pendingPlacement && !drag && EDGES.map((e) => {
          const a = node(e.a);
          const b = node(e.b);
          const d = segDelta(e.id);
          const mx = (a.x + d.dax + b.x + d.dbx) / 2;
          const my = (a.y + d.day + b.y + d.dby) / 2;
          return (
            <g
              key={`split-${e.id}`}
              style={{ cursor: "pointer" }}
              onPointerDown={(ev) => ev.stopPropagation()}
              onClick={(ev) => {
                ev.stopPropagation();
                onSplitSegment(e.id, mx, my);
              }}
            >
              <title>Add a corner here</title>
              <circle cx={mx} cy={my} r="9" fill="var(--color-card)" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.95" />
              <path d={`M ${mx - 4} ${my} L ${mx + 4} ${my} M ${mx} ${my - 4} L ${mx} ${my + 4}`} stroke="var(--color-primary)" strokeWidth="1.75" strokeLinecap="round" />
            </g>
          );
        })}

        {/* Road name label per edge */}
        {!isCedar && EDGES.map((e) => {
          const a = node(e.a);
          const b = node(e.b);
          const d = segDelta(e.id);
          const midX = (a.x + d.dax + b.x + d.dbx) / 2;
          const midY = (a.y + d.day + b.y + d.dby) / 2 - 6;
          return (
            <text key={`rl-${e.id}`} x={midX} y={midY} fill="var(--color-map-lane)" fontSize="10" fontWeight="600" fontFamily="var(--font-mono)" textAnchor="middle" letterSpacing="1.5" opacity="0.95" pointerEvents="none">
              {(e.road || layout.roadName).toUpperCase()}
            </text>
          );
        })}

        {/* Parcels */}
        {PARCELS.map((p, idx) => {
          const isSel = selected.includes(p.id);
          const isYou = you === p.id;
          const isHover = hovered === p.id;
          const bb = bbox(p.poly);
          const hd = drag && drag.kind === "home" && drag.id === p.id ? { dx: drag.dx, dy: drag.dy } : { dx: 0, dy: 0 };
          const x = bb.x + hd.dx;
          const y = bb.y + hd.dy;
          const w = bb.w;
          const h = bb.h;
          // Homepage-hero pill styling: solid fills, no visible border.
          let fill = "color-mix(in oklab, var(--color-selected) 30%, transparent)";
          let labelFill = "var(--color-muted-foreground)";
          let fillOpacity = 0.9;
          if (isSel) {
            fill = "var(--color-selected)";
            labelFill = "var(--color-selected-foreground)";
            fillOpacity = 0.85;
          }
          if (isYou) {
            fill = "var(--color-gold)";
            labelFill = "var(--color-gold-foreground)";
            fillOpacity = 0.95;
          }
          return (
            <g
              key={p.id}
              style={{
                cursor: onMoveHome ? "grab" : "pointer",
                transformOrigin: `${x + w / 2}px ${y + h / 2}px`,
                animation: `rs-parcel-in 380ms ease-out both`,
                animationDelay: `${Math.min(idx * 40, 800)}ms`,
              }}
              onPointerDown={(e) => {
                if (placing) return;
                if (onMoveHome) startDrag("home", p.id, undefined, e);
              }}
              onClick={(e) => {
                if (placing) return;
                if (drag && drag.kind === "home" && drag.id === p.id && drag.moved) return;
                if (e.shiftKey && onDeleteParcel) {
                  onDeleteParcel(p.id);
                  return;
                }
                onToggleParcel(p.id);
              }}
              onDoubleClick={() => (onEditHome ?? onRenameParcel)?.(p.id)}
              onMouseEnter={() => onHoverParcel(p.id)}
              onMouseLeave={() => onHoverParcel(null)}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx="6"
                fill={fill}
                fillOpacity={fillOpacity}
                stroke={isHover ? "var(--color-foreground)" : "none"}
                strokeOpacity={isHover ? 0.25 : 0}
                strokeWidth={isHover ? 1 : 0}
                filter="url(#parcelShadow)"
              />
              {isSel && (
                <line
                  x1={p.frontageLine[0][0] + hd.dx}
                  y1={p.frontageLine[0][1] + hd.dy}
                  x2={p.frontageLine[1][0] + hd.dx}
                  y2={p.frontageLine[1][1] + hd.dy}
                  stroke={isYou ? "var(--color-gold-foreground)" : "var(--color-selected-foreground)"}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  opacity="0.9"
                />
              )}
              <text
                x={p.label[0] + hd.dx}
                y={p.label[1] + hd.dy}
                fill={labelFill}
                fontSize="10"
                fontWeight={isYou || isSel ? 700 : 600}
                fontFamily="var(--font-mono)"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                {(p.address.match(/\d+/)?.[0]) ?? String(idx + 1)}
              </text>
            </g>
          );
        })}

        {/* Entrances */}
        {ENTRANCES.map((e) => {
          const pinned = entrances.includes(e.id);
          // Find owning segment + endpoint so drag reshapes the road.
          const segId = e.node.replace(/_(W|E)$/, "");
          const endpoint: "a" | "b" = e.node.endsWith("_W") ? "a" : "b";
          const d = segDelta(segId);
          const ex = e.x + (endpoint === "a" ? d.dax : d.dbx);
          const ey = e.y + (endpoint === "a" ? d.day : d.dby);
          return (
            <g
              key={e.id}
              style={{ cursor: onMoveSegmentEndpoint ? "grab" : "pointer" }}
              onPointerDown={(ev) => {
                if (placing) return;
                if (onMoveSegmentEndpoint) {
                  ev.stopPropagation();
                  startDrag("segEndpoint", segId, endpoint, ev);
                }
              }}
              onClick={(ev) => {
                if (placing) return;
                if (drag && drag.kind === "segEndpoint" && drag.id === segId && drag.moved) return;
                ev.stopPropagation();
                onToggleEntrance(e.id);
              }}
            >
              {!pinned && (
                <circle
                  cx={ex}
                  cy={ey}
                  r="13"
                  fill="none"
                  stroke="var(--color-gold)"
                  strokeWidth="2"
                  style={{ transformOrigin: `${ex}px ${ey}px`, animation: "rs-pulse 2s ease-out infinite" }}
                />
              )}
              {pinned ? (
                <g style={{ transformOrigin: `${ex}px ${ey}px` }} className="animate-scale-in">
                  <path
                    d={`M ${ex} ${ey} C ${ex - 11} ${ey - 14}, ${ex - 9} ${ey - 30}, ${ex} ${ey - 30} C ${ex + 9} ${ey - 30}, ${ex + 11} ${ey - 14}, ${ex} ${ey} Z`}
                    fill="var(--color-primary)"
                    stroke="var(--color-card)"
                    strokeWidth="1.5"
                  />
                  <circle cx={ex} cy={ey - 21} r="4.5" fill="var(--color-card)" />
                </g>
              ) : (
                <circle cx={ex} cy={ey} r="7.5" fill="var(--color-card)" stroke="var(--color-primary)" strokeWidth="2" />
              )}
            </g>
          );
        })}

        {/* Placing-a-road preview */}
        {placing && placeFirst && placeHover && (
          <g pointerEvents="none">
            <line
              x1={placeFirst.x}
              y1={placeFirst.y}
              x2={placeHover.x}
              y2={placeHover.y}
              stroke="var(--color-primary)"
              strokeWidth="18"
              strokeOpacity="0.4"
              strokeLinecap="round"
            />
            <line
              x1={placeFirst.x}
              y1={placeFirst.y}
              x2={placeHover.x}
              y2={placeHover.y}
              stroke="var(--color-primary)"
              strokeWidth="2"
              strokeDasharray="6 6"
            />
            <circle cx={placeFirst.x} cy={placeFirst.y} r="6" fill="var(--color-primary)" />
          </g>
        )}

        {/* Hover tooltip */}
        {hoveredParcel && (
          <g pointerEvents="none">
            <rect
              x={hoveredParcel.label[0] - 62}
              y={bbox(hoveredParcel.poly).y - 26}
              width="124"
              height="19"
              rx="5"
              fill="var(--color-primary)"
            />
            <text
              x={hoveredParcel.label[0]}
              y={bbox(hoveredParcel.poly).y - 13}
              fill="var(--color-primary-foreground)"
              fontSize="9.5"
              fontFamily="var(--font-sans)"
              fontWeight="600"
              textAnchor="middle"
            >
              {hoveredParcel.address}
            </text>
          </g>
        )}

        {/* North arrow */}
        <g transform={`translate(${VIEW.w - 44}, ${VIEW.h - 56})`}>
          <circle r="17" fill="var(--color-card)" stroke="var(--color-border)" strokeWidth="1" opacity="0.9" />
          <path d="M 0 -11 L 5 8 L 0 3 L -5 8 Z" fill="var(--color-primary)" />
          <text x="0" y="-13" fill="var(--color-map-ink)" fontSize="8.5" fontWeight="700" fontFamily="var(--font-mono)" textAnchor="middle">
            N
          </text>
        </g>

        {/* Scale bar */}
        <g transform={`translate(56, ${VIEW.h - 22})`}>
          <rect x="-6" y="-13" width="104" height="22" rx="5" fill="var(--color-card)" opacity="0.85" />
          <line x1="0" y1="0" x2="80" y2="0" stroke="var(--color-map-ink)" strokeWidth="2" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--color-map-ink)" strokeWidth="2" />
          <line x1="80" y1="-4" x2="80" y2="4" stroke="var(--color-map-ink)" strokeWidth="2" />
          <text x="40" y="-5" fill="var(--color-map-ink)" fontSize="8.5" fontFamily="var(--font-mono)" textAnchor="middle">
            100 ft
          </text>
        </g>
        </g>
      </svg>
      </div>
    </div>
  );
}

function PublicRoad({ d, width }: { d: string; width: number }) {
  return (
    <>
      <path d={d} stroke="var(--color-map-asphalt-edge)" strokeWidth={width + 3} fill="none" strokeLinecap="round" />
      <path d={d} stroke="var(--color-map-asphalt)" strokeWidth={width} fill="none" strokeLinecap="round" />
      <path d={d} stroke="var(--color-map-lane)" strokeWidth="1.4" strokeDasharray="8 8" fill="none" opacity="0.55" />
    </>
  );
}