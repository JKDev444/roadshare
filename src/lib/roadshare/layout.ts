// Build a road layout from a list of homes. Used by /my-road so the planner
// renders each user's own homes instead of the hard-coded Cedar Hollow sample.

import type { RoadPos, SurfaceType } from "./data";
import * as cedar from "./data";

export interface LayoutEdge {
  id: string;
  a: string;
  b: string;
  length: number;
  widthFt: number;
  road: string;
}

export interface LayoutEntrance {
  id: string;
  node: string;
  label: string;
  meets: string;
  x: number;
  y: number;
}

export interface LayoutParcel {
  id: string;
  address: string;
  /** User-facing name (owner label, custom name, or address fallback). */
  name?: string;
  poly: [number, number][];
  label: [number, number];
  frontage: [RoadPos, RoadPos];
  frontageLine: [[number, number], [number, number]];
  note?: string;
}

export type { SurfaceType };

export type Home = {
  id: string;
  label: string;
  address?: string | null;
  /** Optional owner / family label ("The Johnsons"). */
  ownerLabel?: string | null;
  /** Overrides the auto-computed frontage in feet when set. */
  frontageFtOverride?: number | null;
  /** True when this parcel should not be included in the cost math. */
  skipFromMath?: boolean;
  segmentId?: string;
  /** Optional pixel position (top-left of bbox) inside the plat SVG. When
   * set, this parcel is drawn at this position instead of the auto row. */
  position?: { x: number; y: number } | null;
};

export type Segment = {
  id: string;
  name: string;
  lengthFt?: number; // overrides geometric length in cost math
  widthFt: number;
  /** Optional custom road geometry (endpoints in SVG units). When set, the
   * segment is drawn as this line instead of the auto west→east row. */
  geometry?: { ax: number; ay: number; bx: number; by: number } | null;
};

export type NodeMap = Record<string, { id: string; x: number; y: number }>;

export interface Layout {
  view: { w: number; h: number };
  ftPerUnit: number;
  nodes: NodeMap;
  edges: LayoutEdge[];
  entrances: LayoutEntrance[];
  parcels: LayoutParcel[];
  totalRoadFt: number;
  roadName: string;
  entryDirs: string[]; // ordered entrance ids that flank the road
}

const FT_PER_UNIT = 1.25;
const BASE_VIEW_W = 900;
const BASE_VIEW_H = 620;
const ROAD_MARGIN = 70; // horizontal margin from edge of viewport to first lot
const LOT_W = 130;
const LOT_H = 82;

function projectOntoSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const L2 = dx * dx + dy * dy;
  if (L2 === 0) return { t: 0, cx: ax, cy: ay, len: 0 };
  let t = ((px - ax) * dx + (py - ay) * dy) / L2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return { t, cx: ax + t * dx, cy: ay + t * dy, len: Math.sqrt(L2) };
}

function slug(id: string) {
  return id.replace(/[^a-z0-9_-]/gi, "");
}

