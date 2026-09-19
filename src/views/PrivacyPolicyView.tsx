import React from 'react';
import { MarketingDocPage } from '../components/landing/MarketingDocPage';
import { PRIVACY_POLICY_TEXT } from '../lib/legalTerms';

// Página pública en /politica-de-privacidad. A diferencia de los Términos y
// Condiciones, este texto no tiene mecanismo de aceptación con hash: es
// información pública sobre qué datos recolectamos, para qué y con quién los
// compartimos (lo que exige el formulario de "Seguridad de los datos" de
// Play Console y la Ley 25.326 de Protección de Datos Personales).
export const PrivacyPolicyView: React.FC = () => (
  <MarketingDocPage title="Política de Privacidad">
    {PRIVACY_POLICY_TEXT.split('\n\n').map((paragraph, i) => (
      <p key={i} className="whitespace-pre-line">
        {paragraph}
      </p>
    ))}
  </MarketingDocPage>
);
