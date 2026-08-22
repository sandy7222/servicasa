-- FIXED_PRICE_SERVICES (src/lib/pricing.ts) ya ofrece Cerrajería, Refrigeración
-- y Soldadura como rubros con precio fijo, y el formulario de solicitud arma el
-- <select> de "Rubro" a partir de ese catálogo. El enum service_type nunca los
-- tuvo, así que elegirlos rompía el insert con "invalid input value for enum
-- service_type". Se agregan los 3 valores que faltaban.
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'Cerrajería';
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'Refrigeración';
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'Soldadura';
