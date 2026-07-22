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
  segmentId?: string;
};

export type Segment = {
  id: string;
  name: string;
  lengthFt?: number; // overrides geometric length in cost math
  widthFt: number;
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
const ROAD_MARGIN = 70; // horizontal margin from edge of viewport to first lot

function slug(id: string) {
  return id.replace(/[^a-z0-9_-]/gi, "");
}

export function makeSegmentId() {
  return `seg_${Math.random().toString(36).slice(2, 8)}`;
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

  const rowCount = segs.length;
  const rowH = 200;
  const VIEW = { w: BASE_VIEW_W, h: Math.max(440, 100 + rowCount * rowH) };
  const usableW = VIEW.w - ROAD_MARGIN * 2;

  const nodes: NodeMap = {};
  const edges: LayoutEdge[] = [];
  const entrances: LayoutEntrance[] = [];
  const entryDirs: string[] = [];

  segs.forEach((seg, si) => {
    const roadY = 60 + si * rowH + rowH / 2;
    const wId = `${seg.id}_W`;
    const eId = `${seg.id}_E`;
    nodes[wId] = { id: wId, x: ROAD_MARGIN, y: roadY };
    nodes[eId] = { id: eId, x: VIEW.w - ROAD_MARGIN, y: roadY };
    const geomLenFt = (nodes[eId].x - nodes[wId].x) * FT_PER_UNIT;
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
  homes.forEach((h) => {
    const sid = h.segmentId && segIds.has(h.segmentId) ? h.segmentId : segs[0].id;
    bySeg.get(sid)!.push(h);
  });

  const parcels: LayoutParcel[] = [];
  segs.forEach((seg) => {
    const list = bySeg.get(seg.id) ?? [];
    const roadY = nodes[`${seg.id}_W`].y;
    const southIdx: number[] = [];
    const northIdx: number[] = [];
    list.forEach((_, i) => (i % 2 === 0 ? southIdx : northIdx).push(i));
    const sCount = southIdx.length || 1;
    const nCount = northIdx.length || 1;
    const sLotW = usableW / sCount;
    const nLotW = usableW / nCount;
    const wNode = nodes[`${seg.id}_W`];
    const xToOffsetFt = (x: number) => (x - wNode.x) * FT_PER_UNIT;

    list.forEach((h, i) => {
      const isSouth = i % 2 === 0;
      const posInRow = isSouth ? southIdx.indexOf(i) : northIdx.indexOf(i);
      const lotW = isSouth ? sLotW : nLotW;
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
        poly,
        label,
        frontage: [
          { edge: seg.id, offset: xToOffsetFt(x1) },
          { edge: seg.id, offset: xToOffsetFt(x2) },
        ],
        frontageLine: [
          [x1, roadY],
          [x2, roadY],
        ],
      });
    });
  });

  const totalRoadFt = edges.reduce((s, e) => s + e.length, 0);

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