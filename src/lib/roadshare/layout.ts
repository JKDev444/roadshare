// Build a road layout from a list of homes. Used by /my-road so the planner
// renders each user's own homes instead of the hard-coded Cedar Hollow sample.

import type { RoadPos, SurfaceType } from "./data";

export interface LayoutEdge {
  id: string;
  a: string;
  b: string;
  length: number;
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
const VIEW = { w: 900, h: 440 };
const ROAD_Y = 250;
const ROAD_MARGIN = 70; // horizontal margin from edge of viewport to first lot
const NEAR_S = 258;
const FAR_S = 340;
const NEAR_N = 242;
const FAR_N = 160;

function slug(id: string) {
  return id.replace(/[^a-z0-9_-]/gi, "");
}

export function buildLayout(homes: Home[], roadName: string): Layout {
  const n = Math.max(0, homes.length);
  const usableW = VIEW.w - ROAD_MARGIN * 2;

  // Split homes: even indices to south row, odd to north row (interleave so
  // small N still balances across both sides).
  const southIdx: number[] = [];
  const northIdx: number[] = [];
  homes.forEach((_, i) => (i % 2 === 0 ? southIdx : northIdx).push(i));

  const sCount = southIdx.length || 1;
  const nCount = northIdx.length || 1;
  const sLotW = usableW / sCount;
  const nLotW = usableW / nCount;

  const nodes: NodeMap = {
    W: { id: "W", x: ROAD_MARGIN, y: ROAD_Y },
    E: { id: "E", x: VIEW.w - ROAD_MARGIN, y: ROAD_Y },
  };

  const roadLenUnits = nodes.E.x - nodes.W.x;
  const roadLenFt = roadLenUnits * FT_PER_UNIT;

  const edges: LayoutEdge[] = [
    { id: "WE", a: "W", b: "E", length: roadLenFt, road: roadName },
  ];

  const entrances: LayoutEntrance[] = [
    {
      id: "west",
      node: "W",
      label: "West entrance",
      meets: "Public road",
      x: nodes.W.x,
      y: nodes.W.y,
    },
    {
      id: "east",
      node: "E",
      label: "East entrance",
      meets: "Public road",
      x: nodes.E.x,
      y: nodes.E.y,
    },
  ];

  function xToOffset(x: number) {
    return (x - nodes.W.x) * FT_PER_UNIT;
  }

  const parcels: LayoutParcel[] = homes.map((h, i) => {
    const isSouth = i % 2 === 0;
    const posInRow = isSouth ? southIdx.indexOf(i) : northIdx.indexOf(i);
    const lotW = isSouth ? sLotW : nLotW;
    const x1 = ROAD_MARGIN + posInRow * lotW + 3;
    const x2 = ROAD_MARGIN + (posInRow + 1) * lotW - 3;
    const near = isSouth ? NEAR_S : NEAR_N;
    const far = isSouth ? FAR_S : FAR_N;
    const poly: [number, number][] = [
      [x1, near],
      [x2, near],
      [x2, far],
      [x1, far],
    ];
    const label: [number, number] = [(x1 + x2) / 2, (near + far) / 2];
    return {
      id: slug(h.id),
      address: h.address?.trim() || h.label,
      poly,
      label,
      frontage: [
        { edge: "WE", offset: xToOffset(x1) },
        { edge: "WE", offset: xToOffset(x2) },
      ],
      frontageLine: [
        [x1, ROAD_Y],
        [x2, ROAD_Y],
      ],
    };
  });

  const layout: Layout = {
    view: VIEW,
    ftPerUnit: FT_PER_UNIT,
    nodes,
    edges,
    entrances,
    parcels,
    totalRoadFt: roadLenFt,
    roadName,
    entryDirs: ["west", "east"],
  };
  return layout;
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
  // Lazy require avoids circular type surface.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const data = require("./data") as typeof import("./data");
  const nodes: NodeMap = {};
  for (const key of Object.keys(data.NODES) as (keyof typeof data.NODES)[]) {
    const n = data.NODES[key];
    nodes[n.id] = { id: n.id, x: n.x, y: n.y };
  }
  return {
    view: data.VIEW,
    ftPerUnit: data.FT_PER_UNIT,
    nodes,
    edges: data.EDGES.map((e) => ({ id: e.id, a: e.a, b: e.b, length: e.length, road: e.road })),
    entrances: data.ENTRANCES.map((e) => ({ id: e.id, node: e.node, label: e.label, meets: e.meets, x: e.x, y: e.y })),
    parcels: data.PARCELS.map((p) => ({
      id: p.id,
      address: p.address,
      poly: p.poly,
      label: p.label,
      frontage: p.frontage,
      frontageLine: p.frontageLine,
      note: p.note,
    })),
    totalRoadFt: data.TOTAL_ROAD_FT,
    roadName: "Cedar Hollow",
    entryDirs: ["west", "north"],
  };
}