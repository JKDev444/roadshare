// Cedar Hollow — a fictional 14-lot neighborhood modeled as a road network.
// Drawing units -> feet at 1.25 ft per unit (true scale, per the spec).

export const FT_PER_UNIT = 1.25;
export const VIEW = { w: 900, h: 440 };

// Road network graph nodes (drawing-unit coordinates).
export const NODES = {
  W: { id: "W", x: 70, y: 300 }, // west entrance @ County Rd 12
  J: { id: "J", x: 500, y: 300 }, // T-junction
  E: { id: "E", x: 812, y: 300 }, // cul-de-sac end
  N: { id: "N", x: 500, y: 66 }, // north entrance @ Ridge Rd
} as const;

export type NodeId = keyof typeof NODES;

function dist(a: NodeId, b: NodeId) {
  const p = NODES[a];
  const q = NODES[b];
  return Math.hypot(p.x - q.x, p.y - q.y) * FT_PER_UNIT;
}

export interface Edge {
  id: string;
  a: NodeId;
  b: NodeId;
  length: number; // feet
  road: string;
}

export const EDGES: Edge[] = [
  { id: "WJ", a: "W", b: "J", length: dist("W", "J"), road: "Cedar Hollow Lane" },
  { id: "JE", a: "J", b: "E", length: dist("J", "E"), road: "Cedar Hollow Lane" },
  { id: "JN", a: "J", b: "N", length: dist("J", "N"), road: "Hollow Ridge Court" },
];

export const TOTAL_ROAD_FT = EDGES.reduce((s, e) => s + e.length, 0);

export interface Entrance {
  id: "west" | "north";
  node: NodeId;
  label: string;
  meets: string;
  x: number;
  y: number;
}

export const ENTRANCES: Entrance[] = [
  { id: "west", node: "W", label: "West entrance", meets: "County Rd 12", x: NODES.W.x, y: NODES.W.y },
  { id: "north", node: "N", label: "North entrance", meets: "Ridge Rd", x: NODES.N.x, y: NODES.N.y },
];

// A frontage endpoint is a position on the network: an edge + offset (ft from edge.a).
export interface RoadPos {
  edge: string;
  offset: number;
}

export interface Parcel {
  id: string;
  address: string;
  poly: [number, number][]; // drawing-unit polygon
  label: [number, number]; // centroid for text
  frontage: [RoadPos, RoadPos];
  frontageLine: [[number, number], [number, number]]; // along-road markers
  note?: string;
}

// Helpers to build lots along a horizontal road (Cedar Hollow Lane, y=300)
// x=70 is W (0 ft), x=500 is J. Edge WJ offset = (x-70)*FT. Edge JE offset = (x-500)*FT.
function cedarPos(x: number): RoadPos {
  return x <= 500
    ? { edge: "WJ", offset: (x - 70) * FT_PER_UNIT }
    : { edge: "JE", offset: (x - 500) * FT_PER_UNIT };
}
function ridgePos(y: number): RoadPos {
  return { edge: "JN", offset: (300 - y) * FT_PER_UNIT };
}

function hLot(
  id: string,
  address: string,
  x1: number,
  x2: number,
  side: "n" | "s",
  note?: string,
): Parcel {
  const near = side === "n" ? 292 : 308;
  const far = side === "n" ? 224 : 376;
  return {
    id,
    address,
    poly: [
      [x1, near],
      [x2, near],
      [x2, far],
      [x1, far],
    ],
    label: [(x1 + x2) / 2, (near + far) / 2],
    frontage: [cedarPos(x1), cedarPos(x2)],
    frontageLine: [
      [x1, 300],
      [x2, 300],
    ],
    note,
  };
}

function vLot(
  id: string,
  address: string,
  y1: number,
  y2: number,
  side: "e" | "w",
  note?: string,
): Parcel {
  const near = side === "e" ? 508 : 492;
  const far = side === "e" ? 584 : 416;
  return {
    id,
    address,
    poly: [
      [near, y1],
      [far, y1],
      [far, y2],
      [near, y2],
    ],
    label: [(near + far) / 2, (y1 + y2) / 2],
    frontage: [ridgePos(y1), ridgePos(y2)],
    frontageLine: [
      [500, y1],
      [500, y2],
    ],
    note,
  };
}

export const PARCELS: Parcel[] = [
  // South side of Cedar Hollow Lane (W -> J -> E)
  hLot("p1", "101 Cedar Hollow Lane", 92, 190, "s"),
  hLot("p2", "105 Cedar Hollow Lane", 196, 294, "s"),
  hLot("p3", "109 Cedar Hollow Lane", 300, 398, "s"),
  hLot("p4", "113 Cedar Hollow Lane", 404, 494, "s"),
  hLot("p5", "205 Cedar Hollow Lane", 526, 620, "s"),
  hLot("p6", "209 Cedar Hollow Lane", 626, 720, "s"),
  // North side of Cedar Hollow Lane
  hLot("p7", "102 Cedar Hollow Lane", 92, 190, "n"),
  hLot("p8", "106 Cedar Hollow Lane", 196, 294, "n"),
  hLot("p9", "110 Cedar Hollow Lane", 300, 398, "n"),
  hLot("p10", "206 Cedar Hollow Lane", 526, 620, "n"),
  // Cul-de-sac end lot
  hLot("p11", "222 Cedar Hollow Lane", 726, 806, "s", "Cul-de-sac end lot"),
  // Hollow Ridge Court (J -> N)
  vLot("p12", "301 Hollow Ridge Court", 232, 150, "e"),
  vLot("p13", "305 Hollow Ridge Court", 148, 74, "e"),
  vLot("p14", "302 Hollow Ridge Court", 232, 150, "w"),
];

export interface SurfaceType {
  id: string;
  label: string;
  defaultPct: number;
  defaultCost: number;
}

export const SURFACE_TYPES: SurfaceType[] = [
  { id: "gravel", label: "Gravel", defaultPct: 0, defaultCost: 0.75 },
  { id: "chip", label: "Chip seal", defaultPct: 0, defaultCost: 1.25 },
  { id: "asphalt2", label: '2″ asphalt', defaultPct: 100, defaultCost: 3.0 },
  { id: "asphalt3", label: '3″ asphalt', defaultPct: 0, defaultCost: 4.25 },
  { id: "asphalt3p", label: '3″+ asphalt', defaultPct: 0, defaultCost: 5.5 },
  { id: "concrete", label: "Concrete", defaultPct: 0, defaultCost: 8.5 },
];

export const DEFAULTS = {
  roadWidth: 20,
  fundingPeriod: 15,
};