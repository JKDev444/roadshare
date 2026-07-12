-- Phase 9 — Community Pulse: surveys, privacy-preserving participation & aggregate results

CREATE TYPE public.survey_status AS ENUM ('draft', 'open', 'closed');

-- Surveys own their questions inline (jsonb) for simple versioned builder state.
CREATE TABLE public.surveys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status public.survey_status NOT NULL DEFAULT 'draft',
  -- Privacy floor (§12.3): never surface results/subgroups below this many households.
  min_report_threshold integer NOT NULL DEFAULT 4 CHECK (min_report_threshold >= 2),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per household participation. household_label ties a response to a
-- verified household/parcel (participation is tracked, individual identity is not analyzed).
CREATE TABLE public.survey_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  household_label text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, household_label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveys TO authenticated;
GRANT ALL ON public.surveys TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_responses TO authenticated;
GRANT ALL ON public.survey_responses TO service_role;

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage surveys in their communities"
ON public.surveys
FOR ALL
USING (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = surveys.community_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = surveys.community_id AND c.owner_id = auth.uid()));

CREATE POLICY "Owners manage survey responses in their communities"
ON public.survey_responses
FOR ALL
USING (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = survey_responses.community_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = survey_responses.community_id AND c.owner_id = auth.uid()));

CREATE TRIGGER update_surveys_updated_at
BEFORE UPDATE ON public.surveys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
