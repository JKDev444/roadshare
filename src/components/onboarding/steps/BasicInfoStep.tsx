import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, MapPin, Loader2, Sparkles, Home, Route as RouteIcon, FileText, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchAddresses, formatHit, type NominatimHit } from "@/lib/onboarding/nominatim";
import { searchAddressSuggestions } from "@/lib/onboarding/geocode.functions";

export type BasicInfo = {
  communityName: string;
  city: string;
  state: string;
  startingAddress: string;
};

export type SetupPath = "map" | "docs" | "manual";

function pickCity(a: NominatimHit["address"]): string {
  return a?.city ?? a?.town ?? a?.village ?? "";
}

/** Step 1. Basic community information. Plain language, minimal fields. */
export function BasicInfoStep({
  initial,
  onContinue,
  onNoAddress,
  onBack,
  onSample,
  onLater,
}: {
  initial?: Partial<BasicInfo>;
  onContinue: (info: BasicInfo, path: SetupPath) => void;
  onNoAddress: (info: Omit<BasicInfo, "startingAddress"> & { startingAddress: "" }) => void;
  onBack: () => void;
  onSample?: () => void;
  onLater?: () => void;
}) {
  const searchFallback = useServerFn(searchAddressSuggestions);
  const [communityName, setCommunityName] = useState(initial?.communityName ?? "");
  const [address, setAddress] = useState(initial?.startingAddress ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [hits, setHits] = useState<NominatimHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(!!initial?.startingAddress);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "ok" | "empty" | "error">("idle");
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Debounced address suggestions.
  useEffect(() => {
    const q = address.trim();
    if (picked || q.length < 4) {
      setHits([]);
      setSearching(false);
      setLookupStatus("idle");
      return;
    }
    setSearching(true);
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        let res = await searchAddresses(q, { signal: ctl.signal });
        const streetNumber = q.match(/^\s*(\d+)/)?.[1];
        const needsExactStreet = Boolean(
          streetNumber && !res.some((hit) => formatHit(hit).includes(streetNumber)),
        );
        if (!ctl.signal.aborted && (res.length === 0 || needsExactStreet)) {
          const fallback = await searchFallback({ data: { query: q } });
          const fallbackHits = fallback.map((hit, index) => ({
            place_id: -1000 - index,
            display_name: hit.label,
            lat: String(hit.lat),
            lon: String(hit.lng),
            address: {
              city: hit.city ?? undefined,
              state: hit.state ?? undefined,
              postcode: hit.postcode ?? undefined,
            },
          }));
          const seen = new Set<string>();
          res = [...fallbackHits, ...res].filter((hit) => {
            const key = formatHit(hit).toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
        if (!ctl.signal.aborted) {
          setHits(res);
          setOpen(res.length > 0);
          setLookupStatus(res.length > 0 ? "ok" : "empty");
        }
      } catch {
        if (!ctl.signal.aborted) {
          console.warn("[onboarding] address lookup failed");
          setLookupStatus("error");
        }
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [address, picked, searchFallback]);

  // Close dropdown on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function selectHit(h: NominatimHit) {
    setAddress(formatHit(h));
    setCity(pickCity(h.address));
    setState(h.address?.state ?? "");
    setPicked(true);
    setOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-fun-2/10 to-fun-3/15 px-4 py-4">
        <div className="pointer-events-none absolute -right-4 -top-4 opacity-20">
          <Home className="h-24 w-24 text-primary" />
        </div>
        <div className="pointer-events-none absolute right-16 top-2 opacity-40">
          <Sparkles className="h-4 w-4 text-fun-3-foreground animate-pulse" />
        </div>
        <div className="relative">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            <RouteIcon className="h-3 w-3" /> Step 1 of 2
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
            Where's your road?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Type your street address — we'll find every home nearby so you can pick your neighbors on a map.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5" ref={boxRef}>
          <Label htmlFor="bi-addr" className="text-xs font-semibold">Your address</Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="bi-addr"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setPicked(false);
              }}
              onFocus={() => hits.length > 0 && setOpen(true)}
              placeholder="Start typing your street address…"
              className="h-11 rounded-xl pl-9 text-base"
              autoComplete="off"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
            {open && hits.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-popover text-sm shadow-lg">
                {hits.map((h) => (
                  <li key={h.place_id}>
                    <button
                      type="button"
                      onClick={() => selectHit(h)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted"
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>{formatHit(h)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {lookupStatus === "error" ? (
            <p className="text-[11px] text-destructive">
              Can't reach the address lookup right now — type your full address and continue.
            </p>
          ) : lookupStatus === "empty" && !picked ? (
            <p className="text-[11px] text-muted-foreground">
              No matches yet — keep typing, or continue with what you've entered.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Any address on your road works — pick one from the list, or type it in full.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bi-name" className="text-xs">
            Community or road name <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="bi-name"
            value={communityName}
            onChange={(e) => setCommunityName(e.target.value)}
            placeholder="e.g. Cedar Hollow Road Group"
            className="rounded-xl"
          />
        </div>
      </div>

      <Button
        size="lg"
        className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-fun-2 text-base font-semibold shadow-md hover:opacity-95"
        onClick={() =>
          onContinue({ communityName, city, state, startingAddress: address }, "map")
        }
        disabled={address.trim().length < 5}
      >
        Pick my neighbors on a map <ArrowRight className="h-4 w-4" />
      </Button>

      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Or another way
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              onContinue({ communityName, city, state, startingAddress: address }, "docs")
            }
            className="flex items-start gap-2 rounded-lg border border-border bg-background p-2.5 text-left text-xs transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="block font-semibold text-foreground">I have documents</span>
              <span className="text-muted-foreground">HOA rules, plat, road agreement…</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() =>
              onContinue({ communityName, city, state, startingAddress: address }, "manual")
            }
            className="flex items-start gap-2 rounded-lg border border-border bg-background p-2.5 text-left text-xs transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="block font-semibold text-foreground">Enter by hand</span>
              <span className="text-muted-foreground">Paste addresses or add lots one by one</span>
            </span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 text-xs">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-1">
          {onSample && (
            <Button variant="ghost" size="sm" onClick={onSample}>
              <Sparkles className="h-3.5 w-3.5" /> See sample
            </Button>
          )}
          {onLater && (
            <Button variant="ghost" size="sm" onClick={onLater}>
              Do this later
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onNoAddress({ communityName, city: "", state: "", startingAddress: "" })
            }
          >
            No address yet
          </Button>
        </div>
      </div>
    </div>
  );
}