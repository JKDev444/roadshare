import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Home, Loader2, MapPin, Minus, Pencil, Plus, Route as RouteIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  autoArrangeHomes,
  makeHomeId,
  makeManualHomes,
  makeSegmentId,
  parseHomesFromList,
  type Home as RoadHome,
  type Segment as RoadSegment,
} from "@/lib/roadshare/layout";
import { createMyRoad } from "@/lib/roadshare/road.functions";

export const Route = createFileRoute("/_authenticated/welcome")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Start your road — RoadShare" },
      { name: "description", content: "Set up your private road plan in two simple steps." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WelcomePage,
});

type Screen = "name" | "homes";
type Tile = "address" | "paste" | "manual" | null;

function WelcomePage() {
  const create = useServerFn(createMyRoad);
  const navigate = useNavigate();
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("name");
  const [name, setName] = useState("");
  const [tile, setTile] = useState<Tile>(null);
  const [busy, setBusy] = useState(false);

  const [address, setAddress] = useState("");
  const [addressCount, setAddressCount] = useState(6);
  const [pasted, setPasted] = useState("");
  const [manualCount, setManualCount] = useState(8);

  const parsedPastedCount = useMemo(
    () => parseHomesFromList(pasted).length,
    [pasted],
  );

  async function finish(homes: RoadHome[]) {
    if (homes.length < 2) {
      toast.error("Add at least 2 homes so we can split the cost.");
      return;
    }
    setBusy(true);
    try {
      await create({ data: { name: name || "My road", homes } });
      await router.invalidate();
      navigate({ to: "/my-road" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your road.");
      setBusy(false);
    }
  }

  function submitTile() {
    if (tile === "address") {
      const addr = address.trim();
      if (!addr) {
        toast.error("Type your street address first.");
        return;
      }
      const homes: RoadHome[] = [{ id: makeHomeId(), label: addr, address: addr }];
      for (let i = 1; i < addressCount; i++) {
        homes.push({ id: makeHomeId(), label: `Neighbor ${i}`, address: null });
      }
      void finish(homes);
    } else if (tile === "paste") {
      const homes = parseHomesFromList(pasted);
      if (homes.length < 2) {
        toast.error("Paste at least 2 addresses, one per line.");
        return;
      }
      void finish(homes);
    } else if (tile === "manual") {
      const homes = makeManualHomes(manualCount);
      void finish(homes);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12 topo-grid">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <RouteIcon className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">RoadShare</span>
        </div>

        {screen === "name" && (
          <section className="rounded-3xl border border-border/70 bg-card p-8 shadow-xl">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Pencil className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 1 of 2</p>
                <h1 className="font-display text-2xl font-bold tracking-tight">Name your road</h1>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Just a friendly name so you can find it later — like "Cedar Hollow Lane" or "our gravel road."
            </p>
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setScreen("homes");
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="road-name">Road name</Label>
                <Input
                  id="road-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cedar Hollow Lane"
                  maxLength={80}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Skip it and we'll call it "My road" for now.</p>
              </div>
              <Button type="submit" className="w-full" size="lg">
                Next: who's on your road? <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </section>
        )}

        {screen === "homes" && (
          <section className="rounded-3xl border border-border/70 bg-card p-8 shadow-xl">
            <div className="mb-6 flex items-start gap-3">
              <button
                type="button"
                onClick={() => setScreen("name")}
                className="mt-1 grid h-8 w-8 place-items-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-accent"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 2 of 2</p>
                <h1 className="font-display text-2xl font-bold tracking-tight">Who's on your road?</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick the easiest way. Don't stress — you can rename or edit every home later.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <TileButton
                active={tile === "address"}
                icon={MapPin}
                title="Use my address"
                subtitle="I'll type it in"
                onClick={() => setTile("address")}
              />
              <TileButton
                active={tile === "paste"}
                icon={Sparkles}
                title="Paste a list"
                subtitle="One address per line"
                onClick={() => setTile("paste")}
              />
              <TileButton
                active={tile === "manual"}
                icon={Home}
                title="Enter by hand"
                subtitle="Just pick a number"
                onClick={() => setTile("manual")}
              />
            </div>

            {tile === "address" && (
              <div className="mt-6 space-y-4 rounded-2xl border border-border bg-muted/30 p-4">
                <div className="space-y-2">
                  <Label htmlFor="my-address">Your street address</Label>
                  <Input
                    id="my-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="787 Five Peaks Dr, Kalama, WA"
                    autoFocus
                  />
                </div>
                <Stepper
                  label="How many homes share the road (including yours)?"
                  value={addressCount}
                  onChange={setAddressCount}
                />
                <p className="text-xs text-muted-foreground">
                  Your address becomes home #1. We'll add the others as placeholders you can rename later.
                </p>
              </div>
            )}

            {tile === "paste" && (
              <div className="mt-6 space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
                <Label htmlFor="paste">Addresses (one per line)</Label>
                <Textarea
                  id="paste"
                  rows={7}
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder={"101 Cedar Hollow Lane\n105 Cedar Hollow Lane\n109 Cedar Hollow Lane"}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  We found <b>{parsedPastedCount}</b> home{parsedPastedCount === 1 ? "" : "s"} so far.
                </p>
              </div>
            )}

            {tile === "manual" && (
              <div className="mt-6 space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
                <Stepper
                  label="How many homes are on your road?"
                  value={manualCount}
                  onChange={setManualCount}
                />
                <p className="text-xs text-muted-foreground">
                  We'll create "Home 1, Home 2…" — you can rename them any time.
                </p>
              </div>
            )}

            <Button
              className="mt-6 w-full"
              size="lg"
              onClick={submitTile}
              disabled={busy || !tile}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>Open my road <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </section>
        )}
      </div>
    </main>
  );
}

function TileButton({
  active,
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors",
        active
          ? "border-primary bg-primary/10 shadow-md"
          : "border-border bg-background hover:border-primary/50 hover:bg-primary/5",
      )}
    >
      <span className={cn(
        "grid h-11 w-11 place-items-center rounded-2xl",
        active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
      )}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="block font-display text-base font-bold tracking-tight">{title}</span>
      <span className="block text-xs text-muted-foreground">{subtitle}</span>
    </button>
  );
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(Math.max(2, value - 1))}
          aria-label="Decrease"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="grid h-11 w-16 place-items-center rounded-xl border border-border bg-background font-display text-2xl font-bold">
          {value}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(Math.min(40, value + 1))}
          aria-label="Increase"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">2 – 40 homes</span>
      </div>
    </div>
  );
}