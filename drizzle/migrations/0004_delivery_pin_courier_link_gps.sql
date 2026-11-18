ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS require_delivery_pin boolean NOT NULL DEFAULT false;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS access_token text NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex');
CREATE UNIQUE INDEX IF NOT EXISTS couriers_access_token_unique ON public.couriers (access_token);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gps_tracking boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_lat double precision;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_lng double precision;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_location_at timestamptz;