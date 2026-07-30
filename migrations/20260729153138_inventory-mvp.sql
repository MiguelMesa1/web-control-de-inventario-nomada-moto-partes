CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reader'
    CHECK (role IN ('admin', 'reader', 'uploader', 'blocked')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX profiles_single_primary_idx
  ON public.profiles (is_primary)
  WHERE is_primary = TRUE;

CREATE TABLE public.inventory_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5
    CHECK (low_stock_threshold >= 0 AND low_stock_threshold <= 1000000),
  retention_days INTEGER NOT NULL DEFAULT 90
    CHECK (retention_days BETWEEN 30 AND 3650),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.inventory_settings (id) VALUES (TRUE);

CREATE TABLE public.import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  filename TEXT NOT NULL,
  checksum TEXT,
  source_exported_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE public.inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id UUID NOT NULL UNIQUE REFERENCES public.import_runs(id) ON DELETE RESTRICT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  filename TEXT NOT NULL,
  checksum TEXT NOT NULL UNIQUE,
  source_exported_at TIMESTAMPTZ NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.inventory_snapshots(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_line TEXT NOT NULL,
  warehouse TEXT NOT NULL,
  stock NUMERIC(14, 2) NOT NULL DEFAULT 0,
  reserved NUMERIC(14, 2) NOT NULL DEFAULT 0,
  available NUMERIC(14, 2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT inventory_items_sku_not_blank CHECK (BTRIM(sku) <> ''),
  CONSTRAINT inventory_items_name_not_blank CHECK (BTRIM(product_name) <> ''),
  CONSTRAINT inventory_items_line_not_blank CHECK (BTRIM(product_line) <> ''),
  CONSTRAINT inventory_items_warehouse_not_blank CHECK (BTRIM(warehouse) <> ''),
  UNIQUE (snapshot_id, sku, warehouse)
);

CREATE TABLE public.inventory_current (
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_line TEXT NOT NULL,
  warehouse TEXT NOT NULL,
  stock NUMERIC(14, 2) NOT NULL DEFAULT 0,
  reserved NUMERIC(14, 2) NOT NULL DEFAULT 0,
  available NUMERIC(14, 2) NOT NULL,
  snapshot_id UUID NOT NULL REFERENCES public.inventory_snapshots(id) ON DELETE RESTRICT,
  source_exported_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sku, warehouse)
);

CREATE TABLE public.product_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL
    CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 15728640),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX import_runs_created_at_idx ON public.import_runs (created_at DESC);
CREATE INDEX import_runs_uploaded_by_idx ON public.import_runs (uploaded_by);
CREATE INDEX snapshots_exported_at_idx
  ON public.inventory_snapshots (source_exported_at DESC);
CREATE INDEX snapshots_uploaded_by_idx ON public.inventory_snapshots (uploaded_by);
CREATE INDEX inventory_items_snapshot_idx ON public.inventory_items (snapshot_id);
CREATE INDEX inventory_items_sku_idx ON public.inventory_items (sku);
CREATE INDEX inventory_items_line_idx ON public.inventory_items (product_line);
CREATE INDEX inventory_items_recorded_at_idx
  ON public.inventory_items (recorded_at DESC);
CREATE INDEX inventory_current_line_idx ON public.inventory_current (product_line);
CREATE INDEX inventory_current_available_idx ON public.inventory_current (available);
CREATE INDEX attachments_sku_idx ON public.product_attachments (sku);
CREATE INDEX attachments_uploaded_by_idx ON public.product_attachments (uploaded_by);
CREATE INDEX audit_events_actor_idx ON public.audit_events (actor_id);
CREATE INDEX audit_events_created_at_idx ON public.audit_events (created_at DESC);

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT CASE
    WHEN p.active THEN p.role
    ELSE 'blocked'
  END
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_read_inventory()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(public.current_app_role() IN ('admin', 'reader', 'uploader'), FALSE)
$$;

CREATE OR REPLACE FUNCTION public.can_upload_inventory()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(public.current_app_role() IN ('admin', 'uploader'), FALSE)
$$;

CREATE OR REPLACE FUNCTION public.is_inventory_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(public.current_app_role() = 'admin', FALSE)
$$;

