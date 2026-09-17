-- Unifica display_order de banners y tarjetas del home del cliente en un
-- solo eje (el admin puede intercalarlos). Las tablas se crearon en el
-- proyecto remoto y no están en el baseline local: este bloque es no-op
-- si no existen, para no romper supabase db start en CI.
DO $$
DECLARE
  banner_max int;
BEGIN
  IF to_regclass('public.customer_home_banners') IS NULL
     OR to_regclass('public.customer_home_cards') IS NULL THEN
    RETURN;
  END IF;
  SELECT COALESCE(MAX(display_order), -1) INTO banner_max FROM public.customer_home_banners;
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY display_order, created_at, id) - 1 AS rn
    FROM public.customer_home_cards
  )
  UPDATE public.customer_home_cards c
  SET display_order = banner_max + 1 + ordered.rn
  FROM ordered
  WHERE c.id = ordered.id;
END $$;
