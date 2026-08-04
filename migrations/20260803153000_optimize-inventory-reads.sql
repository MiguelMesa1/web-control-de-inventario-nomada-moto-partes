CREATE INDEX IF NOT EXISTS inventory_items_history_page_idx
  ON public.inventory_items (recorded_at, snapshot_id, sku, warehouse)
  INCLUDE (product_line, available);

CREATE INDEX IF NOT EXISTS inventory_current_browse_idx
  ON public.inventory_current (product_line, product_name, sku, warehouse)
  INCLUDE (
    stock,
    reserved,
    available,
    snapshot_id,
    source_exported_at
  );
