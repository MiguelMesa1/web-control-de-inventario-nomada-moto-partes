CREATE OR REPLACE FUNCTION public.prevent_duplicate_active_purchase_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  target_status TEXT;
BEGIN
  SELECT status
  INTO target_status
  FROM public.purchase_orders
  WHERE id = NEW.order_id;

  IF target_status NOT IN ('draft', 'ordered') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.sku, 0));

  IF EXISTS (
    SELECT 1
    FROM public.purchase_order_items AS item
    JOIN public.purchase_orders AS purchase_order
      ON purchase_order.id = item.order_id
    WHERE item.sku = NEW.sku
      AND item.order_id <> NEW.order_id
      AND purchase_order.status IN ('draft', 'ordered')
  ) THEN
    RAISE EXCEPTION 'La referencia % ya tiene un pedido pendiente', NEW.sku
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS purchase_order_items_prevent_active_duplicate
  ON public.purchase_order_items;

CREATE TRIGGER purchase_order_items_prevent_active_duplicate
  BEFORE INSERT OR UPDATE OF sku, order_id
  ON public.purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_active_purchase_item();

REVOKE ALL ON FUNCTION public.prevent_duplicate_active_purchase_item()
  FROM PUBLIC, anon, authenticated;
