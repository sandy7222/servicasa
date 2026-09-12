import React from 'react';
import { MarketingDocPage } from '../components/landing/MarketingDocPage';
import { TERMS_CLIENTE_TEXT } from '../lib/legalTerms';

// Página pública en /terminos_y_condiciones/cliente (ver plan-terminos-y-condiciones.md).
// El texto viene de src/lib/legalTerms.ts — es la misma constante que se
// hashea al aceptar en el formulario de registro, así que este componente
// no debe reformatear ni agregar contenido propio más allá de partir el
// texto en párrafos: lo que se muestra acá tiene que ser exactamente lo que
// se hasheó.
export const TermsClienteView: React.FC = () => (
  <MarketingDocPage title="Términos y Condiciones para Clientes">
    {TERMS_CLIENTE_TEXT.split('\n\n').map((paragraph, i) => (
      <p key={i} className="whitespace-pre-line">
        {paragraph}
      </p>
    ))}
  </MarketingDocPage>
);
