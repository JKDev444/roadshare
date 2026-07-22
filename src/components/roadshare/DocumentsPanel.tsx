import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth/useSession";

type DocItem = { name: string; size: number; updatedAt: string | null };

const BUCKET = "documents";
const MAX_MB = 20;

export function DocumentsPanel() {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase.storage.from(BUCKET).list(userId, {
      limit: 100,
      sortBy: { column: "updated_at", order: "desc" },
    });
    setLoading(false);
    if (error) {
      toast.error("Couldn't load your documents.");
      return;
    }
    setItems(
      (data ?? [])
        .filter((f) => f.name && !f.name.startsWith("."))
        .map((f) => ({
          name: f.name,
          size: (f.metadata as { size?: number } | null)?.size ?? 0,
          updatedAt: f.updated_at ?? f.created_at ?? null,
        })),
    );
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleFile(file: File) {
    if (!userId) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File is too big (max ${MAX_MB} MB).`);
      return;
    }
    setUploading(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
    const path = `${userId}/${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
    setUploading(false);
    if (error) {
      toast.error(error.message || "Upload failed.");
      return;
    }
    toast.success("Document saved.");
    void refresh();
  }

  async function onOpen(item: DocItem) {
    if (!userId) return;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(`${userId}/${item.name}`, 60 * 10);
    if (error || !data?.signedUrl) {
      toast.error("Couldn't open that file.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function onDelete(item: DocItem) {
    if (!userId) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete "${prettyName(item.name)}"?`)) return;
    const { error } = await supabase.storage.from(BUCKET).remove([`${userId}/${item.name}`]);
    if (error) {
      toast.error("Couldn't delete that file.");
      return;
    }
    setItems((prev) => prev.filter((f) => f.name !== item.name));
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <FileText className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-semibold">Documents</span>
            <span className="block truncate text-xs text-muted-foreground">
              {items.length === 0 ? "HOA rules, agreements, invoices" : `${items.length} saved`}
            </span>
          </span>
        </span>
        <ChevronDown className={"h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.heic"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
      {open && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Only you can see these.</p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || !userId}
            >
              {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
              Upload
            </Button>
          </div>
          {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
          No documents yet. Upload a PDF or photo to keep it with your road.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.name} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-2 py-1.5">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{prettyName(item.name)}</p>
                <p className="text-[10px] text-muted-foreground">{formatSize(item.size)}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onOpen(item)} aria-label="Open">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(item)} aria-label="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
        </div>
      )}
    </div>
  );
}

function prettyName(name: string) {
  return name.replace(/^\d+_/, "");
}

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}