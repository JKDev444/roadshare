ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS entrance_x numeric,
  ADD COLUMN IF NOT EXISTS entrance_y numeric;

CREATE TABLE public.project_scenarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_scenarios TO authenticated;
GRANT ALL ON public.project_scenarios TO service_role;
ALTER TABLE public.project_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their project scenarios" ON public.project_scenarios
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX project_scenarios_project_idx ON public.project_scenarios(project_id);

CREATE TRIGGER update_project_scenarios_updated_at BEFORE UPDATE ON public.project_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();