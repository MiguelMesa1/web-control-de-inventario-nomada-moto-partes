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
  v_attempts integer;
  v_window_started_at timestamptz;
  v_now timestamptz := clock_timestamp();
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
  VALUES (p_key_hash, 1, v_now, v_now)
  ON CONFLICT (key_hash) DO UPDATE
  SET attempts = CASE
        WHEN limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
          THEN 1
        ELSE limits.attempts + 1
      END,
      window_started_at = CASE
        WHEN limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
          THEN v_now
        ELSE limits.window_started_at
      END,
      updated_at = v_now
  RETURNING attempts, window_started_at
  INTO v_attempts, v_window_started_at;

  RETURN QUERY SELECT
    v_attempts <= p_limit,
    greatest(0, p_limit - v_attempts),
    CASE
      WHEN v_attempts <= p_limit THEN 0
      ELSE greatest(
        1,
        ceil(extract(epoch FROM (
          v_window_started_at + make_interval(secs => p_window_seconds) - v_now
        )))::integer
      )
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_security_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
