CREATE OR REPLACE FUNCTION public.record_failed_import(
  p_filename TEXT,
  p_source_exported_at TIMESTAMPTZ,
  p_error_code TEXT,
  p_error_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  new_run_id UUID := gen_random_uuid();
BEGIN
  IF NOT public.can_upload_inventory() THEN
    RAISE EXCEPTION 'Uploader permission required';
  END IF;

  IF BTRIM(COALESCE(p_filename, '')) = '' THEN
    RAISE EXCEPTION 'Filename is required';
  END IF;

  INSERT INTO public.import_runs (
    id,
    uploaded_by,
    filename,
    source_exported_at,
    status,
    item_count,
    error_code,
    error_message,
    completed_at
  )
  VALUES (
    new_run_id,
    auth.uid(),
    BTRIM(p_filename),
    p_source_exported_at,
    'failed',
    0,
    LEFT(COALESCE(p_error_code, 'validation_error'), 100),
    LEFT(COALESCE(p_error_message, 'La validación falló.'), 2000),
    NOW()
  );

  INSERT INTO public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    details
  )
  VALUES (
    auth.uid(),
    'inventory_import_failed',
    'import_run',
    new_run_id::TEXT,
    JSONB_BUILD_OBJECT(
      'filename', BTRIM(p_filename),
      'error_code', LEFT(COALESCE(p_error_code, 'validation_error'), 100)
    )
  );

  RETURN new_run_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_failed_import(
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_failed_import(
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TEXT
) TO authenticated;
