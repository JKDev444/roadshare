
CREATE TABLE public.onboarding_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  stage text,
  stage_index int NOT NULL DEFAULT 0,
  progress int NOT NULL DEFAULT 0,
  filenames text[] NOT NULL DEFAULT '{}',
  document_paths text[] NOT NULL DEFAULT '{}',
  result jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT onboarding_jobs_status_check CHECK (status IN ('queued','uploading','processing','succeeded','failed','cancelled'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_jobs TO authenticated;
GRANT ALL ON public.onboarding_jobs TO service_role;

ALTER TABLE public.onboarding_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own onboarding jobs"
  ON public.onboarding_jobs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX onboarding_jobs_user_active_idx
  ON public.onboarding_jobs (user_id, updated_at DESC)
  WHERE status IN ('queued','uploading','processing');

CREATE TRIGGER onboarding_jobs_set_updated_at
  BEFORE UPDATE ON public.onboarding_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
