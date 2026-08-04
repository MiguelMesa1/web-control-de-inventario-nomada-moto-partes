CREATE TABLE public.plastic_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  color TEXT NOT NULL,
  model TEXT,
  warehouse TEXT NOT NULL DEFAULT 'Principal',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT plastic_kits_name_not_blank CHECK (BTRIM(name) <> ''),
  CONSTRAINT plastic_kits_brand_not_blank CHECK (BTRIM(brand) <> ''),
  CONSTRAINT plastic_kits_color_not_blank CHECK (BTRIM(color) <> ''),
  CONSTRAINT plastic_kits_warehouse_not_blank CHECK (BTRIM(warehouse) <> '')
);

CREATE TABLE public.plastic_kit_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES public.plastic_kits(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity_required INTEGER NOT NULL DEFAULT 1
    CHECK (quantity_required >= 1 AND quantity_required <= 999),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT plastic_kit_parts_sku_not_blank CHECK (BTRIM(sku) <> ''),
  CONSTRAINT plastic_kit_parts_name_not_blank CHECK (BTRIM(product_name) <> ''),
  CONSTRAINT plastic_kit_parts_unique_sku UNIQUE (kit_id, sku)
);

CREATE INDEX plastic_kits_active_idx
  ON public.plastic_kits (active, brand, model, name);
CREATE INDEX plastic_kit_parts_kit_idx
  ON public.plastic_kit_parts (kit_id, position);
CREATE INDEX plastic_kit_parts_sku_idx
  ON public.plastic_kit_parts (sku);

CREATE TRIGGER plastic_kits_updated_at
  BEFORE UPDATE ON public.plastic_kits
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.plastic_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plastic_kit_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY plastic_kits_select ON public.plastic_kits
  FOR SELECT TO authenticated
  USING (public.can_read_inventory());

CREATE POLICY plastic_kit_parts_select ON public.plastic_kit_parts
  FOR SELECT TO authenticated
  USING (public.can_read_inventory());

