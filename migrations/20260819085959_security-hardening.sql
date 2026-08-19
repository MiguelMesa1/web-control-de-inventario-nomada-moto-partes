-- Defense in depth: API routes validate and normalize input first; these
-- constraints also protect the database from direct SDK/RPC writes.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_length CHECK (char_length(email) BETWEEN 3 AND 254) NOT VALID,
  ADD CONSTRAINT profiles_display_name_length CHECK (char_length(display_name) BETWEEN 1 AND 120) NOT VALID;

ALTER TABLE public.import_runs
  ADD CONSTRAINT import_runs_filename_length CHECK (char_length(filename) BETWEEN 1 AND 255) NOT VALID,
  ADD CONSTRAINT import_runs_checksum_length CHECK (checksum IS NULL OR char_length(checksum) <= 128) NOT VALID,
  ADD CONSTRAINT import_runs_error_code_length CHECK (error_code IS NULL OR char_length(error_code) <= 80) NOT VALID,
  ADD CONSTRAINT import_runs_error_message_length CHECK (error_message IS NULL OR char_length(error_message) <= 2000) NOT VALID;

ALTER TABLE public.inventory_snapshots
  ADD CONSTRAINT inventory_snapshots_filename_length CHECK (char_length(filename) BETWEEN 1 AND 255) NOT VALID,
  ADD CONSTRAINT inventory_snapshots_checksum_length CHECK (char_length(checksum) BETWEEN 1 AND 128) NOT VALID;

ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_text_lengths CHECK (
    char_length(sku) <= 120 AND char_length(product_name) <= 300
    AND char_length(product_line) <= 120 AND char_length(warehouse) <= 120
  ) NOT VALID,
  ADD CONSTRAINT inventory_items_quantity_bounds CHECK (
    stock BETWEEN -999999999 AND 999999999
    AND reserved BETWEEN -999999999 AND 999999999
    AND available BETWEEN -999999999 AND 999999999
  ) NOT VALID;

ALTER TABLE public.inventory_current
  ADD CONSTRAINT inventory_current_text_lengths CHECK (
    char_length(sku) <= 120 AND char_length(product_name) <= 300
    AND char_length(product_line) <= 120 AND char_length(warehouse) <= 120
  ) NOT VALID,
  ADD CONSTRAINT inventory_current_quantity_bounds CHECK (
    stock BETWEEN -999999999 AND 999999999
    AND reserved BETWEEN -999999999 AND 999999999
    AND available BETWEEN -999999999 AND 999999999
  ) NOT VALID;

ALTER TABLE public.product_attachments
  ADD CONSTRAINT product_attachments_text_lengths CHECK (
    char_length(sku) BETWEEN 1 AND 120
    AND char_length(file_name) BETWEEN 1 AND 180
    AND char_length(file_key) BETWEEN 1 AND 500
    AND char_length(file_url) BETWEEN 1 AND 2048
  ) NOT VALID;

ALTER TABLE public.reorder_watchlist
  ADD CONSTRAINT reorder_watchlist_text_lengths CHECK (
    char_length(sku) <= 120 AND char_length(product_name) <= 300
    AND (primary_supplier IS NULL OR char_length(primary_supplier) <= 180)
    AND (secondary_supplier IS NULL OR char_length(secondary_supplier) <= 180)
    AND (notes IS NULL OR char_length(notes) <= 2000)
  ) NOT VALID,
  ADD CONSTRAINT reorder_watchlist_stock_bounds CHECK (
    minimum_stock BETWEEN 0 AND 999999
    AND maximum_stock BETWEEN minimum_stock AND 999999
  ) NOT VALID;

ALTER TABLE public.reorder_line_settings
  ADD CONSTRAINT reorder_line_settings_text_length CHECK (char_length(product_line) <= 120) NOT VALID;