CREATE OR REPLACE FUNCTION public.protect_primary_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_primary THEN
    RAISE EXCEPTION 'The primary administrator cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_primary AND (
    NEW.is_primary IS NOT TRUE OR
    NEW.role <> 'admin' OR
    NEW.active IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'The primary administrator cannot be blocked or downgraded';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_primary
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_primary_admin();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER inventory_settings_updated_at
  BEFORE UPDATE ON public.inventory_settings
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE OR REPLACE FUNCTION public.bootstrap_primary_admin(
  admin_email TEXT,
  admin_name TEXT
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  created_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE is_primary = TRUE) THEN
    RAISE EXCEPTION 'A primary administrator already exists';
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    role,
    active,
    is_primary
  )
  VALUES (
    auth.uid(),
    LOWER(BTRIM(admin_email)),
    BTRIM(admin_name),
    'admin',
    TRUE,
    TRUE
  )
  RETURNING * INTO created_profile;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id)
  VALUES (auth.uid(), 'primary_admin_bootstrapped', 'profile', auth.uid()::TEXT);

  RETURN created_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_inventory_snapshot(
  items JSONB,
  upload_filename TEXT,
  upload_checksum TEXT,
  exported_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  new_run_id UUID := gen_random_uuid();
  new_snapshot_id UUID := gen_random_uuid();
  normalized_count INTEGER;
BEGIN
  IF NOT public.can_upload_inventory() THEN
    RAISE EXCEPTION 'Uploader permission required';
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.cleanup_inventory_history()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
  days_to_keep INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_inventory_admin() THEN
    RAISE EXCEPTION 'Administrator permission required';
  END IF;

  SELECT retention_days INTO days_to_keep
  FROM public.inventory_settings
  WHERE id = TRUE;

  DELETE FROM public.inventory_snapshots
  WHERE created_at < NOW() - MAKE_INTERVAL(days => days_to_keep)
    AND id NOT IN (SELECT DISTINCT snapshot_id FROM public.inventory_current);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_current ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_inventory_admin());

CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_inventory_admin())
  WITH CHECK (public.is_inventory_admin());

CREATE POLICY settings_select ON public.inventory_settings
  FOR SELECT TO authenticated
  USING (public.can_read_inventory());

CREATE POLICY settings_admin_update ON public.inventory_settings
  FOR UPDATE TO authenticated
  USING (public.is_inventory_admin())
  WITH CHECK (public.is_inventory_admin());

CREATE POLICY import_runs_select ON public.import_runs
  FOR SELECT TO authenticated
  USING (public.can_read_inventory());

CREATE POLICY snapshots_select ON public.inventory_snapshots
  FOR SELECT TO authenticated
  USING (public.can_read_inventory());

CREATE POLICY inventory_items_select ON public.inventory_items
  FOR SELECT TO authenticated
  USING (public.can_read_inventory());

CREATE POLICY inventory_current_select ON public.inventory_current
  FOR SELECT TO authenticated
  USING (public.can_read_inventory());

CREATE POLICY attachments_select_internal ON public.product_attachments
  FOR SELECT TO authenticated
  USING (public.can_upload_inventory());

CREATE POLICY attachments_insert_internal ON public.product_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_upload_inventory() AND
    uploaded_by = (SELECT auth.uid())
  );

CREATE POLICY attachments_delete_internal ON public.product_attachments
  FOR DELETE TO authenticated
  USING (public.can_upload_inventory());

CREATE POLICY audit_admin_select ON public.audit_events
  FOR SELECT TO authenticated
  USING (public.is_inventory_admin());

GRANT USAGE ON SCHEMA public TO authenticated;

REVOKE ALL ON public.profiles FROM anon, authenticated;
REVOKE ALL ON public.inventory_settings FROM anon, authenticated;
REVOKE ALL ON public.import_runs FROM anon, authenticated;
REVOKE ALL ON public.inventory_snapshots FROM anon, authenticated;
REVOKE ALL ON public.inventory_items FROM anon, authenticated;
REVOKE ALL ON public.inventory_current FROM anon, authenticated;
REVOKE ALL ON public.product_attachments FROM anon, authenticated;
REVOKE ALL ON public.audit_events FROM anon, authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, role, active, last_login_at) ON public.profiles TO authenticated;
GRANT SELECT, UPDATE (low_stock_threshold, retention_days, updated_by)
  ON public.inventory_settings TO authenticated;
GRANT SELECT ON public.import_runs TO authenticated;
GRANT SELECT ON public.inventory_snapshots TO authenticated;
GRANT SELECT ON public.inventory_items TO authenticated;
GRANT SELECT ON public.inventory_current TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.product_attachments TO authenticated;
GRANT SELECT ON public.audit_events TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_inventory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_inventory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_inventory_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_primary_admin(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_inventory_snapshot(JSONB, TEXT, TEXT, TIMESTAMPTZ)
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_inventory_history() FROM PUBLIC, authenticated;
