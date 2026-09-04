CREATE TABLE public.nft_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_wallet text NOT NULL,
  kind text NOT NULL DEFAULT 'collection',
  name text NOT NULL,
  symbol text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  image_path text,
  max_supply integer NOT NULL DEFAULT 1,
  mint_price_eth text NOT NULL DEFAULT '0',
  royalty_bps integer NOT NULL DEFAULT 500,
  attributes jsonb NOT NULL DEFAULT '[]'::jsonb,
  contract_address text,
  chain_id integer NOT NULL DEFAULT 84532,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.nft_projects TO anon, authenticated;
GRANT ALL ON public.nft_projects TO service_role;

ALTER TABLE public.nft_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Projects are publicly viewable"
  ON public.nft_projects FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can create a project"
  ON public.nft_projects FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update a project"
  ON public.nft_projects FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can upload nft assets"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'nft-assets');

CREATE POLICY "Anyone can read nft assets"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'nft-assets');