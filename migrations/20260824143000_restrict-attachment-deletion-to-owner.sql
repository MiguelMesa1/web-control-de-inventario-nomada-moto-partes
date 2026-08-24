-- Product documents remain readable by the configured upload-capable team.
-- Destructive access is narrower: uploaders may delete only their own files;
-- inventory administrators retain the explicitly configured global permission.

DROP POLICY IF EXISTS attachments_delete_internal ON public.product_attachments;

CREATE POLICY attachments_delete_internal ON public.product_attachments
  FOR DELETE TO authenticated
  USING (
    public.is_inventory_admin()
    OR (
      public.can_upload_inventory()
      AND uploaded_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS product_documents_delete ON storage.objects;

CREATE POLICY product_documents_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket = 'product-documents'
    AND (
      public.is_inventory_admin()
      OR (
        public.can_upload_inventory()
        AND uploaded_by = (SELECT auth.jwt() ->> 'sub')
      )
    )
  );
