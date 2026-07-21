import { useMemo, useState } from "react";

import {
  isGeoJSONLineString,
  isGeoJSONPolygon,
  parcelToFeature,
  segmentToFeature,
  type Parcel,
  type RoadSegment,
} from "@/lib/community/api";
import { cn } from "@/lib/utils";

/**
 * PlatCanvas — SVG plat renderer for a community.
 *
 * Same visual language as the Cedar Hollow demo (asphalt roads, dashed
 * centerlines, rounded parcel tiles, hover tooltip, entrance pins). If parcels
 * have real polygon geometry it projects them; otherwise it lays them out
 * along a synthetic road so the picture always reads as a neighborhood.
 */

const VIEW_W = 900;
const VIEW_H = 520;
const PADDING = 42;

type ProjectedPolygon = {
  id: string;
  label: string;
  address?: string | null;
  points: string;
  cx: number;
  cy: number;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  synthetic?: boolean;
};

type ProjectedRoad = {
  id: string;
  name: string;
  d: string;
  synthetic?: boolean;
};

type Props = {
  parcels: Parcel[];
  segments: RoadSegment[];
  selectedIds?: string[];
  youId?: string | null;
  onSelectParcel?: (id: string) => void;
  onAddRoad?: () => void;
  className?: string;
  title?: string;
};

