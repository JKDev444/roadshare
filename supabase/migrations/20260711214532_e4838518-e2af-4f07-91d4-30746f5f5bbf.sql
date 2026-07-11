CREATE TYPE public.doc_type AS ENUM ('deed','plat','agreement','amendment','bylaws','bid','invoice','correspondence','other');
CREATE TYPE public.doc_status AS ENUM ('processing','needs_review','verified','rejected');

CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  status public.doc_status NOT NULL DEFAULT 'processing',
  doc_type public.doc_type,
  ai_suggested_type public.doc_type,
  ai_summary text,
  ai_confidence numeric,
  extracted_text text,
  source text,
  effective_date date,
  notes text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their documents" ON public.documents
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX documents_community_idx ON public.documents(community_id);

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage access: owners can manage files under their own top-level folder (auth.uid()).
CREATE POLICY "Owners read own documents storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners upload own documents storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners update own documents storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners delete own documents storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);