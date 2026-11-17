DROP POLICY IF EXISTS "Public can read store settings" ON public.store_settings;
REVOKE SELECT ON public.store_settings FROM anon, authenticated;