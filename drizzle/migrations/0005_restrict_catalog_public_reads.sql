DROP POLICY IF EXISTS "Public can read categories" ON public.categories;
DROP POLICY IF EXISTS "Public can read products" ON public.products;
CREATE POLICY "Public can read active categories" ON public.categories FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "Public can read available products" ON public.products FOR SELECT TO anon, authenticated USING (available = true);