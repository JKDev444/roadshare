CREATE TABLE public.qa_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL DEFAULT '',
  confidence numeric NOT NULL DEFAULT 0,
  abstained boolean NOT NULL DEFAULT false,
  high_risk boolean NOT NULL DEFAULT false,
  risk_reason text,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_answers TO authenticated;
GRANT ALL ON public.qa_answers TO service_role;

ALTER TABLE public.qa_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage qa answers in their communities"
ON public.qa_answers
FOR ALL
USING (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = qa_answers.community_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = qa_answers.community_id AND c.owner_id = auth.uid()));

CREATE TRIGGER update_qa_answers_updated_at
BEFORE UPDATE ON public.qa_answers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();