import { useEffect, useRef, useState } from "react";
import { ArrowRight, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchAddresses, formatHit, type NominatimHit } from "@/lib/onboarding/nominatim";

export type BasicInfo = {
  communityName: string;
  city: string;
  state: string;
  startingAddress: string;
};

function pickCity(a: NominatimHit["address"]): string {
  return a?.city ?? a?.town ?? a?.village ?? "";
}

/** Step 1. Basic community information. Plain language, minimal fields. */
export function BasicInfoStep({
  initial,
  onContinue,
  onNoAddress,
  onBack,
}: {
  initial?: Partial<BasicInfo>;
  onContinue: (info: BasicInfo) => void;
  onNoAddress: (info: Omit<BasicInfo, "startingAddress"> & { startingAddress: "" }) => void;
  onBack: () => void;
}) {
  const [communityName, setCommunityName] = useState(initial?.communityName ?? "");
  const [address, setAddress] = useState(initial?.startingAddress ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [hits, setHits] = useState<NominatimHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(!!initial?.startingAddress);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Debounced address suggestions.
  useEffect(() => {
    const q = address.trim();
    if (picked || q.length < 4) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await searchAddresses(q, { signal: ctl.signal });
        setHits(res);
        setOpen(res.length > 0);
      } catch {
        /* aborted or offline */
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [address, picked]);

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
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold">Tell us about your road group</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Just the basics. You can change any of this later.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="bi-name" className="text-xs">
            Community or road name <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="bi-name"
            value={communityName}
            onChange={(e) => setCommunityName(e.target.value)}
            placeholder="e.g. Cedar Hollow Road Group"
          />
        </div>
        <div className="space-y-1.5" ref={boxRef}>
          <Label htmlFor="bi-addr" className="text-xs">Your address</Label>
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
              className="pl-9"
              autoComplete="off"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
            {open && hits.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover text-sm shadow-lg">
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
          <p className="text-[11px] text-muted-foreground">
            Any address on your road works. Pick from the list so we can find it on the map.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onNoAddress({ communityName, city: "", state: "", startingAddress: "" })
            }
          >
            I Don't Know the Address Yet
          </Button>
          <Button
            size="sm"
            onClick={() => onContinue({ communityName, city, state, startingAddress: address })}
            disabled={!address.trim()}
          >
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}