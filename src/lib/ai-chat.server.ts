// Server-only chat helper that transparently falls back from Lovable AI Gateway
// to a direct provider key (OpenAI) when running outside Lovable (e.g. Vercel).
//
// Priority:
//   1. LOVABLE_API_KEY   -> Lovable AI Gateway (default inside Lovable)
//   2. OPENAI_API_KEY    -> OpenAI API directly (for Vercel or other hosts)
//
// If neither is set, callers get { ok: false, reason: "unconfigured" } and
// should degrade gracefully.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatOptions = {
  messages: ChatMessage[];
  /** Hint for provider selection. "fast" = cheap/quick (default). */
  tier?: "fast" | "smart";
};

export type ChatResult =
  | { ok: true; text: string }
  | { ok: false; reason: "unconfigured" | "http_error" | "network_error"; status?: number };

type Backend = {
  url: string;
  headers: Record<string, string>;
  model: string;
};

function pickBackend(tier: "fast" | "smart"): Backend | null {
  const lovable = process.env.LOVABLE_API_KEY;
  if (lovable) {
    return {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${lovable}`,
      },
      model: tier === "smart" ? "openai/gpt-5.5" : "google/gemini-2.5-flash",
    };
  }
  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${openai}`,
      },
      model: tier === "smart" ? "gpt-4o" : "gpt-4o-mini",
    };
  }
  return null;
}

export async function runChatCompletion(opts: ChatOptions): Promise<ChatResult> {
  const backend = pickBackend(opts.tier ?? "fast");
  if (!backend) return { ok: false, reason: "unconfigured" };

  try {
    const res = await fetch(backend.url, {
      method: "POST",
      headers: backend.headers,
      body: JSON.stringify({
        model: backend.model,
        messages: opts.messages,
      }),
    });
    if (!res.ok) return { ok: false, reason: "http_error", status: res.status };
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json?.choices?.[0]?.message?.content ?? "";
    return { ok: true, text };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

/** True when *some* AI backend is reachable — helpful for feature gating. */
export function hasAiBackend(): boolean {
  return Boolean(process.env.LOVABLE_API_KEY || process.env.OPENAI_API_KEY);
}