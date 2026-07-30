CREATE TABLE public.reorder_line_settings (
  product_line TEXT PRIMARY KEY,
  reorder_point NUMERIC(14, 2) NOT NULL
    CHECK (reorder_point >= 0 AND reorder_point <= 1000000),
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reorder_line_settings_line_not_blank CHECK (BTRIM(product_line) <> '')
);

CREATE TRIGGER reorder_line_settings_updated_at
  BEFORE UPDATE ON public.reorder_line_settings
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.reorder_line_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY reorder_line_settings_select ON public.reorder_line_settings
  FOR SELECT TO authenticated
  USING (public.can_read_inventory());

CREATE POLICY reorder_line_settings_admin_insert ON public.reorder_line_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_inventory_admin()
    AND updated_by = (SELECT auth.uid())
  );

CREATE POLICY reorder_line_settings_admin_update ON public.reorder_line_settings
  FOR UPDATE TO authenticated
  USING (public.is_inventory_admin())
  WITH CHECK (
    public.is_inventory_admin()
    AND updated_by = (SELECT auth.uid())
  );

CREATE POLICY reorder_line_settings_admin_delete ON public.reorder_line_settings
  FOR DELETE TO authenticated
  USING (public.is_inventory_admin());

REVOKE ALL ON public.reorder_line_settings FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.reorder_line_settings TO authenticated;
GRANT UPDATE (reorder_point, updated_by) ON public.reorder_line_settings TO authenticated;
