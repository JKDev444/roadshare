import type { ParcelInput } from "@/lib/community/api";

/** Parse a small comma or tab separated parcel list. Header row required.
 *  Recognised columns (case-insensitive):
 *    label|lot|number, owner|owner_name, address, area|area_sqft, frontage|frontage_ft
 */
export function parseParcelCsv(text: string): ParcelInput[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const splitLine = (l: string) =>
    l.includes("\t") ? l.split("\t") : l.split(",");

  const header = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = {
    label: findCol(header, ["label", "lot", "number", "lot_number", "lot #"]),
    owner: findCol(header, ["owner", "owner_name", "name"]),
    address: findCol(header, ["address", "street", "site"]),
    area: findCol(header, ["area", "area_sqft", "sqft", "square_feet"]),
    frontage: findCol(header, ["frontage", "frontage_ft", "frontage_feet"]),
  };

  const rows: ParcelInput[] = [];
  for (let i = 1; i < lines.length && rows.length < 200; i++) {
    const cells = splitLine(lines[i]).map((c) => c.trim().replace(/^"|"$/g, ""));
    const label = pick(cells, idx.label) || String(rows.length + 1);
    rows.push({
      label,
      owner_name: pick(cells, idx.owner) || undefined,
      address: pick(cells, idx.address) || undefined,
      area_sqft: num(pick(cells, idx.area)),
      frontage_ft: num(pick(cells, idx.frontage)),
      confidence: "medium",
      verification: "unverified",
      source: "CSV import",
    });
  }
  return rows;
}

function findCol(header: string[], aliases: string[]): number {
  for (const a of aliases) {
    const i = header.indexOf(a);
    if (i !== -1) return i;
  }
  return -1;
}

function pick(cells: string[], i: number): string {
  if (i < 0 || i >= cells.length) return "";
  return cells[i] ?? "";
}

function num(v: string): number | undefined {
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}