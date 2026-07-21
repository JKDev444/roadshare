import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  Loader2,
  MapPin,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatHit, searchAddresses, type NominatimHit } from "@/lib/onboarding/nominatim";
import { parseAddressList } from "@/lib/onboarding/parseAddressList";
import type { BasicInfo } from "./BasicInfoStep";

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
  basicInfo,
  onSubmit,
  onUploadInstead,
  onBack,
  submitting,
}: {
  state?: string;
  basicInfo: BasicInfo;
  onSubmit: (r: NoDocsResult) => void | Promise<void>;
  onUploadInstead: () => void;
  onBack: () => void;
  submitting?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("menu");

  if (mode === "menu") {
    return (
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-fun-2/10 to-fun-3/15 px-4 py-4">
          <div className="pointer-events-none absolute right-4 top-2 opacity-40">
            <Sparkles className="h-4 w-4 text-fun-3-foreground animate-pulse" />
          </div>
          <div className="relative">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              Step 2 of 3 · How do you want to add homes?
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
              Let's add your neighbors
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick whatever's easiest — you can add more anytime.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            icon={<Search className="h-6 w-6" />}
            title="Look up addresses"
            sub="Search and add one home at a time."
            hint="Best for a few homes"
            accent="from-primary/15 to-primary/5 text-primary"
            onClick={() => setMode("search")}
          />
          <ChoiceCard
            icon={<ClipboardList className="h-6 w-6" />}
            title="Paste a list"
            sub="One address per line — we'll add each one."
            hint="Fastest for many homes"
            accent="from-fun-2/20 to-fun-2/5 text-fun-2-foreground"
            onClick={() => setMode("paste")}
          />
          <ChoiceCard
            icon={<PenLine className="h-6 w-6" />}
            title="Add homes by hand"
            sub="Type what you know — address, lot, or label."
            hint="Works for any road"
            accent="from-fun-3/20 to-fun-3/5 text-fun-3-foreground"
            onClick={() => setMode("manual")}
          />
          <ChoiceCard
            icon={<Upload className="h-6 w-6" />}
            title="Start with just a name"
            sub="Set up the community now, add homes later."
            hint="No pressure"
            accent="from-muted/60 to-muted/20 text-foreground"
            onClick={() => setMode("empty")}
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 text-xs">
          <Button variant="ghost" size="sm" onClick={onBack}>
            Back
          </Button>
          <Button variant="ghost" size="sm" onClick={onUploadInstead}>
            Upload a PDF instead
          </Button>
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

function ChoiceCard({
  icon,
  title,
  sub,
  hint,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  hint: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-full flex-col items-start gap-2 rounded-2xl border border-border bg-background p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <span
        className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accent}`}
      >
        {icon}
      </span>
      <span className="mt-1 font-display text-base font-bold leading-tight text-foreground">
        {title}
      </span>
      <span className="text-xs text-muted-foreground">{sub}</span>
      <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-primary/80">
        {hint}
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
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
    setSelected((prev) => [...prev, { label: `Home ${prev.length + 1}`, address }]);
    setQuery("");
    setHits([]);
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold">Look up addresses</h2>
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
            No matches. Try a different spelling, or use Paste an Address List / Add Homes Manually.
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
        <h2 className="font-display text-lg font-semibold">Paste your address list</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">One address per line — we'll add one home for each.</p>
      </div>
      <Textarea
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"101 Cedar Hollow Lane\n105 Cedar Hollow Lane\n109 Cedar Hollow Lane"}
        autoFocus
      />
      <p className="text-xs text-muted-foreground">{parsed.length} {parsed.length === 1 ? "property" : "properties"} detected.</p>

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Back</Button>
        <Button
          size="sm"
          onClick={() => onSubmit({ kind: "addresses", items: parsed })}
          disabled={parsed.length === 0 || submitting}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Add {parsed.length} {parsed.length === 1 ? "property" : "properties"} <ArrowRight className="h-4 w-4" />
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
        <h2 className="font-display text-lg font-semibold">Add homes by hand</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">All fields are optional — fill in whatever you know.</p>
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
              placeholder="Home #"
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
        <Plus className="h-3.5 w-3.5" /> Add another home
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
        <h2 className="font-display text-lg font-semibold">Start with just a name</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          We'll set up your community with the name and location. Add homes, roads, and
          documents whenever you're ready.
        </p>
      </div>
      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Back</Button>
        <Button size="sm" onClick={() => onSubmit({ kind: "empty" })} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Create my community <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}