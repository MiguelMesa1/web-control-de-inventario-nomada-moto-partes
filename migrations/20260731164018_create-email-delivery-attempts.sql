CREATE TABLE public.email_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES public.inventory_snapshots(id) ON DELETE SET NULL,
  attempted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  alert_count INTEGER NOT NULL DEFAULT 0 CHECK (alert_count >= 0),
  suggested_units NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (suggested_units >= 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  provider_message_id TEXT,
  provider_response TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX email_delivery_attempts_created_at_idx
  ON public.email_delivery_attempts (created_at DESC);
CREATE INDEX email_delivery_attempts_snapshot_idx
  ON public.email_delivery_attempts (snapshot_id)
  WHERE snapshot_id IS NOT NULL;

ALTER TABLE public.email_delivery_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_delivery_attempts_admin_select
  ON public.email_delivery_attempts
  FOR SELECT TO authenticated
  USING (public.is_inventory_admin());

REVOKE ALL ON public.email_delivery_attempts FROM anon, authenticated;
GRANT SELECT ON public.email_delivery_attempts TO authenticated;
