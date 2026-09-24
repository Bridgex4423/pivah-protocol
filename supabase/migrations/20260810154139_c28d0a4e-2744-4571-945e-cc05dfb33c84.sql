CREATE TABLE public.nft_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.nft_projects(id) on delete cascade,
  token_id integer not null,
  image_path text,
  attributes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, token_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nft_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.nft_tokens TO anon;
GRANT ALL ON public.nft_tokens TO service_role;

ALTER TABLE public.nft_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tokens are publicly viewable" ON public.nft_tokens FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can create a token" ON public.nft_tokens FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update a token" ON public.nft_tokens FOR UPDATE TO anon, authenticated USING (true);

CREATE INDEX nft_tokens_project_idx ON public.nft_tokens (project_id, token_id);