import React, { useEffect, useState } from 'react';
import { CheckCircle2, QrCode } from 'lucide-react';
import appCelularWebp from '../../assets/landing/app-celular.webp';
import appCelularPng from '../../assets/landing/app-celular.png';
import { APP_DOWNLOAD_URL, GOOGLE_PLAY_URL, APP_STORE_URL } from '../../lib/appLinks';

const BENEFITS = [
  'Solicitá servicios en segundos',
  'Seguí al técnico en tiempo real',
  'Recibí notificaciones',
  '30 días de garantía',
  'Reclamos en 48 hs',
];

type Platform = 'android' | 'ios' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'unknown';
}

const ComingSoonBadge: React.FC = () => (
  <span className="text-[10px] font-bold uppercase tracking-wide bg-white/15 text-white/80 px-2 py-0.5 rounded-full">
    Muy pronto
  </span>
);

export const DownloadAppSection: React.FC = () => {
  const [platform, setPlatform] = useState<Platform>('unknown');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const storeButtons = (
    <div className="flex flex-col sm:flex-row gap-3 w-full">
      {[
        { key: 'android' as const, label: 'Descargar para Android', href: GOOGLE_PLAY_URL },
        { key: 'ios' as const, label: 'Descargar para iPhone', href: APP_STORE_URL },
      ]
        .sort((a) => (a.key === platform ? -1 : 1))
        .map((btn) =>
          btn.href ? (
            <a
              key={btn.key}
              href={btn.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-[#00203d] font-bold text-sm transition-colors duration-200"
            >
              {btn.label}
            </a>
          ) : (
            <button
              key={btn.key}
              disabled
              aria-disabled="true"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white/[0.06] border border-white/15 text-white/50 font-bold text-sm cursor-not-allowed"
            >
              {btn.label}
              <ComingSoonBadge />
            </button>
          )
        )}
    </div>
  );

  return (
    <section className="relative overflow-hidden py-20 sm:py-24 bg-[#001830] text-white">
      {/* Profundidad sutil: la sección no es un azul plano. */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#00284f] via-[#001830] to-[#00121f]"
        aria-hidden="true"
      />
      <div
        className="hidden lg:block absolute top-1/2 right-[8%] -translate-y-1/2 w-[36rem] h-[36rem] rounded-full bg-teal-400/[0.08] blur-3xl"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Descargá TecniUrbano y tené todo en tu celular
            </h2>
            <ul className="mt-6 space-y-3">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-[15px] text-blue-100/90">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" strokeWidth={2} />
                  {b}
                </li>
              ))}
            </ul>

            {/* Mobile: sin QR (nadie escanea un QR en el mismo teléfono que lo muestra). */}
            <div className="mt-8 lg:hidden">{storeButtons}</div>

            {/* Desktop: tarjeta QR deliberadamente diseñada + botones de tienda. */}
            <div className="mt-9 hidden lg:flex items-center gap-6">
              <div className="shrink-0 w-36 h-36 rounded-2xl bg-white p-4 flex flex-col items-center justify-center gap-1.5 text-slate-400 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.4)]">
                {APP_DOWNLOAD_URL ? (
                  <img src={APP_DOWNLOAD_URL} alt="Código QR para descargar la app" className="w-full h-full object-contain" />
                ) : (
                  <>
                    <QrCode className="w-9 h-9" strokeWidth={1.5} />
                    <span className="text-[10px] font-bold text-slate-400 text-center">Muy pronto</span>
                  </>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-sm text-blue-100/80">Escaneá y descargá la app.</p>
                {storeButtons}
              </div>
            </div>
          </div>

          <div className="relative flex justify-center py-4">
            {/* Halo turquesa/azul muy sutil detrás del dispositivo. */}
            <div
              className="absolute w-72 h-72 rounded-full bg-teal-400/10 blur-3xl"
              aria-hidden="true"
            />
            {/*
              El asset viene con fondo blanco casi al ras del dispositivo
              (recortado lo más ajustado posible sin tocar la imagen en sí —
              ver scripts/trim-phone.mjs). Probé máscaras y mix-blend-mode
              para disolver ese blanco contra el azul y ambas se descartaron:
              la máscara deja un halo, y multiply oscurece ilegible la propia
              pantalla de la app. En vez de pelear contra el blanco, se lo
              trata como una superficie deliberada — el teléfono "flota"
              sobre una tarjeta blanca redondeada con sombra suave, en vez de
              un rectángulo pegado sin tratamiento.
            */}
            <div className="relative w-full max-w-[19rem] rounded-[2rem] bg-white p-3 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)]">
              <picture>
                <source srcSet={appCelularWebp} type="image/webp" />
                <img
                  src={appCelularPng}
                  alt="Interfaz de la app de TecniUrbano mostrando un servicio en curso"
                  width={756}
                  height={1414}
                  loading="lazy"
                  className="block w-full h-auto rounded-[1.5rem]"
                />
              </picture>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