export function makeSegmentId() {
  return `seg_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Evenly distribute every placed home across its assigned segment. Homes in
 * the tray (`position === null`) are left in the tray. Alternates north/south
 * of the segment so both sides fill up.
 */
export function autoArrangeHomes(homes: Home[], segments: Segment[]): Home[] {
  if (segments.length === 0) return homes;
  const bySeg = new Map<string, Home[]>();
  segments.forEach((s) => bySeg.set(s.id, []));
  homes.forEach((h) => {
    if (h.position === null) return; // stay in tray
    const sid = h.segmentId && bySeg.has(h.segmentId) ? h.segmentId : segments[0].id;
    bySeg.get(sid)!.push(h);
  });
  const positioned = new Map<string, { x: number; y: number }>();
  segments.forEach((seg) => {
    const list = bySeg.get(seg.id) ?? [];
    if (list.length === 0) return;
    const g = seg.geometry ?? {
      ax: ROAD_MARGIN,
      ay: 60 + rowIndex(segments, seg) * 200 + 100,
      bx: BASE_VIEW_W - ROAD_MARGIN,
      by: 60 + rowIndex(segments, seg) * 200 + 100,
    };
    const dx = g.bx - g.ax;
    const dy = g.by - g.ay;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L;
    const uy = dy / L;
    const nx = -uy; // normal
    const ny = ux;
    const OFFSET = 55; // px from centerline to lot top-left origin
    // Space slots along the segment with a small edge inset so nothing sits on top of an endpoint.
    const slots = list.length;
    const inset = 60;
    const usable = Math.max(1, L - inset * 2);
    list.forEach((h, i) => {
      const t = slots === 1 ? 0.5 : inset / L + (i / (slots - 1)) * (usable / L);
      const cx = g.ax + ux * (t * L);
      const cy = g.ay + uy * (t * L);
      const side = i % 2 === 0 ? 1 : -1;
      const x = cx + nx * OFFSET * side - LOT_W / 2;
      const y = cy + ny * OFFSET * side - LOT_H / 2;
      positioned.set(h.id, { x, y });
    });
  });
  return homes.map((h) =>
    positioned.has(h.id) ? { ...h, position: positioned.get(h.id)!, segmentId: h.segmentId ?? segments[0].id } : h,
  );
}

function rowIndex(segments: Segment[], target: Segment) {
  const autoSegs = segments.filter((s) => !s.geometry);
  const idx = autoSegs.findIndex((s) => s.id === target.id);
  return idx < 0 ? 0 : idx;
}

export function buildLayout(
  homes: Home[],
  roadName: string,
  segments?: Segment[],
): Layout {
  const segs: Segment[] =
    segments && segments.length > 0
      ? segments
      : [{ id: "s1", name: roadName, widthFt: 20 }];

  // Auto rows are only used for segments without custom geometry. Count them
  // so we can size the viewport for the auto layout, then extend the view
  // afterwards to include any custom positions.
  const autoSegs = segs.filter((s) => !s.geometry);
  const rowCount = Math.max(autoSegs.length, 1);
  const rowH = 200;
  const autoH = Math.max(BASE_VIEW_H, 100 + rowCount * rowH);
  const VIEW = { w: BASE_VIEW_W, h: autoH };
  const usableW = VIEW.w - ROAD_MARGIN * 2;

  const nodes: NodeMap = {};
  const edges: LayoutEdge[] = [];
  const entrances: LayoutEntrance[] = [];
  const entryDirs: string[] = [];

  let autoIdx = 0;
  segs.forEach((seg) => {
    const wId = `${seg.id}_W`;
    const eId = `${seg.id}_E`;
    let ax: number, ay: number, bx: number, by: number;
    if (seg.geometry) {
      ax = seg.geometry.ax;
      ay = seg.geometry.ay;
      bx = seg.geometry.bx;
      by = seg.geometry.by;
    } else {
      const roadY = 60 + autoIdx * rowH + rowH / 2;
      autoIdx += 1;
      ax = ROAD_MARGIN;
      ay = roadY;
      bx = VIEW.w - ROAD_MARGIN;
      by = roadY;
    }
    nodes[wId] = { id: wId, x: ax, y: ay };
    nodes[eId] = { id: eId, x: bx, y: by };
    const geomLenFt = Math.hypot(bx - ax, by - ay) * FT_PER_UNIT;
    const lengthFt = seg.lengthFt && seg.lengthFt > 0 ? seg.lengthFt : geomLenFt;
    edges.push({ id: seg.id, a: wId, b: eId, length: lengthFt, widthFt: seg.widthFt, road: seg.name });
    const westId = `${seg.id}_west`;
    const eastId = `${seg.id}_east`;
    entrances.push(
      { id: westId, node: wId, label: rowCount > 1 ? `${seg.name} — west` : "West entrance", meets: "Public road", x: nodes[wId].x, y: nodes[wId].y },
      { id: eastId, node: eId, label: rowCount > 1 ? `${seg.name} — east` : "East entrance", meets: "Public road", x: nodes[eId].x, y: nodes[eId].y },
    );
    entryDirs.push(westId, eastId);
  });

  const segIds = new Set(segs.map((s) => s.id));
  const bySeg = new Map<string, Home[]>();
  segs.forEach((s) => bySeg.set(s.id, []));
  // Homes with position === null are "in the tray" — do not render on the map.
  const placed = homes.filter((h) => h.position !== null);
  placed.forEach((h) => {
    const sid = h.segmentId && segIds.has(h.segmentId) ? h.segmentId : segs[0].id;
    bySeg.get(sid)!.push(h);
  });

  const parcels: LayoutParcel[] = [];
  segs.forEach((seg) => {
    const list = bySeg.get(seg.id) ?? [];
    const wNode = nodes[`${seg.id}_W`];
    const eNode = nodes[`${seg.id}_E`];
    const ax = wNode.x;
    const ay = wNode.y;
    const bx = eNode.x;
    const by = eNode.y;
    const segLenU = Math.hypot(bx - ax, by - ay) || 1;

    // Auto-row fallback (only used for homes without a stored position).
    const auto = list.filter((h) => !h.position);
    const southIdx: number[] = [];
    const northIdx: number[] = [];
    auto.forEach((_, i) => (i % 2 === 0 ? southIdx : northIdx).push(i));
    const sCount = southIdx.length || 1;
    const nCount = northIdx.length || 1;
    const sLotW = usableW / sCount;
    const nLotW = usableW / nCount;
    const xToOffsetFt = (x: number) => (x - ax) * FT_PER_UNIT;

    let autoI = 0;
    list.forEach((h) => {
      if (h.position) {
        const x1 = h.position.x;
        const y1 = h.position.y;
        const x2 = x1 + LOT_W;
        const y2 = y1 + LOT_H;
        const cx = x1 + LOT_W / 2;
        const cy = y1 + LOT_H / 2;
        const { t, len } = projectOntoSegment(cx, cy, ax, ay, bx, by);
        const halfSpan = Math.min(0.5, (LOT_W / 2) / (len || segLenU));
        const t1 = Math.max(0, t - halfSpan);
        const t2 = Math.min(1, t + halfSpan);
        const f1x = ax + t1 * (bx - ax);
        const f1y = ay + t1 * (by - ay);
        const f2x = ax + t2 * (bx - ax);
        const f2y = ay + t2 * (by - ay);
        const off1 = t1 * segLenU * FT_PER_UNIT;
        const off2 = t2 * segLenU * FT_PER_UNIT;
        parcels.push({
          id: slug(h.id),
          address: h.address?.trim() || h.label,
          name: h.ownerLabel?.trim() || h.label,
          poly: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]],
          label: [cx, cy],
          frontage: [
            { edge: seg.id, offset: off1 },
            { edge: seg.id, offset: off2 },
          ],
          frontageLine: [[f1x, f1y], [f2x, f2y]],
        });
        return;
      }
      // Auto placement (only meaningful for horizontal auto-segments).
      const i = autoI++;
      const isSouth = i % 2 === 0;
      const posInRow = isSouth ? southIdx.indexOf(i) : northIdx.indexOf(i);
      const lotW = isSouth ? sLotW : nLotW;
      const roadY = ay; // auto segments are horizontal, ay===by
      const x1 = ROAD_MARGIN + posInRow * lotW + 3;
      const x2 = ROAD_MARGIN + (posInRow + 1) * lotW - 3;
      const near = isSouth ? roadY + 8 : roadY - 8;
      const far = isSouth ? roadY + 90 : roadY - 90;
      const poly: [number, number][] = [
        [x1, near],
        [x2, near],
        [x2, far],
        [x1, far],
      ];
      const label: [number, number] = [(x1 + x2) / 2, (near + far) / 2];
      parcels.push({
        id: slug(h.id),
        address: h.address?.trim() || h.label,
        name: h.ownerLabel?.trim() || h.label,
        poly,
        label,
        frontage: [
          { edge: seg.id, offset: xToOffsetFt(x1) },
          { edge: seg.id, offset: xToOffsetFt(x2) },
        ],
        frontageLine: [[x1, roadY], [x2, roadY]],
      });
    });
  });

  const totalRoadFt = edges.reduce((s, e) => s + e.length, 0);

  // Extend viewport if any custom geometry or home positions land outside.
  const allXs: number[] = [];
  const allYs: number[] = [];
  Object.values(nodes).forEach((n) => {
    allXs.push(n.x);
    allYs.push(n.y);
  });
  parcels.forEach((p) => {
    p.poly.forEach(([x, y]) => {
      allXs.push(x);
      allYs.push(y);
    });
  });
  if (allXs.length) {
    const maxX = Math.max(...allXs, VIEW.w);
    const maxY = Math.max(...allYs, VIEW.h);
    VIEW.w = Math.max(VIEW.w, Math.ceil(maxX + 40));
    VIEW.h = Math.max(VIEW.h, Math.ceil(maxY + 40));
  }

  return {
    view: VIEW,
    ftPerUnit: FT_PER_UNIT,
    nodes,
    edges,
    entrances,
    parcels,
    totalRoadFt,
    roadName,
    entryDirs,
  };
}

export function makeHomeId() {
  return `h_${Math.random().toString(36).slice(2, 9)}`;
}

/** Squared distance from a point to a line segment plus the projection point.
 *  Used to snap a dragged home to its nearest road. */
export function nearestPointOnSegments(
  px: number,
  py: number,
  segs: { id: string; ax: number; ay: number; bx: number; by: number }[],
): { segmentId: string; x: number; y: number; side: "left" | "right"; distance: number } | null {
  let best: { segmentId: string; x: number; y: number; side: "left" | "right"; distance: number } | null = null;
  for (const s of segs) {
    const dx = s.bx - s.ax;
    const dy = s.by - s.ay;
    const L2 = dx * dx + dy * dy;
    if (L2 === 0) continue;
    let t = ((px - s.ax) * dx + (py - s.ay) * dy) / L2;
    t = Math.max(0.02, Math.min(0.98, t));
    const cx = s.ax + t * dx;
    const cy = s.ay + t * dy;
    const d = Math.hypot(px - cx, py - cy);
    // Cross product z tells us which side of the line the cursor sits on.
    const cross = dx * (py - s.ay) - dy * (px - s.ax);
    const side: "left" | "right" = cross > 0 ? "right" : "left";
    if (!best || d < best.distance) {
      best = { segmentId: s.id, x: cx, y: cy, side, distance: d };
    }
  }
  return best;
}

/** Given a segment's endpoints and a landing point on that segment, return
 *  the top-left position (x, y) for a LOT_W×LOT_H home tile sitting on the
 *  chosen side of the road (perpendicular offset). */
export function snapHomeTileToRoad(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  landX: number,
  landY: number,
  side: "left" | "right",
): { x: number; y: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const L = Math.hypot(dx, dy) || 1;
  // Unit normal, pointing to the road's LEFT side (perpendicular).
  const nx = -dy / L;
  const ny = dx / L;
  const OFFSET = 50; // pixels from road centerline to tile center
  const sign = side === "left" ? 1 : -1;
  const cx = landX + nx * OFFSET * sign;
  const cy = landY + ny * OFFSET * sign;
  return { x: cx - LOT_W / 2, y: cy - LOT_H / 2 };
}

/** Road-shape templates. Each defines a set of segments with geometry so the
 *  planner can drop a full multi-road neighborhood in one click. Coordinates
 *  are SVG units in the default 900×620 canvas. */
export type RoadTemplate = {
  id: string;
  name: string;
  short: string;
  segments: Segment[];
};

export const ROAD_TEMPLATES: RoadTemplate[] = [
  {
    id: "straight",
    name: "Straight road",
    short: "One road, everyone on it",
    segments: [{ id: "s1", name: "Main Road", widthFt: 20, geometry: { ax: 90, ay: 310, bx: 810, by: 310 } }],
  },
  {
    id: "l-shape",
    name: "L-shape",
    short: "One corner",
    segments: [
      { id: "s1", name: "Main Road", widthFt: 20, geometry: { ax: 90, ay: 480, bx: 500, by: 480 } },
      { id: "s2", name: "Side Road", widthFt: 18, geometry: { ax: 500, ay: 480, bx: 500, by: 140 } },
    ],
  },
  {
    id: "t-intersection",
    name: "T intersection",
    short: "Two roads meet",
    segments: [
      { id: "s1", name: "Main Road", widthFt: 20, geometry: { ax: 90, ay: 310, bx: 810, by: 310 } },
      { id: "s2", name: "Side Road", widthFt: 18, geometry: { ax: 450, ay: 310, bx: 450, by: 560 } },
    ],
  },
  {
    id: "cross",
    name: "Cross / four-way",
    short: "Two roads cross",
    segments: [
      { id: "s1", name: "Main Road", widthFt: 20, geometry: { ax: 90, ay: 310, bx: 810, by: 310 } },
      { id: "s2", name: "Cross Road", widthFt: 18, geometry: { ax: 450, ay: 90, bx: 450, by: 560 } },
    ],
  },
  {
    id: "cul-de-sac",
    name: "Cul-de-sac",
    short: "Straight in, bulb at the end",
    segments: [
      { id: "s1", name: "Entry", widthFt: 20, geometry: { ax: 90, ay: 310, bx: 620, by: 310 } },
      { id: "s2", name: "Bulb", widthFt: 20, geometry: { ax: 620, ay: 310, bx: 780, by: 310 } },
    ],
  },
  {
    id: "loop",
    name: "Loop road",
    short: "Road that loops back",
    segments: [
      { id: "s1", name: "North Loop", widthFt: 18, geometry: { ax: 150, ay: 200, bx: 750, by: 200 } },
      { id: "s2", name: "East Loop", widthFt: 18, geometry: { ax: 750, ay: 200, bx: 750, by: 460 } },
      { id: "s3", name: "South Loop", widthFt: 18, geometry: { ax: 750, ay: 460, bx: 150, by: 460 } },
      { id: "s4", name: "West Loop", widthFt: 18, geometry: { ax: 150, ay: 460, bx: 150, by: 200 } },
    ],
  },
];

export function parseHomesFromList(text: string): Home[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 60)
    .map((line, i) => ({
      id: makeHomeId(),
      label: line.length > 60 ? line.slice(0, 60) : line,
      address: line,
    }));
}

export function makeManualHomes(count: number, startingAddress?: string | null): Home[] {
  const cap = Math.max(2, Math.min(40, Math.round(count)));
  return Array.from({ length: cap }).map((_, i) => ({
    id: makeHomeId(),
    label: i === 0 && startingAddress ? startingAddress : `Home ${i + 1}`,
    address: i === 0 && startingAddress ? startingAddress : null,
  }));
}

// Adapter so the Cedar Hollow sample uses the same Layout shape.
export function cedarHollowLayout(): Layout {
  const nodes: NodeMap = {};
  for (const key of Object.keys(cedar.NODES) as (keyof typeof cedar.NODES)[]) {
    const n = cedar.NODES[key];
    nodes[n.id] = { id: n.id, x: n.x, y: n.y };
  }
  return {
    view: cedar.VIEW,
    ftPerUnit: cedar.FT_PER_UNIT,
    nodes,
    edges: cedar.EDGES.map((e) => ({ id: e.id, a: e.a, b: e.b, length: e.length, widthFt: 20, road: e.road })),
    entrances: cedar.ENTRANCES.map((e) => ({ id: e.id, node: e.node, label: e.label, meets: e.meets, x: e.x, y: e.y })),
    parcels: cedar.PARCELS.map((p) => ({
      id: p.id,
      address: p.address,
      name: p.address,
      poly: p.poly,
      label: p.label,
      frontage: p.frontage,
      frontageLine: p.frontageLine,
      note: p.note,
    })),
    totalRoadFt: cedar.TOTAL_ROAD_FT,
    roadName: "Cedar Hollow",
    entryDirs: ["west", "north"],
  };
}