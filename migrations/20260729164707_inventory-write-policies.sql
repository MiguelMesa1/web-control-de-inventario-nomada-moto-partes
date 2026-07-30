CREATE POLICY profiles_admin_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_inventory_admin()
    AND is_primary = FALSE
  );

CREATE POLICY audit_internal_insert ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_upload_inventory()
    AND actor_id = auth.uid()
  );

GRANT INSERT (id, email, display_name, role, active, is_primary)
  ON public.profiles TO authenticated;
GRANT INSERT ON public.audit_events TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_app_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_read_inventory() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_upload_inventory() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_inventory_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protect_primary_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_primary_admin(TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.publish_inventory_snapshot(JSONB, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_inventory_history()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_inventory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_inventory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_inventory_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_primary_admin(TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_inventory_snapshot(JSONB, TEXT, TEXT, TIMESTAMPTZ)
  TO authenticated;
