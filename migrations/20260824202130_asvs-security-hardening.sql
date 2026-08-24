-- OWASP ASVS 5.0 hardening for security telemetry, durable throttling and
-- append-only audit integrity. System-owned HTTP extension ACLs cannot be
-- changed by project_admin and are tracked with InsForge feedback
-- 95e0a4d6-6867-421c-a72d-71f6cf1ea388.

DROP POLICY IF EXISTS audit_internal_insert ON public.audit_events;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_events FROM anon, authenticated;

CREATE TABLE public.security_rate_limits (
  key_hash text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT security_rate_limits_key_hash CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT security_rate_limits_attempts CHECK (attempts >= 0)
);

ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_rate_limits FROM PUBLIC, anon, authenticated;
CREATE INDEX security_rate_limits_updated_at_idx
  ON public.security_rate_limits (updated_at);

CREATE OR REPLACE FUNCTION public.consume_security_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  current_attempts integer;
  current_window timestamptz;
  current_time timestamptz := clock_timestamp();
BEGIN
  IF p_key_hash !~ '^[a-f0-9]{64}$'
     OR p_limit < 1 OR p_limit > 10000
     OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid rate limit parameters';
  END IF;

  INSERT INTO public.security_rate_limits AS limits (
    key_hash,
    attempts,
    window_started_at,
    updated_at
  )
  VALUES (p_key_hash, 1, current_time, current_time)
  ON CONFLICT (key_hash) DO UPDATE
  SET attempts = CASE
        WHEN limits.window_started_at <= current_time - make_interval(secs => p_window_seconds)
          THEN 1
        ELSE limits.attempts + 1
      END,
      window_started_at = CASE
        WHEN limits.window_started_at <= current_time - make_interval(secs => p_window_seconds)
          THEN current_time
        ELSE limits.window_started_at
      END,
      updated_at = current_time
  RETURNING attempts, window_started_at
  INTO current_attempts, current_window;

  RETURN QUERY SELECT
    current_attempts <= p_limit,
    greatest(0, p_limit - current_attempts),
    CASE
      WHEN current_attempts <= p_limit THEN 0
      ELSE greatest(
        1,
        ceil(extract(epoch FROM (
          current_window + make_interval(secs => p_window_seconds) - current_time
        )))::integer
      )
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_security_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;

CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  outcome text NOT NULL,
  actor_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_hash text NULL,
  ip_hash text NULL,
  request_path text NULL,
  request_method text NULL,
  status_code integer NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT security_events_event_type_length CHECK (char_length(event_type) BETWEEN 1 AND 80),
  CONSTRAINT security_events_outcome CHECK (outcome IN ('success', 'failure', 'blocked', 'error')),
  CONSTRAINT security_events_subject_hash CHECK (subject_hash IS NULL OR subject_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT security_events_ip_hash CHECK (ip_hash IS NULL OR ip_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT security_events_path_length CHECK (request_path IS NULL OR char_length(request_path) <= 300),
  CONSTRAINT security_events_method_length CHECK (request_method IS NULL OR char_length(request_method) <= 12),
  CONSTRAINT security_events_status_code CHECK (status_code IS NULL OR status_code BETWEEN 100 AND 599),
  CONSTRAINT security_events_details_size CHECK (octet_length(details::text) <= 8192)
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_events FROM PUBLIC, anon, authenticated;
CREATE INDEX security_events_created_at_idx ON public.security_events (created_at DESC);
CREATE INDEX security_events_actor_created_idx ON public.security_events (actor_id, created_at DESC);
CREATE INDEX security_events_type_created_idx ON public.security_events (event_type, created_at DESC);
