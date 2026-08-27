-- Reproduced in the isolated backend: concurrent disjoint 3,000-row uploads
-- both succeeded and left 6,000 current rows. Keep one complete snapshot.
CREATE OR REPLACE FUNCTION public.publish_inventory_snapshot(items jsonb, upload_filename text, upload_checksum text, exported_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  new_run_id UUID := gen_random_uuid();
  new_snapshot_id UUID := gen_random_uuid();
  normalized_count INTEGER;
BEGIN
  IF NOT public.can_upload_inventory() THEN
    RAISE EXCEPTION 'Uploader permission required';
  END IF;

  -- Serialize the date check and full replacement across all app instances.
  -- Otherwise concurrent DELETE/INSERT transactions can mix two snapshots.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.publish_inventory_snapshot', 0)
  );

  IF JSONB_TYPEOF(items) <> 'array' OR JSONB_ARRAY_LENGTH(items) = 0 THEN
    RAISE EXCEPTION 'The inventory payload must contain at least one row';
  END IF;

  IF PG_COLUMN_SIZE(items) > 5242880 THEN
    RAISE EXCEPTION 'The inventory payload exceeds the 5 MB transaction limit';
  END IF;

  IF BTRIM(upload_filename) = '' OR BTRIM(upload_checksum) = '' THEN
    RAISE EXCEPTION 'Filename and checksum are required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inventory_snapshots
    WHERE checksum = upload_checksum
  ) THEN
    RAISE EXCEPTION 'This inventory file has already been published';
  END IF;

  IF exported_at < COALESCE(
    (SELECT MAX(source_exported_at) FROM public.inventory_snapshots),
    '-infinity'::TIMESTAMPTZ
  ) THEN
    RAISE EXCEPTION 'A newer inventory snapshot is already active';
  END IF;

  CREATE TEMP TABLE normalized_inventory (
    sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_line TEXT NOT NULL,
    warehouse TEXT NOT NULL,
    stock NUMERIC(14, 2) NOT NULL,
    reserved NUMERIC(14, 2) NOT NULL,
    available NUMERIC(14, 2) NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO normalized_inventory (
    sku,
    product_name,
    product_line,
    warehouse,
    stock,
    reserved,
    available
  )
  SELECT
    BTRIM(row_data->>'sku'),
    BTRIM(row_data->>'product_name'),
    BTRIM(row_data->>'product_line'),
    BTRIM(row_data->>'warehouse'),
    COALESCE((row_data->>'stock')::NUMERIC, 0),
    COALESCE((row_data->>'reserved')::NUMERIC, 0),
    (row_data->>'available')::NUMERIC
  FROM JSONB_ARRAY_ELEMENTS(items) AS row_data;

  IF EXISTS (
    SELECT 1
    FROM normalized_inventory
    WHERE sku = '' OR product_name = '' OR product_line = '' OR warehouse = ''
  ) THEN
    RAISE EXCEPTION 'Required inventory fields cannot be blank';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM normalized_inventory
    GROUP BY sku, warehouse
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate SKU and warehouse combinations are not allowed';
  END IF;

  SELECT COUNT(*) INTO normalized_count FROM normalized_inventory;

  INSERT INTO public.import_runs (
    id,
    uploaded_by,
    filename,
    checksum,
    source_exported_at,
    status,
    item_count,
    created_at,
    completed_at
  )
  VALUES (
    new_run_id,
    auth.uid(),
    BTRIM(upload_filename),
    BTRIM(upload_checksum),
    exported_at,
    'completed',
    normalized_count,
    NOW(),
    NOW()
  );

  INSERT INTO public.inventory_snapshots (
    id,
    import_run_id,
    uploaded_by,
    filename,
    checksum,
    source_exported_at,
    item_count
  )
  VALUES (
    new_snapshot_id,
    new_run_id,
    auth.uid(),
    BTRIM(upload_filename),
    BTRIM(upload_checksum),
    exported_at,
    normalized_count
  );

  INSERT INTO public.inventory_items (
    snapshot_id,
    sku,
    product_name,
    product_line,
    warehouse,
    stock,
    reserved,
    available,
    recorded_at
  )
  SELECT
    new_snapshot_id,
    sku,
    product_name,
    product_line,
    warehouse,
    stock,
    reserved,
    available,
    exported_at
  FROM normalized_inventory;

  DELETE FROM public.inventory_current;

  INSERT INTO public.inventory_current (
    sku,
    product_name,
    product_line,
    warehouse,
    stock,
    reserved,
    available,
    snapshot_id,
    source_exported_at
  )
  SELECT
    sku,
    product_name,
    product_line,
    warehouse,
    stock,
    reserved,
    available,
    new_snapshot_id,
    exported_at
  FROM normalized_inventory;

  INSERT INTO public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    details
  )
  VALUES (
    auth.uid(),
    'inventory_published',
    'inventory_snapshot',
    new_snapshot_id::TEXT,
    JSONB_BUILD_OBJECT(
      'filename', BTRIM(upload_filename),
      'items', normalized_count,
      'exported_at', exported_at
    )
  );

  RETURN new_snapshot_id;
END;
$function$
;