ALTER TABLE public.plastic_kits
  ADD CONSTRAINT plastic_kits_text_lengths CHECK (
    char_length(name) <= 120 AND char_length(brand) <= 120
    AND char_length(color) <= 120 AND (model IS NULL OR char_length(model) <= 120)
    AND char_length(warehouse) <= 120
  ) NOT VALID;

ALTER TABLE public.plastic_kit_parts
  ADD CONSTRAINT plastic_kit_parts_text_lengths CHECK (
    char_length(sku) <= 120 AND char_length(product_name) <= 300
  ) NOT VALID;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_text_lengths CHECK (
    char_length(supplier_name) <= 180 AND (notes IS NULL OR char_length(notes) <= 2000)
  ) NOT VALID;

ALTER TABLE public.purchase_order_items
  ADD CONSTRAINT purchase_order_items_text_lengths CHECK (
    char_length(sku) <= 120 AND char_length(product_name) <= 300
  ) NOT VALID,
  ADD CONSTRAINT purchase_order_items_stock_bounds CHECK (
    available_at_creation BETWEEN -999999 AND 999999
    AND minimum_stock BETWEEN 0 AND 999999
    AND maximum_stock BETWEEN minimum_stock AND 999999
  ) NOT VALID;

ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_email_length;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_display_name_length;
ALTER TABLE public.import_runs VALIDATE CONSTRAINT import_runs_filename_length;
ALTER TABLE public.import_runs VALIDATE CONSTRAINT import_runs_checksum_length;
ALTER TABLE public.import_runs VALIDATE CONSTRAINT import_runs_error_code_length;
ALTER TABLE public.import_runs VALIDATE CONSTRAINT import_runs_error_message_length;
ALTER TABLE public.inventory_snapshots VALIDATE CONSTRAINT inventory_snapshots_filename_length;
ALTER TABLE public.inventory_snapshots VALIDATE CONSTRAINT inventory_snapshots_checksum_length;
ALTER TABLE public.inventory_items VALIDATE CONSTRAINT inventory_items_text_lengths;
ALTER TABLE public.inventory_items VALIDATE CONSTRAINT inventory_items_quantity_bounds;
ALTER TABLE public.inventory_current VALIDATE CONSTRAINT inventory_current_text_lengths;
ALTER TABLE public.inventory_current VALIDATE CONSTRAINT inventory_current_quantity_bounds;
ALTER TABLE public.product_attachments VALIDATE CONSTRAINT product_attachments_text_lengths;
ALTER TABLE public.reorder_watchlist VALIDATE CONSTRAINT reorder_watchlist_text_lengths;
ALTER TABLE public.reorder_watchlist VALIDATE CONSTRAINT reorder_watchlist_stock_bounds;
ALTER TABLE public.reorder_line_settings VALIDATE CONSTRAINT reorder_line_settings_text_length;
ALTER TABLE public.plastic_kits VALIDATE CONSTRAINT plastic_kits_text_lengths;
ALTER TABLE public.plastic_kit_parts VALIDATE CONSTRAINT plastic_kit_parts_text_lengths;
ALTER TABLE public.purchase_orders VALIDATE CONSTRAINT purchase_orders_text_lengths;
ALTER TABLE public.purchase_order_items VALIDATE CONSTRAINT purchase_order_items_text_lengths;
ALTER TABLE public.purchase_order_items VALIDATE CONSTRAINT purchase_order_items_stock_bounds;

-- Private product documents are team-shared only between upload-capable roles.
-- Other buckets remain denied by default for end-user credentials.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_documents_select ON storage.objects;
DROP POLICY IF EXISTS product_documents_insert ON storage.objects;
DROP POLICY IF EXISTS product_documents_delete ON storage.objects;

CREATE POLICY product_documents_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket = 'product-documents' AND public.can_upload_inventory());

CREATE POLICY product_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket = 'product-documents'
    AND public.can_upload_inventory()
    AND uploaded_by = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY product_documents_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket = 'product-documents' AND public.can_upload_inventory());

GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;
REVOKE UPDATE ON storage.objects FROM authenticated;
