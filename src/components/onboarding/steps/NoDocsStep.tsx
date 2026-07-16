import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Loader2, MapPin, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatHit, searchAddresses, type NominatimHit } from "@/lib/onboarding/nominatim";
import { parseAddressList } from "@/lib/onboarding/parseAddressList";

type Mode = "menu" | "search" | "paste" | "manual" | "empty";

export type ManualLot = {
  address?: string;
  lot?: string;
  label?: string;
  road?: string;
};

export type NoDocsResult =
  | { kind: "addresses"; items: Array<{ label: string; address?: string }> }
  | { kind: "manual"; items: ManualLot[] }
  | { kind: "empty" };

/** Step 3B. Shown when the user picks "No documents" or "I'm not sure". */
export function NoDocsStep({
  state,
  onSubmit,
  onUploadInstead,
  onBack,
  submitting,
}: {
  state?: string;
  onSubmit: (r: NoDocsResult) => void | Promise<void>;
  onUploadInstead: () => void;
  onBack: () => void;
  submitting?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("menu");

  if (mode === "menu") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Continue Without Documents</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick whichever is easiest — you can add more later.
          </p>
        </div>

        <div className="space-y-2">
          <MenuTile
            title="Search and Add Addresses"
            body="Search for and add one address at a time."
            onClick={() => setMode("search")}
          />
          <MenuTile
            title="Paste an Address List"
            body="Paste multiple addresses, one per line. We'll turn each into a property."
            onClick={() => setMode("paste")}
          />
          <MenuTile
            title="Add Lots Manually"
            body="Type an address, lot number, label, or road for each property you know about."
            onClick={() => setMode("manual")}
          />
          <MenuTile
            title="Create an Empty Workspace"
            body="Start with just your community name and add everything later."
            onClick={() => setMode("empty")}
          />
          <MenuTile
            title="Upload Documents Instead"
            body="Changed your mind? Go back and upload a PDF."
            onClick={onUploadInstead}
          />
        </div>

        <div className="flex items-center justify-start pt-1">
          <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>
        </div>
      </div>
    );
  }

  if (mode === "search") {
    return <SearchAddresses state={state} onCancel={() => setMode("menu")} onSubmit={onSubmit} submitting={submitting} />;
  }
  if (mode === "paste") {
    return <PasteList onCancel={() => setMode("menu")} onSubmit={onSubmit} submitting={submitting} />;
  }
  if (mode === "manual") {
    return <ManualLots onCancel={() => setMode("menu")} onSubmit={onSubmit} submitting={submitting} />;
  }
  return (
    <EmptyWorkspace onCancel={() => setMode("menu")} onSubmit={onSubmit} submitting={submitting} />
  );
}

function MenuTile({ title, body, onClick }: { title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
      </div>
    </button>
  );
}

function SearchAddresses({
  state,
  onCancel,
  onSubmit,
  submitting,
}: {
  state?: string;
  onCancel: () => void;
  onSubmit: (r: NoDocsResult) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<NominatimHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Array<{ label: string; address: string }>>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 3) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const result = await searchAddresses(query, { state, signal: ctrl.signal });
        setHits(result);
      } catch {
        // Ignored — abort or network hiccup. User can retry.
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, state]);

  function add(hit: NominatimHit) {
    const address = formatHit(hit);
    if (selected.some((s) => s.address === address)) return;
    setSelected((prev) => [...prev, { label: `Lot ${prev.length + 1}`, address }]);
    setQuery("");
    setHits([]);
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold">Search and Add Addresses</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Powered by OpenStreetMap. Rural roads sometimes take a moment.
        </p>
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing an address on your road"
            className="flex-1 bg-transparent text-sm outline-none"
            autoFocus
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {hits.length > 0 && (
          <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
            {hits.map((h) => (
              <li key={h.place_id}>
                <button
                  type="button"
                  onClick={() => add(h)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{formatHit(h)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.length >= 3 && !loading && hits.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            No matches. Try a different spelling, or use Paste an Address List / Add Lots Manually.
          </p>
        )}
      </div>

      {selected.length > 0 && (
        <ul className="space-y-1.5">
          {selected.map((s, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="flex-1 truncate">{s.address}</span>
              <button
                type="button"
                onClick={() => setSelected((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Back</Button>
        <Button
          size="sm"
          onClick={() => onSubmit({ kind: "addresses", items: selected })}
          disabled={selected.length === 0 || submitting}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Continue ({selected.length}) <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function PasteList({
  onCancel,
  onSubmit,
  submitting,
}: {
  onCancel: () => void;
  onSubmit: (r: NoDocsResult) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseAddressList(text), [text]);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold">Paste an Address List</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">One address per line. We'll create one property for each line.</p>
      </div>
      <Textarea
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"101 Cedar Hollow Lane\n105 Cedar Hollow Lane\n109 Cedar Hollow Lane"}
        autoFocus
      />
      <p className="text-xs text-muted-foreground">{parsed.length} property{parsed.length === 1 ? "" : "ies"} detected.</p>

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Back</Button>
        <Button
          size="sm"
          onClick={() => onSubmit({ kind: "addresses", items: parsed })}
          disabled={parsed.length === 0 || submitting}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Add {parsed.length} property{parsed.length === 1 ? "" : "ies"} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ManualLots({
  onCancel,
  onSubmit,
  submitting,
}: {
  onCancel: () => void;
  onSubmit: (r: NoDocsResult) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [rows, setRows] = useState<ManualLot[]>([{}, {}, {}]);

  function update(i: number, patch: Partial<ManualLot>) {
    setRows((prev) => prev.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    setRows((prev) => prev.filter((_, j) => j !== i));
  }
  function add() {
    setRows((prev) => [...prev, {}]);
  }

  const validRows = rows.filter((r) => r.address || r.lot || r.label);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold">Add Lots Manually</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">All fields optional — fill in what you know.</p>
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-12 items-center gap-1.5 rounded-md border border-border bg-card p-2">
            <Input
              className="col-span-4"
              value={r.address ?? ""}
              onChange={(e) => update(i, { address: e.target.value })}
              placeholder="Address"
            />
            <Input
              className="col-span-2"
              value={r.lot ?? ""}
              onChange={(e) => update(i, { lot: e.target.value })}
              placeholder="Lot #"
            />
            <Input
              className="col-span-3"
              value={r.label ?? ""}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Label"
            />
            <Input
              className="col-span-2"
              value={r.road ?? ""}
              onChange={(e) => update(i, { road: e.target.value })}
              placeholder="Road"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="col-span-1 flex justify-center rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label={`Remove row ${i + 1}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={add} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <Plus className="h-3.5 w-3.5" /> Add another lot
      </button>

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Back</Button>
        <Button
          size="sm"
          onClick={() => onSubmit({ kind: "manual", items: validRows })}
          disabled={validRows.length === 0 || submitting}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Continue ({validRows.length}) <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function EmptyWorkspace({
  onCancel,
  onSubmit,
  submitting,
}: {
  onCancel: () => void;
  onSubmit: (r: NoDocsResult) => void | Promise<void>;
  submitting?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold">Create an Empty Workspace</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          We'll create your community with just the name and location. You can add properties,
          roads, and documents whenever you're ready.
        </p>
      </div>
      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Back</Button>
        <Button size="sm" onClick={() => onSubmit({ kind: "empty" })} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Empty Workspace <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}