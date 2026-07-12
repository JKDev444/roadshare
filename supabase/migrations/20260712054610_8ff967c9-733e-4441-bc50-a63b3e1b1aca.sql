CREATE TABLE public.onboarding_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wizard_completed boolean NOT NULL DEFAULT false,
  wizard_skipped boolean NOT NULL DEFAULT false,
  checklist_dismissed boolean NOT NULL DEFAULT false,
  report_generated boolean NOT NULL DEFAULT false,
  dismissed_hints text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_state TO authenticated;
GRANT ALL ON public.onboarding_state TO service_role;

ALTER TABLE public.onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own onboarding state"
  ON public.onboarding_state
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_onboarding_state_updated_at
  BEFORE UPDATE ON public.onboarding_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();