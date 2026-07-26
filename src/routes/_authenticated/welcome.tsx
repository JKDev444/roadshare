import { useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, FileText, Home, Loader2, MapPin, Minus, Pencil, Plus, Route as RouteIcon, Sparkles, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth/useSession";
import {
  autoArrangeHomes,
  defaultFrontageFor,
  makeHomeId,
  makeManualHomes,
  makeSegmentId,
  parseHomesFromList,
  ROAD_TEMPLATES,
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

type Screen = "name" | "docs" | "shape" | "homes";
type Tile = "address" | "paste" | "manual" | null;

const DOC_BUCKET = "documents";
const DOC_MAX_MB = 20;

function WelcomePage() {
  const create = useServerFn(createMyRoad);
  const navigate = useNavigate();
  const router = useRouter();
  const { user } = useSession();
  const userId = user?.id ?? null;

  const [screen, setScreen] = useState<Screen>("name");
  const [name, setName] = useState("");
  const [tile, setTile] = useState<Tile>(null);
  const [busy, setBusy] = useState(false);
  const [shapeId, setShapeId] = useState<string>("straight");

  const [address, setAddress] = useState("");
  const [addressCount, setAddressCount] = useState(6);
  const [pasted, setPasted] = useState("");
  const [manualCount, setManualCount] = useState(8);

  const [uploadedDocs, setUploadedDocs] = useState<{ name: string; path: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

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
    const roadName = name || "My road";
    // Clone the chosen road-shape template with fresh IDs so multiple users
    // don't collide on shared "s1/s2" ids.
    const template = ROAD_TEMPLATES.find((t) => t.id === shapeId) ?? ROAD_TEMPLATES[0];
    const segments: RoadSegment[] = template.segments.map((s, i) => ({
      ...s,
      id: makeSegmentId(),
      name: i === 0 ? roadName : s.name,
    }));
    const primarySegmentId = segments[0].id;
    const defaultFrontage = defaultFrontageFor(segments, homes.length);
    const seeded = homes.map((h) => ({
      ...h,
      segmentId: primarySegmentId,
      position: { x: 0, y: 0 } as { x: number; y: number },
      frontageFtOverride: h.frontageFtOverride ?? defaultFrontage,
    }));
    const arranged = autoArrangeHomes(seeded, segments);
    try {
      await create({ data: { name: roadName, homes: arranged, segments } });
      await router.invalidate();
      navigate({ to: "/my-road" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your road.");
      setBusy(false);
    }
  }

  async function handleDocFile(file: File) {
    if (!userId) {
      toast.error("Sign in required to upload.");
      return;
    }
    if (file.size > DOC_MAX_MB * 1024 * 1024) {
      toast.error(`File is too big (max ${DOC_MAX_MB} MB).`);
      return;
    }
    setUploading(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
    const path = `${userId}/${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from(DOC_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
    setUploading(false);
    if (error) {
      toast.error(error.message || "Upload failed.");
      return;
    }
    setUploadedDocs((prev) => [...prev, { name: safe, path }]);
    toast.success("Document saved.");
  }

  async function removeDoc(item: { name: string; path: string }) {
    const { error } = await supabase.storage.from(DOC_BUCKET).remove([item.path]);
    if (error) {
      toast.error("Couldn't remove that file.");
      return;
    }
    setUploadedDocs((prev) => prev.filter((d) => d.path !== item.path));
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
                setScreen("docs");
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
              Next: any documents? <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </section>
        )}

        {screen === "docs" && (
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
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 2 of 4</p>
                <h1 className="font-display text-2xl font-bold tracking-tight">Got any documents?</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  CC&amp;Rs, a road-maintenance agreement, or a plat map — anything that helps you and your neighbors trust the plan. Totally optional.
                </p>
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  <Sparkles className="h-3 w-3" /> Coming soon: we'll read your CC&amp;Rs and suggest homes + frontage automatically
                </p>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-dashed border-border bg-muted/20 p-6 text-center">
              <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Upload className="h-6 w-6" />
              </span>
              <p className="font-display text-base font-semibold">Upload a document</p>
              <p className="mt-1 text-xs text-muted-foreground">PDF, Word doc, or photo — up to {DOC_MAX_MB} MB each.</p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => docInputRef.current?.click()}
                disabled={uploading || !userId}
              >
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Choose file
              </Button>
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.heic"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleDocFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            {uploadedDocs.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {uploadedDocs.map((d) => (
                  <li
                    key={d.path}
                    className="flex items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm">{d.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => void removeDoc(d)}
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                size="lg"
                onClick={() => setScreen("shape")}
              >
                <X className="h-4 w-4" /> I don't have any
              </Button>
              <Button
                type="button"
                className="flex-1"
                size="lg"
                onClick={() => setScreen("shape")}
              >
                {uploadedDocs.length > 0 ? "Continue" : "I'll add them later"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              You can upload more from the Documents page anytime.
            </p>
          </section>
        )}

        {screen === "shape" && (
          <section className="rounded-3xl border border-border/70 bg-card p-8 shadow-xl">
            <div className="mb-6 flex items-start gap-3">
              <button
                type="button"
                onClick={() => setScreen("docs")}
                className="mt-1 grid h-8 w-8 place-items-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-accent"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 3 of 4</p>
                <h1 className="font-display text-2xl font-bold tracking-tight">Pick a road shape</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick whichever looks closest to your road. You can drag, add, or tweak roads later — this is just a starting shape.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {ROAD_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setShapeId(t.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                    shapeId === t.id
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border bg-background hover:border-primary/50 hover:bg-primary/5",
                  )}
                >
                  <TemplateThumb segments={t.segments} active={shapeId === t.id} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-sm font-bold tracking-tight">{t.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.short}</span>
                  </span>
                </button>
              ))}
            </div>

            <Button className="mt-6 w-full" size="lg" onClick={() => setScreen("homes")}>
              Next: who's on your road? <ArrowRight className="h-4 w-4" />
            </Button>
          </section>
        )}

        {screen === "homes" && (
          <section className="rounded-3xl border border-border/70 bg-card p-8 shadow-xl">
            <div className="mb-6 flex items-start gap-3">
              <button
                type="button"
                onClick={() => setScreen("shape")}
                className="mt-1 grid h-8 w-8 place-items-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-accent"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 4 of 4</p>
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

function TemplateThumb({ segments, active }: { segments: RoadSegment[]; active: boolean }) {
  // Fit the template's SVG-unit geometry into a 72x54 thumbnail.
  const pts = segments.flatMap((s) => (s.geometry ? [[s.geometry.ax, s.geometry.ay], [s.geometry.bx, s.geometry.by]] : []));
  if (pts.length === 0) return <span className="h-14 w-[72px] rounded-lg bg-muted" />;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 40;
  return (
    <span className={cn("grid h-14 w-[72px] place-items-center rounded-lg", active ? "bg-primary/15" : "bg-muted/60")}>
      <svg viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`} className="h-full w-full">
        {segments.map((s) =>
          s.geometry ? (
            <line
              key={s.id}
              x1={s.geometry.ax}
              y1={s.geometry.ay}
              x2={s.geometry.bx}
              y2={s.geometry.by}
              stroke="currentColor"
              strokeWidth={36}
              strokeLinecap="round"
              className={active ? "text-primary" : "text-foreground/70"}
            />
          ) : null,
        )}
      </svg>
    </span>
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