-- Return one point per snapshot/line instead of every SKU in 90 days.
-- SECURITY INVOKER preserves the caller's grants and row-level policies.
CREATE OR REPLACE FUNCTION public.inventory_analytics_trend()
RETURNS TABLE(snapshot_id uuid, recorded_at timestamptz, product_line text, available numeric)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT i.snapshot_id, i.recorded_at, i.product_line, sum(i.available)
  FROM public.inventory_items i
  WHERE i.recorded_at >= now() - interval '90 days'
  GROUP BY i.snapshot_id, i.recorded_at, i.product_line
  ORDER BY i.recorded_at, i.snapshot_id, i.product_line
$$;

REVOKE ALL ON FUNCTION public.inventory_analytics_trend() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_analytics_trend() TO authenticated;
