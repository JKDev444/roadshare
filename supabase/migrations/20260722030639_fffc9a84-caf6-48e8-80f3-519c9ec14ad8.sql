-- Drop all obsolete domain tables (v2 nuke & rebuild)
DROP TABLE IF EXISTS public.clauses CASCADE;
DROP TABLE IF EXISTS public.decision_votes CASCADE;
DROP TABLE IF EXISTS public.decisions CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.onboarding_jobs CASCADE;
DROP TABLE IF EXISTS public.onboarding_state CASCADE;
DROP TABLE IF EXISTS public.parcels CASCADE;
DROP TABLE IF EXISTS public.project_allocations CASCADE;
DROP TABLE IF EXISTS public.project_line_items CASCADE;
DROP TABLE IF EXISTS public.project_scenarios CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.qa_answers CASCADE;
DROP TABLE IF EXISTS public.record_events CASCADE;
DROP TABLE IF EXISTS public.road_segments CASCADE;
DROP TABLE IF EXISTS public.survey_responses CASCADE;
DROP TABLE IF EXISTS public.surveys CASCADE;
DROP TABLE IF EXISTS public.communities CASCADE;

-- One road per user; entire planner state lives in JSON.
CREATE TABLE public.roads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roads TO authenticated;
GRANT ALL ON public.roads TO service_role;

ALTER TABLE public.roads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own road"
  ON public.roads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_roads_updated_at
  BEFORE UPDATE ON public.roads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();