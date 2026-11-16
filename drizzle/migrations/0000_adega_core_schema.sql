CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ========== STORE SETTINGS ==========
CREATE TABLE public.store_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name text,
  tagline text,
  whatsapp_number text,
  whatsapp_display text,
  instagram_user text,
  instagram_url text,
  address_text text,
  google_maps_url text,
  origin_cep text NOT NULL DEFAULT '03929-040',
  origin_lat double precision,
  origin_lng double precision,
  raio_maximo_km numeric(6,2) NOT NULL DEFAULT 20,
  limite_km_taxa_fixa numeric(6,2) NOT NULL DEFAULT 5,
  valor_taxa_fixa_cents int NOT NULL DEFAULT 700,
  valor_por_km_adicional_cents int NOT NULL DEFAULT 150,
  accept_pix boolean NOT NULL DEFAULT true,
  accept_card boolean NOT NULL DEFAULT true,
  accept_cash boolean NOT NULL DEFAULT true,
  allow_pickup boolean NOT NULL DEFAULT true,
  pix_test_mode boolean NOT NULL DEFAULT true,
  featured_enabled boolean NOT NULL DEFAULT true,
  store_open boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_settings TO anon, authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read store settings" ON public.store_settings FOR SELECT TO anon, authenticated USING (true);

-- ========== CATEGORIES ==========
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);

-- ========== PRODUCTS ==========
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price_cents int NOT NULL CHECK (price_cents >= 0),
  image_url text,
  featured boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON public.products(category_id);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read products" ON public.products FOR SELECT TO anon, authenticated USING (true);

-- ========== CUSTOMERS ==========
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  name text NOT NULL,
  pin_hash text NOT NULL,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  cashback_cents int NOT NULL DEFAULT 0 CHECK (cashback_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.customer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.customer_sessions TO service_role;
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label text,
  cep text NOT NULL,
  street text NOT NULL,
  number text NOT NULL,
  complement text,
  neighborhood text,
  city text NOT NULL,
  state text NOT NULL,
  reference text,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX addresses_customer_idx ON public.addresses(customer_id);
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

-- ========== COURIERS ==========
CREATE TABLE public.couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plate text,
  whatsapp text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.couriers TO service_role;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

-- ========== ORDERS ==========
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code bigint GENERATED ALWAYS AS IDENTITY (START WITH 1001),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('awaiting_payment','received','preparing','out_for_delivery','ready_for_pickup','delivered','cancelled')),
  fulfillment text NOT NULL DEFAULT 'delivery' CHECK (fulfillment IN ('delivery','pickup')),
  address jsonb,
  distance_km numeric(8,2),
  billed_km int,
  subtotal_cents int NOT NULL,
  delivery_fee_cents int NOT NULL DEFAULT 0,
  cashback_used_cents int NOT NULL DEFAULT 0,
  cashback_earned_cents int NOT NULL DEFAULT 0,
  cashback_credited boolean NOT NULL DEFAULT false,
  cashback_refunded boolean NOT NULL DEFAULT false,
  total_cents int NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('pix','card','cash')),
  card_type text CHECK (card_type IN ('debit','credit')),
  cash_change_for_cents int,
  change_due_cents int NOT NULL DEFAULT 0,
  notes text,
  pix_qr_code text,
  pix_qr_base64 text,
  mp_order_id text,
  paid_at timestamptz,
  courier_id uuid REFERENCES public.couriers(id) ON DELETE SET NULL,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_customer_idx ON public.orders(customer_id, created_at DESC);
