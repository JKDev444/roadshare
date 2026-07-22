// Build a road layout from a list of homes. Used by /my-road so the planner
// renders each user's own homes instead of the hard-coded Cedar Hollow sample.

import type { Edge, Entrance, Parcel } from "./data";

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
  edges: Edge[];
  entrances: Entrance[];
  parcels: Parcel[];
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

  const edges: Edge[] = [
    { id: "WE", a: "W" as never, b: "E" as never, length: roadLenFt, road: roadName },
  ];

  const entrances: Entrance[] = [
    {
      id: "west" as never,
      node: "W" as never,
      label: "West entrance",
      meets: "Public road",
      x: nodes.W.x,
      y: nodes.W.y,
    },
    {
      id: "east" as never,
      node: "E" as never,
      label: "East entrance",
      meets: "Public road",
      x: nodes.E.x,
      y: nodes.E.y,
    },
  ];

  function xToOffset(x: number) {
    return (x - nodes.W.x) * FT_PER_UNIT;
  }

  const parcels: Parcel[] = homes.map((h, i) => {
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

  return {
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