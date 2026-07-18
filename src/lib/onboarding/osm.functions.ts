import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type OsmRoad = {
  id: string;
  name: string;
  class: string;
  /** GeoJSON LineString coordinates in [lng, lat] order. */
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

const polygonValidator = (input: unknown) => {
  const schema = z.object({
    polygon: z.object({
      type: z.literal("Polygon"),
      coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
    }),
  });
  return schema.parse(input);
};

/**
 * Ask OpenStreetMap (via the free Overpass API) for every road inside a polygon.
 * No API key required. Falls back gracefully to an empty list when the service
 * is rate-limited or rural.
 */
export const detectRoadsInPolygon = createServerFn({ method: "POST" })
  .inputValidator(polygonValidator)
  .handler(async ({ data }) => {
    const ring = data.polygon.coordinates[0];
    if (ring.length < 4) return { roads: [] as OsmRoad[] };

    // Overpass "poly:" expects lat lon pairs separated by spaces.
    const poly = ring.map(([lng, lat]) => `${lat} ${lng}`).join(" ");
    const query = `[out:json][timeout:25];way["highway"](poly:"${poly}");out;>;out skel qt;`;

    const endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
    ];
    let json:
      | undefined
      | {
      elements?: Array<
        | { type: "node"; id: number; lat: number; lon: number }
        | {
            type: "way";
            id: number;
            tags?: { name?: string; highway?: string };
            nodes?: number[];
          }
      >;
    };
    let lastStatus = 0;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "RoadShare/1.0 (road detection)",
            Accept: "application/json",
          },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (!res.ok) {
          lastStatus = res.status;
          continue;
        }
        json = await res.json();
        break;
      } catch {
        /* try next */
      }
    }
    if (!json) {
      // Non-fatal: roads are optional; return an empty list.
      console.warn(`Overpass road lookup failed (last status ${lastStatus}).`);
      return { roads: [] as OsmRoad[] };
    }

    const elements = json.elements ?? [];
    const nodes = new Map<number, [number, number]>();
    const ways: {
      id: number;
      name?: string;
      highway?: string;
      nodes?: number[];
    }[] = [];

    for (const el of elements) {
      if (el.type === "node") {
        nodes.set(el.id, [el.lon, el.lat]);
      } else if (el.type === "way") {
        ways.push({
          id: el.id,
          name: el.tags?.name,
          highway: el.tags?.highway,
          nodes: el.nodes,
        });
      }
    }

    const roads: OsmRoad[] = [];
    for (const way of ways) {
      if (!way.highway || !way.nodes || way.nodes.length < 2) continue;
      const coords: [number, number][] = [];
      for (const nodeId of way.nodes) {
        const pos = nodes.get(nodeId);
        if (!pos) continue;
        coords.push(pos);
      }
      if (coords.length < 2) continue;
      roads.push({
        id: `osm-${way.id}`,
        name: way.name || `${humanizeClass(way.highway)} road`,
        class: way.highway,
        geometry: { type: "LineString", coordinates: coords },
      });
    }

    return { roads };
  });

function humanizeClass(highway: string) {
  const map: Record<string, string> = {
    residential: "Residential",
    service: "Service",
    unclassified: "Unclassified",
    tertiary: "Tertiary",
    secondary: "Secondary",
    primary: "Primary",
    track: "Track",
    path: "Path",
    footway: "Footway",
    cycleway: "Cycleway",
  };
  return map[highway] ?? "Unnamed";
}
