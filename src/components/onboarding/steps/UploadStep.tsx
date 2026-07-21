import { useRef, useState } from "react";
import { FileText, FileUp, Loader2, Trash2, Upload, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const MAX_FILES = 6;
const MAX_SIZE = 20 * 1024 * 1024; // 20MB per file

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ""));
    fr.onerror = () => reject(new Error("Could not read file"));
    fr.readAsDataURL(file);
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Step 3A. Dedicated upload screen. File picker only opens from the two
 *  explicit controls (dropzone click, Choose Documents button). */
export function UploadStep({
  onSubmit,
  onSkip,
  submitting,
}: {
  onSubmit: (files: { file: File; dataUrl: string }[]) => void | Promise<void>;
  onSkip: () => void;
  submitting?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(incoming: FileList | File[]) {
    setError(null);
    const list = Array.from(incoming);
    const accepted: File[] = [];
    for (const f of list) {
      const isPdf = f.type.includes("pdf") || f.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        setError(`"${f.name}" isn't a PDF. Please upload PDF files only.`);
        continue;
      }
      if (f.size > MAX_SIZE) {
        setError(`"${f.name}" is over 20 MB. Try a smaller export or ask us for help.`);
        continue;
      }
      accepted.push(f);
    }
    setFiles((prev) => {
      const merged = [...prev];
      for (const f of accepted) {
        if (!merged.some((x) => x.name === f.name && x.size === f.size)) merged.push(f);
        if (merged.length >= MAX_FILES) break;
      }
      if (merged.length >= MAX_FILES && list.length + prev.length > MAX_FILES) {
        setError(`You can upload up to ${MAX_FILES} files at a time.`);
      }
      return merged;
    });
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (files.length === 0) return;
    try {
      const payload = await Promise.all(
        files.map(async (file) => ({ file, dataUrl: await fileToDataUrl(file) })),
      );
      await onSubmit(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not read one of the files.";
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold">Upload your road or community documents</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          RoadShare will look for community names, home references, road names, maintenance
          responsibilities, and cost-sharing language.
        </p>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        <strong className="text-foreground">Heads up:</strong> Documents don't always contain street
        addresses or a usable property map. If information is missing, we'll help you complete it
        afterward.
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/10"
            : "border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10"
        }`}
        aria-label="Choose or drop PDF documents"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Upload className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold">Drop PDFs here, or click to choose</p>
        <p className="text-xs text-muted-foreground">PDF only, up to 20 MB per file, {MAX_FILES} files max.</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          <FileUp className="h-4 w-4" /> Choose Documents
        </Button>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">PDF · {formatBytes(f.size)} · Ready to upload</p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${f.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs font-medium text-primary hover:underline"
            >
              + Add another document
            </button>
          </li>
        </ul>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Your documents are stored privately and only visible to your community.
      </p>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onSkip} disabled={submitting}>
          Continue without documents
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={files.length === 0 || submitting}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Upload and Review Documents <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}