CREATE INDEX orders_status_idx ON public.orders(status, created_at DESC);
CREATE INDEX orders_courier_idx ON public.orders(courier_id, delivered_at);
CREATE INDEX orders_mp_idx ON public.orders(mp_order_id);
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid,
  name text NOT NULL,
  unit_price_cents int NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0)
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ========== ADMIN ==========
CREATE TABLE public.admin_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash text NOT NULL,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz
);
GRANT ALL ON public.admin_config TO service_role;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_sessions TO service_role;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- ========== GEOCODE CACHE ==========
CREATE TABLE public.geocode_cache (
  query text PRIMARY KEY,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.geocode_cache TO service_role;
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

-- ========== FUNCTIONS (server only) ==========
CREATE OR REPLACE FUNCTION public.customer_register(p_phone text, p_name text, p_pin text)
RETURNS uuid LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE v_id uuid;
BEGIN
  IF p_pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'invalid_pin'; END IF;
  INSERT INTO public.customers(phone, name, pin_hash)
  VALUES (p_phone, p_name, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.customer_verify_pin(p_phone text, p_pin text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE c public.customers%ROWTYPE; v_attempts int;
BEGIN
  SELECT * INTO c FROM public.customers WHERE phone = p_phone FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF c.locked_until IS NOT NULL AND c.locked_until > now() THEN
    RETURN jsonb_build_object('status','locked','locked_until',c.locked_until);
  END IF;
  IF c.pin_hash = extensions.crypt(p_pin, c.pin_hash) THEN
    UPDATE public.customers SET failed_attempts = 0, locked_until = NULL WHERE id = c.id;
    RETURN jsonb_build_object('status','ok','customer_id',c.id);
  END IF;
  v_attempts := CASE WHEN c.locked_until IS NOT NULL AND c.locked_until <= now() THEN 1 ELSE c.failed_attempts + 1 END;
  IF v_attempts >= 5 THEN
    UPDATE public.customers SET failed_attempts = 0, locked_until = now() + interval '15 minutes' WHERE id = c.id;
    RETURN jsonb_build_object('status','locked','locked_until', now() + interval '15 minutes');
  END IF;
  UPDATE public.customers SET failed_attempts = v_attempts, locked_until = NULL WHERE id = c.id;
  RETURN jsonb_build_object('status','invalid','attempts_left', 5 - v_attempts);
END $$;

CREATE OR REPLACE FUNCTION public.admin_verify_password(p_password text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE a public.admin_config%ROWTYPE; v_attempts int;
BEGIN
  SELECT * INTO a FROM public.admin_config WHERE id = 1 FOR UPDATE;
  IF a.locked_until IS NOT NULL AND a.locked_until > now() THEN
    RETURN jsonb_build_object('status','locked','locked_until',a.locked_until);
  END IF;
  IF a.password_hash = extensions.crypt(p_password, a.password_hash) THEN
    UPDATE public.admin_config SET failed_attempts = 0, locked_until = NULL WHERE id = 1;
    RETURN jsonb_build_object('status','ok');
  END IF;
  v_attempts := a.failed_attempts + 1;
  IF v_attempts >= 5 THEN
    UPDATE public.admin_config SET failed_attempts = 0, locked_until = now() + interval '15 minutes' WHERE id = 1;
    RETURN jsonb_build_object('status','locked','locked_until', now() + interval '15 minutes');
  END IF;
  UPDATE public.admin_config SET failed_attempts = v_attempts WHERE id = 1;
  RETURN jsonb_build_object('status','invalid');
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_password(p_password text)
RETURNS void LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF length(p_password) < 6 THEN RAISE EXCEPTION 'password_too_short'; END IF;
  UPDATE public.admin_config SET password_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 8)) WHERE id = 1;
  DELETE FROM public.admin_sessions;
END $$;

CREATE OR REPLACE FUNCTION public.adjust_cashback(p_customer uuid, p_delta int)
RETURNS int LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_balance int;
BEGIN
  UPDATE public.customers SET cashback_cents = cashback_cents + p_delta
  WHERE id = p_customer AND cashback_cents + p_delta >= 0
  RETURNING cashback_cents INTO v_balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_cashback'; END IF;
  RETURN v_balance;
END $$;

REVOKE ALL ON FUNCTION public.customer_register(text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.customer_verify_pin(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_verify_password(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_password(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.adjust_cashback(uuid,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_register(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.customer_verify_pin(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_verify_password(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_password(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_cashback(uuid,int) TO service_role;

-- ========== SEED ==========
INSERT INTO public.store_settings (id, origin_cep, origin_lat, origin_lng) VALUES (1, '03929-040', -23.6048694, -46.4918971);
INSERT INTO public.admin_config (id, password_hash) VALUES (1, extensions.crypt('adega2026', extensions.gen_salt('bf', 8)));

INSERT INTO public.categories (id, name, position) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Cervejas', 1),
  ('11111111-0000-0000-0000-000000000002', 'Destilados', 2),
  ('11111111-0000-0000-0000-000000000003', 'Combos', 3),
  ('11111111-0000-0000-0000-000000000004', 'Copões', 4),
  ('11111111-0000-0000-0000-000000000005', 'Doses', 5),
  ('11111111-0000-0000-0000-000000000006', 'Energéticos & Refri', 6),
  ('11111111-0000-0000-0000-000000000007', 'Gelo & Acessórios', 7);

INSERT INTO public.products (category_id, name, description, price_cents, image_url, featured, position) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Cerveja Pilsen Lata 350ml', 'Trincando de gelada.', 450, '/images/products/beer-can.jpg', true, 1),
  ('11111111-0000-0000-0000-000000000001', 'Pack 12 Latas Pilsen', '12 latas 350ml geladas.', 4990, '/images/products/beer-pack.jpg', true, 2),
  ('11111111-0000-0000-0000-000000000001', 'Long Neck Premium 330ml', 'Puro malte.', 790, '/images/products/longneck.jpg', false, 3),
  ('11111111-0000-0000-0000-000000000002', 'Whisky 12 Anos 1L', 'Blended escocês envelhecido 12 anos.', 18990, '/images/products/whisky.jpg', true, 1),
  ('11111111-0000-0000-0000-000000000002', 'Vodka Premium 1L', 'Destilada 5 vezes.', 6990, '/images/products/vodka.jpg', false, 2),
  ('11111111-0000-0000-0000-000000000002', 'Gin London Dry 750ml', 'Notas cítricas e zimbro.', 8990, '/images/products/gin.jpg', false, 3),
  ('11111111-0000-0000-0000-000000000003', 'Combo Vodka + 4 Energéticos + Gelo', 'Vodka 1L, 4 energéticos 473ml e gelo 5kg.', 11990, '/images/products/combo.jpg', true, 1),
  ('11111111-0000-0000-0000-000000000003', 'Combo Whisky + 6 Energéticos + Gelo', 'Whisky 1L, 6 energéticos e gelo 5kg.', 22990, '/images/products/combo.jpg', false, 2),
  ('11111111-0000-0000-0000-000000000004', 'Copão Gin Tropical 700ml', 'Gin, energético de frutas tropicais e muito gelo.', 2500, '/images/products/copao.jpg', true, 1),
  ('11111111-0000-0000-0000-000000000004', 'Copão Whisky com Energético 700ml', 'O clássico da quebrada.', 2800, '/images/products/copao.jpg', false, 2),
  ('11111111-0000-0000-0000-000000000005', 'Dose de Whisky 50ml', 'Servida com gelo.', 1200, '/images/products/shot.jpg', false, 1),
  ('11111111-0000-0000-0000-000000000005', 'Dose de Tequila 50ml', 'Com sal e limão.', 1000, '/images/products/shot.jpg', false, 2),
  ('11111111-0000-0000-0000-000000000006', 'Energético 473ml', 'Lata grande gelada.', 1100, '/images/products/energy.jpg', false, 1),
  ('11111111-0000-0000-0000-000000000006', 'Refrigerante Cola 2L', 'Gelado.', 1200, '/images/products/soda.jpg', false, 2),
  ('11111111-0000-0000-0000-000000000007', 'Gelo em Cubos 5kg', 'Saco de gelo filtrado.', 1500, '/images/products/ice.jpg', false, 1),
  ('11111111-0000-0000-0000-000000000007', 'Copo Descartável 700ml (10un)', 'Para seus drinks.', 800, '/images/products/cups.jpg', false, 2);