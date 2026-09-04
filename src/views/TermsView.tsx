import React from 'react';
import { MarketingDocPage } from '../components/landing/MarketingDocPage';

export const TermsView: React.FC = () => (
  <MarketingDocPage title="Términos y condiciones">
    <p>
      Al pedir un servicio en TecniUrbano aceptás estas condiciones. El pedido se confirma recién cuando
      revisás el detalle y lo enviás desde el formulario: el asistente de diagnóstico orienta y arma un
      borrador, pero no contrata el trabajo por sí solo.
    </p>
    <p>
      Los precios publicados en el catálogo aplican a los ítems que elijas. Si el caso requiere diagnóstico
      en el domicilio, te lo informamos antes de confirmar. El pago se hace de forma segura con Mercado Pago
      desde la app o el flujo de checkout.
    </p>
    <p>
      Si el trabajo no queda bien, lo solucionamos sin cargo durante 30 días. Para abrir un reclamo tenés
      hasta 48 horas después de finalizado el servicio; lo cargás y lo seguís desde tu cuenta.
    </p>
    <p>
      Los datos que nos das (incluido el de un pedido o una foto de diagnóstico) se usan para coordinar el
      servicio, la garantía y la atención. Ante cualquier duda, escribinos a{' '}
      <a href="mailto:hola@tecniurbano.online" className="font-semibold text-teal-700 hover:text-teal-600">
        hola@tecniurbano.online
      </a>
      .
    </p>
  </MarketingDocPage>
);