CREATE OR REPLACE FUNCTION public.save_plastic_kit(
  p_id UUID,
  p_name TEXT,
  p_brand TEXT,
  p_color TEXT,
  p_model TEXT,
  p_warehouse TEXT,
  p_active BOOLEAN,
  p_parts JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actor_id UUID := auth.uid();
  saved_id UUID;
  normalized_parts JSONB;
BEGIN
  IF actor_id IS NULL OR NOT public.is_inventory_admin() THEN
    RAISE EXCEPTION 'Only an administrator can manage plastic kits';
  END IF;

  IF NULLIF(BTRIM(p_name), '') IS NULL
    OR NULLIF(BTRIM(p_brand), '') IS NULL
    OR NULLIF(BTRIM(p_color), '') IS NULL
    OR NULLIF(BTRIM(p_warehouse), '') IS NULL THEN
    RAISE EXCEPTION 'Name, brand, color and warehouse are required';
  END IF;

  IF p_parts IS NULL OR JSONB_TYPEOF(p_parts) <> 'array' OR JSONB_ARRAY_LENGTH(p_parts) < 2 THEN
    RAISE EXCEPTION 'A plastic kit must contain at least two parts';
  END IF;

  SELECT JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'sku', BTRIM(part->>'sku'),
      'product_name', BTRIM(part->>'productName'),
      'quantity_required', COALESCE((part->>'quantityRequired')::INTEGER, 1),
      'position', ordinal - 1
    )
    ORDER BY ordinal
  )
  INTO normalized_parts
  FROM JSONB_ARRAY_ELEMENTS(p_parts) WITH ORDINALITY AS items(part, ordinal)
  WHERE NULLIF(BTRIM(part->>'sku'), '') IS NOT NULL
    AND NULLIF(BTRIM(part->>'productName'), '') IS NOT NULL
    AND COALESCE((part->>'quantityRequired')::INTEGER, 1) BETWEEN 1 AND 999;

  IF JSONB_ARRAY_LENGTH(COALESCE(normalized_parts, '[]'::JSONB))
    <> JSONB_ARRAY_LENGTH(p_parts) THEN
    RAISE EXCEPTION 'Every part needs a valid SKU, name and quantity';
  END IF;

  IF (
    SELECT COUNT(DISTINCT part->>'sku')
    FROM JSONB_ARRAY_ELEMENTS(normalized_parts) AS parts(part)
  ) <> JSONB_ARRAY_LENGTH(normalized_parts) THEN
    RAISE EXCEPTION 'The same part cannot be repeated in a kit';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.plastic_kits (
      name, brand, color, model, warehouse, active, created_by, updated_by
    )
    VALUES (
      BTRIM(p_name), BTRIM(p_brand), BTRIM(p_color),
      NULLIF(BTRIM(p_model), ''), BTRIM(p_warehouse),
      COALESCE(p_active, TRUE), actor_id, actor_id
    )
    RETURNING id INTO saved_id;
  ELSE
    UPDATE public.plastic_kits
    SET name = BTRIM(p_name),
        brand = BTRIM(p_brand),
        color = BTRIM(p_color),
        model = NULLIF(BTRIM(p_model), ''),
        warehouse = BTRIM(p_warehouse),
        active = COALESCE(p_active, TRUE),
        updated_by = actor_id
    WHERE id = p_id
    RETURNING id INTO saved_id;

    IF saved_id IS NULL THEN
      RAISE EXCEPTION 'Plastic kit not found';
    END IF;

    DELETE FROM public.plastic_kit_parts WHERE kit_id = saved_id;
  END IF;

  INSERT INTO public.plastic_kit_parts (
    kit_id, sku, product_name, quantity_required, position
  )
  SELECT
    saved_id,
    part->>'sku',
    part->>'product_name',
    (part->>'quantity_required')::INTEGER,
    (part->>'position')::INTEGER
  FROM JSONB_ARRAY_ELEMENTS(normalized_parts) AS parts(part);

  INSERT INTO public.audit_events (
    actor_id, action, entity_type, entity_id, details
  )
  VALUES (
    actor_id,
    CASE WHEN p_id IS NULL THEN 'plastic_kit_created' ELSE 'plastic_kit_updated' END,
    'plastic_kit',
    saved_id::TEXT,
    JSONB_BUILD_OBJECT(
      'name', BTRIM(p_name),
      'brand', BTRIM(p_brand),
      'color', BTRIM(p_color),
      'warehouse', BTRIM(p_warehouse),
      'parts', JSONB_ARRAY_LENGTH(normalized_parts)
    )
  );

  RETURN saved_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_plastic_kit(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actor_id UUID := auth.uid();
  deleted_name TEXT;
BEGIN
  IF actor_id IS NULL OR NOT public.is_inventory_admin() THEN
    RAISE EXCEPTION 'Only an administrator can manage plastic kits';
  END IF;

  DELETE FROM public.plastic_kits
  WHERE id = p_id
  RETURNING name INTO deleted_name;

  IF deleted_name IS NULL THEN
    RAISE EXCEPTION 'Plastic kit not found';
  END IF;

  INSERT INTO public.audit_events (
    actor_id, action, entity_type, entity_id, details
  )
  VALUES (
    actor_id,
    'plastic_kit_deleted',
    'plastic_kit',
    p_id::TEXT,
    JSONB_BUILD_OBJECT('name', deleted_name)
  );
END;
$$;

REVOKE ALL ON public.plastic_kits FROM anon, authenticated;
REVOKE ALL ON public.plastic_kit_parts FROM anon, authenticated;
GRANT SELECT ON public.plastic_kits TO authenticated;
GRANT SELECT ON public.plastic_kit_parts TO authenticated;

REVOKE EXECUTE ON FUNCTION public.save_plastic_kit(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_plastic_kit(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_plastic_kit(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_plastic_kit(UUID)
  TO authenticated;
