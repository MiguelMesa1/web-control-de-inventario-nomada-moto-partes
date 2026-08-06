CREATE OR REPLACE FUNCTION public.save_plastic_kit(
  p_id UUID,
  p_name TEXT,
  p_brand TEXT,
  p_color TEXT,
  p_has_headlight BOOLEAN,
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

  IF p_parts IS NULL
    OR JSONB_TYPEOF(p_parts) <> 'array'
    OR JSONB_ARRAY_LENGTH(p_parts) < 1 THEN
    RAISE EXCEPTION 'A plastic kit must contain at least one part';
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
      name, brand, color, has_headlight, model, warehouse, active,
      created_by, updated_by
    )
    VALUES (
      BTRIM(p_name), BTRIM(p_brand), BTRIM(p_color), p_has_headlight,
      NULLIF(BTRIM(p_model), ''), BTRIM(p_warehouse),
      COALESCE(p_active, TRUE), actor_id, actor_id
    )
    RETURNING id INTO saved_id;
  ELSE
    UPDATE public.plastic_kits
    SET name = BTRIM(p_name),
        brand = BTRIM(p_brand),
        color = BTRIM(p_color),
        has_headlight = p_has_headlight,
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
    CASE
      WHEN p_id IS NULL THEN 'plastic_kit_created'
      ELSE 'plastic_kit_updated'
    END,
    'plastic_kit',
    saved_id::TEXT,
    JSONB_BUILD_OBJECT(
      'name', BTRIM(p_name),
      'brand', BTRIM(p_brand),
      'color', BTRIM(p_color),
      'hasHeadlight', p_has_headlight,
      'warehouse', BTRIM(p_warehouse),
      'parts', JSONB_ARRAY_LENGTH(normalized_parts)
    )
  );

  RETURN saved_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_plastic_kit(
  UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, BOOLEAN, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_plastic_kit(
  UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, BOOLEAN, JSONB
) TO authenticated;
