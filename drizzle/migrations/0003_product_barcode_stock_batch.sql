ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode text;
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON public.products (barcode) WHERE barcode IS NOT NULL AND barcode <> '';
CREATE OR REPLACE FUNCTION public.add_stock(p_product uuid, p_qty integer)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.products
     SET stock = COALESCE(stock, 0) + p_qty,
         available = CASE WHEN COALESCE(stock, 0) + p_qty > 0 THEN true ELSE available END
   WHERE id = p_product
  RETURNING stock;
$$;
REVOKE ALL ON FUNCTION public.add_stock(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_stock(uuid, integer) TO service_role;