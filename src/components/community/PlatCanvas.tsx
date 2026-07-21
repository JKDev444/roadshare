import { useMemo } from "react";

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
 * Renders parcels and road segments in the same visual language as the
 * Cedar Hollow demo (asphalt roads, rounded parcel tiles, faint grid).
 * Automatically projects lat/lng into an SVG viewBox with padding.
 *
 * Read-only by default. Pass `onSelectParcel` to make parcels clickable.
 */

const VIEW_W = 800;
const VIEW_H = 520;
const PADDING = 40;

type ProjectedPolygon = { id: string; label: string; points: string; cx: number; cy: number; size: number };
type ProjectedRoad = { id: string; name: string; d: string };

type Props = {
  parcels: Parcel[];
  segments: RoadSegment[];
  selectedIds?: string[];
  youId?: string | null;
  onSelectParcel?: (id: string) => void;
  className?: string;
  title?: string;
};

export function PlatCanvas({
  parcels,
  segments,
  selectedIds,
  youId,
  onSelectParcel,
  className,
  title,
}: Props) {
  const { polys, roads, empty, tooManyOrphans } = useMemo(
    () => layout(parcels, segments),
    [parcels, segments],
  );

  const selectedSet = new Set(selectedIds ?? []);

  if (empty) {
    return (
      <div className={cn("relative flex h-full min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center", className)}>
        <p className="font-display text-base font-semibold">Nothing on the map yet</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Add homes to see your community laid out here.
        </p>
      </div>
    );
  }

  if (tooManyOrphans) {
    return (
      <div
        className={cn(
          "relative flex h-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-gradient-to-br from-primary/5 via-fun-2/5 to-fun-3/5 p-6 text-center",
          className,
        )}
      >
        <p className="font-display text-lg font-bold tracking-tight">
          {parcels.length.toLocaleString()} homes on this road
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          The road picture appears once your homes have locations. In the meantime, use the search
          below to jump to yours.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-border/70 bg-card/80 px-4 py-2.5 backdrop-blur">
          <span className="font-display text-sm font-semibold tracking-tight">{title}</span>
          <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
            {youId && (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-gold" /> You
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-primary/60" /> Home
            </span>
          </div>
        </div>
      )}

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

        {/* Road casings + asphalt */}
        {roads.map((r) => (
          <g key={`road-${r.id}`}>
            <path
              d={r.d}
              fill="none"
              stroke="var(--color-map-asphalt-edge, hsl(220 15% 30%))"
              strokeWidth={22}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={r.d}
              fill="none"
              stroke="var(--color-map-asphalt, hsl(220 10% 45%))"
              strokeWidth={17}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={r.d}
              fill="none"
              stroke="var(--color-map-lane, hsl(48 90% 78%))"
              strokeWidth={1.6}
              strokeDasharray="9 8"
              strokeLinecap="round"
              opacity={0.75}
            />
          </g>
        ))}

        {/* Parcels */}
        {polys.map((p) => {
          const isSel = selectedSet.has(p.id);
          const isYou = youId === p.id;
          const clickable = !!onSelectParcel;
          let fill = "hsl(210 40% 96%)";
          let stroke = "hsl(220 15% 65%)";
          let sw = 1;
          if (isSel) {
            fill = "color-mix(in oklch, var(--primary, hsl(200 80% 55%)) 22%, hsl(210 40% 96%))";
            stroke = "var(--primary, hsl(200 80% 55%))";
            sw = 1.75;
          }
          if (isYou) {
            fill = "color-mix(in oklch, var(--color-gold, hsl(42 90% 60%)) 34%, hsl(210 40% 96%))";
            stroke = "var(--color-gold, hsl(42 90% 60%))";
            sw = 2;
          }
          return (
            <g
              key={p.id}
              className={clickable ? "cursor-pointer" : undefined}
              onClick={clickable ? () => onSelectParcel!(p.id) : undefined}
            >
              <polygon
                points={p.points}
                fill={fill}
                stroke={stroke}
                strokeWidth={sw}
                filter="url(#pc-shadow)"
              />
              <text
                x={p.cx}
                y={p.cy}
                fill="hsl(220 25% 25%)"
                fontSize={p.label.length > 8 ? 8.5 : 9.5}
                fontWeight={isSel || isYou ? 700 : 500}
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                {p.label}
              </text>
            </g>
          );
        })}

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

// ---------------- layout ----------------

function layout(parcels: Parcel[], segments: RoadSegment[]): {
  polys: ProjectedPolygon[];
  roads: ProjectedRoad[];
  empty: boolean;
  tooManyOrphans?: boolean;
} {
  // Collect (lng, lat) points from features
  const parcelFeatures = parcels
    .map((p) => ({ p, f: parcelToFeature(p) }))
    .filter((x): x is { p: Parcel; f: NonNullable<ReturnType<typeof parcelToFeature>> } => !!x.f);

  const roadFeatures = segments
    .map((s) => ({ s, f: segmentToFeature(s) }))
    .filter((x): x is { s: RoadSegment; f: NonNullable<ReturnType<typeof segmentToFeature>> } => !!x.f);

  // Collect all coords for bounds
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

  // Parcels without any geometry — arrange them in a grid at the bottom later.
  const orphans = parcels.filter(
    (p) => !parcelFeatures.some((pf) => pf.p.id === p.id),
  );

  if (coords.length === 0 && orphans.length === 0) {
    return { polys: [], roads: [], empty: true };
  }

  // For very large communities without geometry, fall through to the orphan
  // grid below. We render homes as small dots so hundreds still fit clearly.

  // Compute bounds; if no geometry, invent a synthetic box for the orphans grid.
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
  // Guard degenerate bounds (single point).
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
  // Preserve aspect ratio by using the smaller scale.
  const scale = Math.min(innerW / spanLng, innerH / spanLat);
  const offsetX = (innerW - spanLng * scale) / 2 + PADDING;
  const offsetY = (innerH - spanLat * scale) / 2 + PADDING;

  function project(lng: number, lat: number): [number, number] {
    const x = offsetX + (lng - minLng) * scale;
    // Flip Y so north is up.
    const y = offsetY + (maxLat - lat) * scale;
    return [x, y];
  }

  const roads: ProjectedRoad[] = roadFeatures.map(({ s, f }) => {
    const pts = f.geometry.coordinates.map(([lng, lat]) => project(Number(lng), Number(lat)));
    const d = pts
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`)
      .join(" ");
    return { id: s.id, name: s.name ?? "Road", d };
  });

  const polys: ProjectedPolygon[] = parcelFeatures.map(({ p, f }) => {
    const ring = f.geometry.coordinates[0] ?? [];
    const pts = ring.map((c) => project(Number(c[0]), Number(c[1])));
    // Skip degenerate ring
    let sumX = 0;
    let sumY = 0;
    for (const [x, y] of pts) {
      sumX += x;
      sumY += y;
    }
    const cx = pts.length ? sumX / pts.length : 0;
    const cy = pts.length ? sumY / pts.length : 0;
    const points = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    return { id: p.id, label: p.label ?? "Home", points, cx, cy };
  });

  // Lay out orphan parcels in a grid across the bottom of the canvas.
  if (orphans.length > 0) {
    // Fit an aspect-aware grid inside the available canvas so hundreds of
    // homes stay legible (as small tiles) rather than getting hidden.
    const areaW = VIEW_W - PADDING * 2;
    const areaH = VIEW_H - PADDING * 2;
    const cols = Math.max(
      1,
      Math.min(orphans.length, Math.round(Math.sqrt((orphans.length * areaW) / areaH))),
    );
    const rows = Math.ceil(orphans.length / cols);
    const cellW = areaW / cols;
    const cellH = Math.min(46, areaH / rows);
    const gap = Math.min(8, Math.max(2, cellH * 0.15));
    const gridTop = PADDING + (areaH - rows * cellH) / 2;
    orphans.forEach((p, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = PADDING + col * cellW + gap / 2;
      const y = gridTop + row * cellH + gap / 2;
      const w = cellW - gap;
      const h = cellH - gap;
      const points = `${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`;
      polys.push({ id: p.id, label: p.label ?? "Home", points, cx: x + w / 2, cy: y + h / 2 });
    });
  }

  return { polys, roads, empty: polys.length === 0 && roads.length === 0 };
}