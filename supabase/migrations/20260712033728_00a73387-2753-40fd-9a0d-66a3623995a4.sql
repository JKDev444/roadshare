CREATE TYPE public.decision_status AS ENUM ('draft', 'discussion', 'voting', 'decided', 'withdrawn');

-- Decision Rooms (§13): evidence-backed decisions with quorum/notice tracking and versioned published explanations.
CREATE TABLE public.decisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  title text NOT NULL,
  question text,
  description text,
  status public.decision_status NOT NULL DEFAULT 'draft',
  -- Voting choices (jsonb array of strings)
  options jsonb NOT NULL DEFAULT '["Approve","Reject"]'::jsonb,
  -- Minimum households that must vote for the result to count.
  quorum integer NOT NULL DEFAULT 1 CHECK (quorum >= 1),
  -- Assembled supporting record (jsonb array of {kind,label,detail}).
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  notice_date date,
  decided_at timestamptz,
  outcome text,
  -- Published, versioned plain-English explanation of the decision.
  rationale text,
  rationale_version integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One vote per household per decision.
CREATE TABLE public.decision_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_id uuid NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  household_label text NOT NULL,
  choice text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (decision_id, household_label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decisions TO authenticated;
GRANT ALL ON public.decisions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_votes TO authenticated;
GRANT ALL ON public.decision_votes TO service_role;

ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage decisions in their communities"
ON public.decisions
FOR ALL
USING (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = decisions.community_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = decisions.community_id AND c.owner_id = auth.uid()));

CREATE POLICY "Owners manage decision votes in their communities"
ON public.decision_votes
FOR ALL
USING (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = decision_votes.community_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = decision_votes.community_id AND c.owner_id = auth.uid()));

CREATE TRIGGER update_decisions_updated_at
BEFORE UPDATE ON public.decisions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();