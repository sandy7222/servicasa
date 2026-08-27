import { MercadoPagoConfig } from 'mercadopago';

const accessToken = process.env.MP_ACCESS_TOKEN;
if (!accessToken) {
  throw new Error('Falta MP_ACCESS_TOKEN en el entorno del servidor.');
}

// Since MP's late-2025 credentials revamp, both test and production tokens
// use the same APP_USR- prefix — the string itself no longer tells you which
// is which. What determines sandbox vs. live behavior is which section of
// the MP dashboard ("Credenciales de prueba" vs "de producción") the token
// was copied from. There is no separate "test mode" flag on this client.
export const mpClient = new MercadoPagoConfig({ accessToken });
