import React from 'react';
import { MarketingDocPage } from '../components/landing/MarketingDocPage';

export const AboutView: React.FC = () => (
  <MarketingDocPage title="Quiénes somos">
    <p>
      TecniUrbano conecta tu hogar con técnicos de oficios —plomería, electricidad, refrigeración y más—
      para que pidas un servicio, sigas el trabajo en tiempo real y tengas respaldo cuando algo no queda bien.
    </p>
    <p>
      Pedís desde la web o la app, te asignamos un profesional disponible y ves el estado del servicio de
      principio a fin. Si el arreglo no queda como corresponde, lo cubrimos con 30 días de garantía. Y si
      hace falta un reclamo, tenés 48 horas después del trabajo para abrirlo y seguirlo desde la misma
      plataforma.
    </p>
    <p>
      También armamos equipos para empresas: obras, mantenimiento y proyectos que necesitan varios oficios
      coordinados. Escribinos a{' '}
      <a href="mailto:hola@tecniurbano.online" className="font-semibold text-teal-700 hover:text-teal-600">
        hola@tecniurbano.online
      </a>
      .
    </p>
  </MarketingDocPage>
);