export function PlatCanvas({
  parcels,
  segments,
  selectedIds,
  youId,
  onSelectParcel,
  onAddRoad,
  className,
  title,
}: Props) {
  const { polys, roads, empty, syntheticRoad } = useMemo(
    () => layout(parcels, segments),
    [parcels, segments],
  );

  const selectedSet = new Set(selectedIds ?? []);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hovered = hoverId ? polys.find((p) => p.id === hoverId) ?? null : null;

  if (empty) {
    return (
      <div
        className={cn(
          "relative flex h-full min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center",
          className,
        )}
      >
        <p className="font-display text-base font-semibold">Nothing on the map yet</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Add homes to see your community laid out here.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card/80 px-4 py-2.5 backdrop-blur">
        <span className="font-display text-sm font-semibold tracking-tight">
          {title ?? "Your road"}
        </span>
        <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-gold" /> You
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ background: "var(--color-selected, hsl(200 80% 55%))" }}
            />{" "}
            Picked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-border bg-card" /> Home
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block w-full select-none"
        role="img"
        aria-label="Community plat map"
      >
        <defs>
          <linearGradient id="pc-land" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-map-land-top, hsl(140 30% 96%))" />
            <stop offset="100%" stopColor="var(--color-map-land-bottom, hsl(140 25% 92%))" />
          </linearGradient>
          <pattern id="pc-grid" width="36" height="36" patternUnits="userSpaceOnUse">
            <path
              d="M 36 0 L 0 0 0 36"
              fill="none"
              stroke="var(--color-map-ink, hsl(220 20% 40%))"
              strokeWidth="0.5"
              opacity="0.08"
            />
          </pattern>
          <filter id="pc-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodOpacity="0.14" />
          </filter>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill="url(#pc-land)" />
        <rect width={VIEW_W} height={VIEW_H} fill="url(#pc-grid)" />

        {/* Roads (asphalt casing + fill + optional lane dashes) */}
        {roads.map((r) => (
          <g key={`road-${r.id}`}>
            <path
              d={r.d}
              fill="none"
              stroke={
                r.synthetic
                  ? "hsl(220 15% 55%)"
                  : "var(--color-map-asphalt-edge, hsl(220 15% 30%))"
              }
              strokeWidth={22}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={r.synthetic ? 0.55 : 1}
              strokeDasharray={r.synthetic ? "10 8" : undefined}
            />
            <path
              d={r.d}
              fill="none"
              stroke={
                r.synthetic
                  ? "hsl(220 12% 78%)"
                  : "var(--color-map-asphalt, hsl(220 10% 45%))"
              }
              strokeWidth={17}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={r.synthetic ? 0.75 : 1}
            />
            {!r.synthetic && (
              <path
                d={r.d}
                fill="none"
                stroke="var(--color-map-lane, hsl(48 90% 78%))"
                strokeWidth={1.6}
                strokeDasharray="9 8"
                strokeLinecap="round"
                opacity={0.75}
                style={{ animation: "rs-dash 1.4s linear infinite" }}
              />
            )}
          </g>
        ))}

        {/* Parcels */}
        {polys.map((p) => {
          const isSel = selectedSet.has(p.id);
          const isYou = youId === p.id;
          const isHover = hoverId === p.id;
          const clickable = !!onSelectParcel;
          let fill = "hsl(210 40% 96%)";
          let stroke = "hsl(220 15% 65%)";
          let sw = 1;
          if (isSel) {
            fill =
              "color-mix(in oklch, var(--color-selected, hsl(200 80% 55%)) 22%, hsl(210 40% 96%))";
            stroke = "var(--color-selected, hsl(200 80% 55%))";
            sw = 1.75;
          }
          if (isYou) {
            fill =
              "color-mix(in oklch, var(--color-gold, hsl(42 90% 60%)) 34%, hsl(210 40% 96%))";
            stroke = "var(--color-gold, hsl(42 90% 60%))";
            sw = 2;
          }
          return (
            <g
              key={p.id}
              className={clickable ? "cursor-pointer" : "cursor-default"}
              onClick={clickable ? () => onSelectParcel!(p.id) : undefined}
              onMouseEnter={() => setHoverId(p.id)}
              onMouseLeave={() =>
                setHoverId((cur) => (cur === p.id ? null : cur))
              }
            >
              {p.synthetic ? (
                <rect
                  x={p.x}
                  y={p.y}
                  width={p.w}
                  height={p.h}
                  rx={Math.min(6, p.size * 0.18)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isHover ? sw + 1 : sw}
                  filter="url(#pc-shadow)"
                />
              ) : (
                <polygon
                  points={p.points}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isHover ? sw + 1 : sw}
                  filter="url(#pc-shadow)"
                />
              )}
              {p.size >= 22 && (
                <text
                  x={p.cx}
                  y={p.cy}
                  fill="hsl(220 25% 25%)"
                  fontSize={Math.min(10, Math.max(6, p.size * 0.32))}
                  fontWeight={isSel || isYou ? 700 : 500}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                >
                  {shortLabel(p.label)}
                </text>
              )}
              {(isYou || isSel) && p.size < 22 && (
                <circle
                  cx={p.cx}
                  cy={p.cy}
                  r={2.5}
                  fill={
                    isYou
                      ? "var(--color-gold, hsl(42 90% 60%))"
                      : "var(--color-selected, hsl(200 80% 55%))"
                  }
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}

        {/* Hover tooltip */}
        {hovered && (
          <g pointerEvents="none">
            <rect
              x={clamp(hovered.cx - 90, 4, VIEW_W - 184)}
              y={Math.max(hovered.y - 26, 4)}
              width={180}
              height={20}
              rx={5}
              fill="var(--primary, hsl(220 60% 40%))"
            />
            <text
              x={clamp(hovered.cx, 94, VIEW_W - 94)}
              y={Math.max(hovered.y - 12, 18)}
              fill="var(--primary-foreground, hsl(0 0% 100%))"
              fontSize={10}
              fontWeight={600}
              textAnchor="middle"
            >
              {(hovered.address ?? hovered.label ?? "Home").slice(0, 42)}
            </text>
          </g>
        )}

        {/* Placeholder-road CTA */}
        {syntheticRoad && onAddRoad && (
          <g
            className="cursor-pointer"
            onClick={onAddRoad}
            transform={`translate(${VIEW_W / 2}, ${VIEW_H / 2})`}
          >
            <rect
              x={-96}
              y={-16}
              width={192}
              height={32}
              rx={16}
              fill="var(--primary, hsl(220 60% 40%))"
              opacity={0.95}
            />
            <text
              x={0}
              y={5}
              fill="var(--primary-foreground, hsl(0 0% 100%))"
              fontSize={12}
              fontWeight={700}
              textAnchor="middle"
            >
              + Add your road
            </text>
          </g>
        )}

        {/* North arrow */}
        <g transform={`translate(${VIEW_W - 42}, ${VIEW_H - 50})`}>
          <circle r={16} fill="hsl(0 0% 100%)" stroke="hsl(220 15% 80%)" strokeWidth={1} opacity={0.92} />
          <path d="M 0 -10 L 4.5 7 L 0 3 L -4.5 7 Z" fill="var(--primary, hsl(200 80% 55%))" />
          <text x={0} y={-11} fill="hsl(220 25% 25%)" fontSize={8} fontWeight={700} textAnchor="middle">
            N
          </text>
        </g>
      </svg>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function shortLabel(s: string | undefined): string {
  const t = (s ?? "").trim();
  if (t.length <= 10) return t;
  const num = t.match(/^\d+/);
  if (num) return num[0];
  return t.slice(0, 10);
}

// ---------------- layout ----------------

function layout(
  parcels: Parcel[],
  segments: RoadSegment[],
): {
  polys: ProjectedPolygon[];
  roads: ProjectedRoad[];
  empty: boolean;
  syntheticRoad?: boolean;
} {
  const parcelFeatures = parcels
    .map((p) => ({ p, f: parcelToFeature(p) }))
    .filter(
      (x): x is { p: Parcel; f: NonNullable<ReturnType<typeof parcelToFeature>> } => !!x.f,
    );

  const roadFeatures = segments
    .map((s) => ({ s, f: segmentToFeature(s) }))
    .filter(
      (x): x is { s: RoadSegment; f: NonNullable<ReturnType<typeof segmentToFeature>> } => !!x.f,
    );

  const coords: [number, number][] = [];
  for (const { f } of parcelFeatures) {
    if (isGeoJSONPolygon(f.geometry)) {
      for (const ring of f.geometry.coordinates) {
        for (const c of ring) coords.push([Number(c[0]), Number(c[1])]);
      }
    }
  }
  for (const { f } of roadFeatures) {
    if (isGeoJSONLineString(f.geometry)) {
      for (const c of f.geometry.coordinates) coords.push([Number(c[0]), Number(c[1])]);
    }
  }

  let orphans = parcels.filter(
    (p) => !parcelFeatures.some((pf) => pf.p.id === p.id),
  );

  let degenerate = false;
  if (coords.length > 0) {
    let a = coords[0][0],
      b = coords[0][0],
      c = coords[0][1],
      d = coords[0][1];
    for (const [lng, lat] of coords) {
      if (lng < a) a = lng;
      if (lng > b) b = lng;
      if (lat < c) c = lat;
      if (lat > d) d = lat;
    }
    // Overall coord span too tiny to be a real neighborhood
    // (~1e-3 deg ≈ 100 m). Also fire when unique parcel centers collapse,
    // e.g. every parcel defaulting to the same legacy (pos_x, pos_y).
    const spanDegenerate = b - a < 1e-3 && d - c < 1e-3;
    const centers = new Set<string>();
    for (const { f } of parcelFeatures) {
      if (isGeoJSONPolygon(f.geometry)) {
        const ring = f.geometry.coordinates[0] ?? [];
        let sx = 0,
          sy = 0;
        for (const c of ring) {
          sx += Number(c[0]);
          sy += Number(c[1]);
        }
        const n = Math.max(1, ring.length);
        centers.add(`${(sx / n).toFixed(5)},${(sy / n).toFixed(5)}`);
      }
    }
    const centersDegenerate =
      parcelFeatures.length >= 2 && centers.size <= Math.max(1, parcelFeatures.length / 4);
    degenerate = spanDegenerate || centersDegenerate;
  }
  if (degenerate) {
    orphans = [...parcels];
    parcelFeatures.length = 0;
    roadFeatures.length = 0;
    coords.length = 0;
  }

  if (coords.length === 0 && orphans.length === 0) {
    return { polys: [], roads: [], empty: true };
  }

  let minLng: number;
  let maxLng: number;
  let minLat: number;
  let maxLat: number;
  if (coords.length > 0) {
    minLng = coords[0][0];
    maxLng = coords[0][0];
    minLat = coords[0][1];
    maxLat = coords[0][1];
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  } else {
    minLng = 0;
    maxLng = 1;
    minLat = 0;
    maxLat = 1;
  }
  const dLng = Math.max(maxLng - minLng, 1e-6);
  const dLat = Math.max(maxLat - minLat, 1e-6);
  minLng -= dLng * 0.06;
  maxLng += dLng * 0.06;
  minLat -= dLat * 0.06;
  maxLat += dLat * 0.06;

  const innerW = VIEW_W - PADDING * 2;
  const innerH = VIEW_H - PADDING * 2;
  const spanLng = maxLng - minLng;
  const spanLat = maxLat - minLat;
  const scale = Math.min(innerW / spanLng, innerH / spanLat);
  const offsetX = (innerW - spanLng * scale) / 2 + PADDING;
  const offsetY = (innerH - spanLat * scale) / 2 + PADDING;

  function project(lng: number, lat: number): [number, number] {
    const x = offsetX + (lng - minLng) * scale;
    const y = offsetY + (maxLat - lat) * scale;
    return [x, y];
  }

  const roads: ProjectedRoad[] = roadFeatures.map(({ s, f }) => {
    const pts = f.geometry.coordinates.map(([lng, lat]) =>
      project(Number(lng), Number(lat)),
    );
    const d = pts
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`)
      .join(" ");
    return { id: s.id, name: s.name ?? "Road", d };
  });

  const polys: ProjectedPolygon[] = parcelFeatures.map(({ p, f }) => {
    const ring = f.geometry.coordinates[0] ?? [];
    const pts = ring.map((c) => project(Number(c[0]), Number(c[1])));
    let sumX = 0;
    let sumY = 0;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [x, y] of pts) {
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const cx = pts.length ? sumX / pts.length : 0;
    const cy = pts.length ? sumY / pts.length : 0;
    const points = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const size = pts.length ? Math.min(maxX - minX, maxY - minY) : 0;
    return {
      id: p.id,
      label: p.label ?? "Home",
      address: p.address ?? null,
      points,
      cx,
      cy,
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      size,
    };
  });

  // Orphan parcels — lay out along a synthetic horizontal road so the
  // picture reads like a Cedar Hollow-style neighborhood, not abstract dots.
  let syntheticRoad = false;
  if (orphans.length > 0) {
    const areaW = VIEW_W - PADDING * 2;
    const areaH = VIEW_H - PADDING * 2;
    const half = Math.ceil(orphans.length / 2);
    const northCount = half;
    const southCount = orphans.length - northCount;

    const targetTileW = 62;
    const maxCols = Math.max(1, Math.floor(areaW / 44));
    const northCols = Math.min(
      maxCols,
      Math.max(1, Math.min(northCount, Math.round(areaW / targetTileW))),
    );
    const southCols = Math.min(
      maxCols,
      Math.max(1, Math.min(Math.max(1, southCount), Math.round(areaW / targetTileW))),
    );
    const northRows = Math.max(1, Math.ceil(northCount / northCols));
    const southRows = Math.max(1, Math.ceil(Math.max(1, southCount) / southCols));

    const roadY = PADDING + areaH * 0.5;
    const sideH = areaH * 0.44;
    const gap = 4;

    const northTileW = (areaW - gap * (northCols + 1)) / northCols;
    const northTileH = Math.min(58, (sideH - gap * (northRows + 1)) / northRows);
    const southTileW = (areaW - gap * (southCols + 1)) / southCols;
    const southTileH = Math.min(58, (sideH - gap * (southRows + 1)) / southRows);

    const roadHalf = 14;

    function placeNorth(idx: number) {
      const col = idx % northCols;
      const row = Math.floor(idx / northCols);
      const x = PADDING + gap + col * (northTileW + gap);
      // Nearest row sits just above the road; further rows stack upward.
      const y = roadY - roadHalf - (row + 1) * northTileH - row * gap;
      return { x, y, w: northTileW, h: northTileH };
    }

    function placeSouth(idx: number) {
      const col = idx % southCols;
      const row = Math.floor(idx / southCols);
      const x = PADDING + gap + col * (southTileW + gap);
      const y = roadY + roadHalf + row * (southTileH + gap) + gap;
      return { x, y, w: southTileW, h: southTileH };
    }

    orphans.forEach((p, i) => {
      const isNorth = i < northCount;
      const localIdx = isNorth ? i : i - northCount;
      const { x, y, w, h } = isNorth ? placeNorth(localIdx) : placeSouth(localIdx);
      const points = `${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`;
      polys.push({
        id: p.id,
        label: p.label ?? "Home",
        address: p.address ?? null,
        points,
        cx: x + w / 2,
        cy: y + h / 2,
        x,
        y,
        w,
        h,
        size: Math.min(w, h),
        synthetic: true,
      });
    });

    if (roads.length === 0) {
      syntheticRoad = true;
      roads.push({
        id: "synthetic-road",
        name: "Your road",
        d: `M ${PADDING} ${roadY} L ${VIEW_W - PADDING} ${roadY}`,
        synthetic: true,
      });
    }
  }

  return {
    polys,
    roads,
    empty: polys.length === 0 && roads.length === 0,
    syntheticRoad,
  };
}
