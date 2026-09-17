-- Color de fondo editable y fusión (fade) de la foto con ese fondo.
-- Tablas creadas en remoto: no-op si no existen (CI local).
DO $$
BEGIN
  IF to_regclass('public.customer_home_banners') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.customer_home_banners
    ADD COLUMN IF NOT EXISTS background_color text NOT NULL DEFAULT '#0F172A',
    ADD COLUMN IF NOT EXISTS media_fade integer NOT NULL DEFAULT 70;
  ALTER TABLE public.customer_home_banners
    DROP CONSTRAINT IF EXISTS customer_home_banners_media_fade_check;
  ALTER TABLE public.customer_home_banners
    ADD CONSTRAINT customer_home_banners_media_fade_check CHECK (media_fade >= 0 AND media_fade <= 100);
END $$;
