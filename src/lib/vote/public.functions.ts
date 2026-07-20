import { createServerFn } from "@tanstack/react-start";

export type PublicVoteContext = {
  decision: {
    id: string;
    title: string;
    question: string | null;
    options: string[];
    quorum: number;
    status: string;
    community_id: string;
  };
  community: { id: string; name: string };
  parcels: Array<{ id: string; label: string; address: string | null }>;
  votes: Array<{
    id: string;
    household_label: string;
    choice: string;
    comment: string | null;
    created_at: string;
  }>;
};

function parseOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

/**
 * Public, unauthenticated read of a single decision + its parcels + votes,
 * gated by an unguessable decision UUID. Used by `/vote/$decisionId` so a
 * neighbor with just a share link can see and cast a vote.
 */
export const getPublicVoteContext = createServerFn({ method: "GET" })
  .inputValidator((data: { decisionId: string }) => data)
  .handler(async ({ data }): Promise<PublicVoteContext> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: decision, error } = await supabaseAdmin
      .from("decisions")
      .select("id, title, question, options, quorum, status, community_id")
      .eq("id", data.decisionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!decision) throw new Error("This vote link is invalid or has been removed.");

    const [{ data: community }, { data: parcels }, { data: votes }] =
      await Promise.all([
        supabaseAdmin
          .from("communities")
          .select("id, name")
          .eq("id", decision.community_id)
          .single(),
        supabaseAdmin
          .from("parcels")
          .select("id, label, address")
          .eq("community_id", decision.community_id)
          .order("label"),
        supabaseAdmin
          .from("decision_votes")
          .select("id, household_label, choice, comment, created_at")
          .eq("decision_id", data.decisionId)
          .order("created_at", { ascending: false }),
      ]);

    return {
      decision: {
        id: decision.id,
        title: decision.title,
        question: decision.question,
        options: parseOptions(decision.options),
        quorum: decision.quorum,
        status: decision.status,
        community_id: decision.community_id,
      },
      community: { id: community?.id ?? "", name: community?.name ?? "your community" },
      parcels: (parcels ?? []).map((p) => ({ id: p.id, label: p.label, address: p.address })),
      votes: votes ?? [],
    };
  });

/**
 * Anonymous vote submission. Upserts on (decision_id, household_label) so
 * the same neighbor can change their mind without creating duplicate rows.
 */
export const castAnonymousVote = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      decisionId: string;
      householdLabel: string;
      choice: string;
      comment?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const household = data.householdLabel.trim().slice(0, 120);
    const choice = data.choice.trim().slice(0, 200);
    const comment = data.comment?.trim().slice(0, 500) || null;
    if (!household) throw new Error("Please pick which home is yours.");
    if (!choice) throw new Error("Please pick Yes or Not yet.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Confirm the decision exists and the choice is one of its allowed options,
    // so this endpoint can't be used to write arbitrary rows.
    const { data: decision, error: decErr } = await supabaseAdmin
      .from("decisions")
      .select("id, community_id, options")
      .eq("id", data.decisionId)
      .maybeSingle();
    if (decErr) throw new Error(decErr.message);
    if (!decision) throw new Error("This vote link is invalid.");
    const options = parseOptions(decision.options);
    if (!options.includes(choice)) throw new Error("That choice isn't on the ballot.");

    const { error } = await supabaseAdmin.from("decision_votes").upsert(
      {
        decision_id: decision.id,
        community_id: decision.community_id,
        household_label: household,
        choice,
        comment,
      },
      { onConflict: "decision_id,household_label" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
