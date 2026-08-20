import { MercadoPagoConfig } from 'mercadopago';

const accessToken = process.env.MP_ACCESS_TOKEN;
if (!accessToken) {
  throw new Error('Falta MP_ACCESS_TOKEN en el entorno del servidor.');
}

// TEST- prefixed tokens automatically operate in Mercado Pago's sandbox —
// there is no separate "test mode" flag to set beyond using a TEST- token.
export const mpClient = new MercadoPagoConfig({ accessToken });
