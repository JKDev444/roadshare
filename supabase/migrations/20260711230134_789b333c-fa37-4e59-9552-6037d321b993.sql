CREATE TYPE public.clause_category AS ENUM (
  'maintenance_responsibility','cost_sharing','access_rights','easement',
  'use_restriction','enforcement','dispute_resolution','amendment_process','insurance','other'
);

CREATE TYPE public.clause_status AS ENUM ('proposed','active','superseded','void');

CREATE TABLE public.clauses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  category public.clause_category NOT NULL DEFAULT 'other',
  title text NOT NULL,
  clause_text text NOT NULL DEFAULT '',
  effective_date date,
  status public.clause_status NOT NULL DEFAULT 'active',
  supersedes_id uuid REFERENCES public.clauses(id) ON DELETE SET NULL,
  source text,
  confidence public.confidence_level NOT NULL DEFAULT 'medium',
  verification public.verification_status NOT NULL DEFAULT 'unverified',
  ai_suggested_category public.clause_category,
  ai_summary text,
  ai_confidence numeric,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clauses TO authenticated;
GRANT ALL ON public.clauses TO service_role;

ALTER TABLE public.clauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage clauses in their communities"
ON public.clauses FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = clauses.community_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = clauses.community_id AND c.owner_id = auth.uid()));

CREATE TRIGGER update_clauses_updated_at
BEFORE UPDATE ON public.clauses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_clauses_community ON public.clauses(community_id);
CREATE INDEX idx_clauses_document ON public.clauses(document_id);