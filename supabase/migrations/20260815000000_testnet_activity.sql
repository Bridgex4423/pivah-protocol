-- Lightweight testnet activity log. Every meaningful on-chain action a
-- wallet completes gets one row here — this is purely for Pivah's own
-- records (e.g. deciding mainnet token rewards for early testers), it has
-- no effect on how the app functions.
CREATE TABLE public.testnet_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  action text NOT NULL,
  chain_id integer NOT NULL DEFAULT 84532,
  tx_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX testnet_activity_wallet_idx ON public.testnet_activity (wallet);
CREATE INDEX testnet_activity_action_idx ON public.testnet_activity (action);

-- Anyone can log their own activity (self-reported, same trust model as the
-- rest of this app's client-side writes). Only the service role — i.e. Pivah
-- querying via the Supabase dashboard — can read it back. This keeps every
-- wallet's activity private from other users of the anon key while still
-- being fully visible to the project for reward calculations later.
GRANT INSERT ON public.testnet_activity TO anon, authenticated;
GRANT ALL ON public.testnet_activity TO service_role;

ALTER TABLE public.testnet_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log their own activity"
  ON public.testnet_activity FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
