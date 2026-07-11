import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logEvent } from "@/lib/community/api";

export type Document = Database["public"]["Tables"]["documents"]["Row"];
export type DocType = Database["public"]["Enums"]["doc_type"];
export type DocStatus = Database["public"]["Enums"]["doc_status"];

export const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "deed", label: "Deed" },
  { value: "plat", label: "Plat / survey" },
  { value: "agreement", label: "Road agreement" },
  { value: "amendment", label: "Amendment" },
  { value: "bylaws", label: "Bylaws / CC&Rs" },
  { value: "bid", label: "Bid / estimate" },
  { value: "invoice", label: "Invoice" },
  { value: "correspondence", label: "Correspondence" },
  { value: "other", label: "Other" },
];

export const DOC_STATUS: Record<DocStatus, { label: string; tone: "amber" | "blue" | "green" | "red" }> = {
  processing: { label: "Processing", tone: "blue" },
  needs_review: { label: "Needs review", tone: "amber" },
  verified: { label: "Verified", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
};

export function docTypeLabel(t: DocType | null): string {
  return DOC_TYPES.find((d) => d.value === t)?.label ?? "—";
}

async function unwrap<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

export async function listDocuments(communityId: string): Promise<Document[]> {
  return unwrap(supabase.from("documents").select("*").eq("community_id", communityId).order("created_at", { ascending: false }));
}

export async function getDocument(id: string): Promise<Document> {
  return unwrap(supabase.from("documents").select("*").eq("id", id).single());
}

/** Read a short text sample from the file for classification (only for text-like files). */
async function readTextSample(file: File): Promise<string> {
  if (file.type.startsWith("text/") || file.type === "application/json") {
    try {
      return (await file.text()).slice(0, 8000);
    } catch {
      return "";
    }
  }
  return "";
}

export async function uploadDocument(
  communityId: string,
  file: File,
  title: string,
): Promise<{ document: Document; textSample: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("You must be signed in to upload.");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `${uid}/${communityId}/${crypto.randomUUID()}-${safeName}`;

  const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message);

  const textSample = await readTextSample(file);

  const document = await unwrap(
    supabase
      .from("documents")
      .insert({
        community_id: communityId,
        title: title.trim() || file.name,
        file_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        status: "processing",
        extracted_text: textSample || null,
      })
      .select()
      .single(),
  );
  await logEvent(communityId, { entity_type: "document", entity_label: document.title, action: "uploaded" });
  return { document, textSample };
}

export type DocumentUpdate = Partial<
  Pick<Document, "title" | "doc_type" | "status" | "source" | "effective_date" | "notes" | "ai_suggested_type" | "ai_summary" | "ai_confidence" | "verified_at">
>;

export async function updateDocument(id: string, communityId: string, input: DocumentUpdate, action?: string): Promise<Document> {
  const doc = await unwrap(supabase.from("documents").update(input).eq("id", id).select().single());
  if (action) await logEvent(communityId, { entity_type: "document", entity_label: doc.title, action });
  return doc;
}

export async function applyClassification(
  id: string,
  suggested: { type: DocType; summary: string; confidence: number },
): Promise<Document> {
  return unwrap(
    supabase
      .from("documents")
      .update({
        ai_suggested_type: suggested.type,
        ai_summary: suggested.summary || null,
        ai_confidence: suggested.confidence,
        status: "needs_review",
      })
      .eq("id", id)
      .select()
      .single(),
  );
}

export async function verifyDocument(id: string, communityId: string, docType: DocType): Promise<Document> {
  return updateDocument(id, communityId, { status: "verified", doc_type: docType, verified_at: new Date().toISOString() }, "verified");
}

export async function rejectDocument(id: string, communityId: string): Promise<Document> {
  return updateDocument(id, communityId, { status: "rejected", verified_at: null }, "rejected");
}

export async function deleteDocument(doc: Pick<Document, "id" | "file_path" | "community_id" | "title">): Promise<void> {
  await supabase.storage.from("documents").remove([doc.file_path]);
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) throw new Error(error.message);
  await logEvent(doc.community_id, { entity_type: "document", entity_label: doc.title, action: "removed" });
}

export async function signedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, expiresIn);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export function formatBytes(n: number | null): string {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
