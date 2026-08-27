-- The permission check is independent of inventory rows. An initplan evaluates
-- the same STABLE helper once per statement, keeping the existing role policy.
ALTER POLICY inventory_current_select ON public.inventory_current
  USING ((SELECT public.can_read_inventory()));

ALTER POLICY inventory_items_select ON public.inventory_items
  USING ((SELECT public.can_read_inventory()));
