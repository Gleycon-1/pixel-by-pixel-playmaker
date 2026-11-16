ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock integer;
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS store_mode text NOT NULL DEFAULT 'auto' CHECK (store_mode IN ('open','closed','auto')),
  ADD COLUMN IF NOT EXISTS open_time text NOT NULL DEFAULT '10:00',
  ADD COLUMN IF NOT EXISTS close_time text NOT NULL DEFAULT '02:00',
  ADD COLUMN IF NOT EXISTS eta_minutes integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS cashback_percent numeric NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS free_delivery_min_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS eta_minutes integer;

CREATE OR REPLACE FUNCTION public.decrement_stock(p_product uuid, p_qty integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products
     SET stock = GREATEST(stock - p_qty, 0),
         available = CASE WHEN stock - p_qty <= 0 THEN false ELSE available END
   WHERE id = p_product AND stock IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.decrement_stock(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) TO service_role;