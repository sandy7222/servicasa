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
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm transition-colors"
            >
              {btn.label}
            </a>
          ) : (
            <button
              key={btn.key}
              disabled
              aria-disabled="true"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white/60 font-bold text-sm cursor-not-allowed"
            >
              {btn.label}
              <ComingSoonBadge />
            </button>
          )
        )}
    </div>
  );

  return (
    <section className="py-16 sm:py-20 bg-gradient-to-b from-[#00264d] to-[#001830] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Descargá TecniUrbano y tené todo en tu celular
            </h2>
            <ul className="mt-5 space-y-2.5">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm text-blue-100">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>

            {/* Mobile: sin QR (nadie escanea un QR en el mismo teléfono que lo muestra). */}
            <div className="mt-7 lg:hidden">{storeButtons}</div>

            {/* Desktop: QR + botones de tienda. */}
            <div className="mt-7 hidden lg:flex items-center gap-6">
              <div className="shrink-0 w-32 h-32 rounded-xl bg-white flex flex-col items-center justify-center gap-1.5 text-slate-400">
                {APP_DOWNLOAD_URL ? (
                  <img src={APP_DOWNLOAD_URL} alt="Código QR para descargar la app" className="w-full h-full object-contain p-2" />
                ) : (
                  <>
                    <QrCode className="w-10 h-10" />
                    <span className="text-[10px] font-bold text-slate-400">Muy pronto</span>
                  </>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-sm text-blue-100">Escaneá el código QR con la cámara de tu celular y descargá la app.</p>
                {storeButtons}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <picture>
              <source srcSet={appCelularWebp} type="image/webp" />
              <img
                src={appCelularPng}
                alt="Interfaz de la app de TecniUrbano mostrando un servicio en curso"
                width={480}
                height={640}
                loading="lazy"
                className="w-full max-w-xs h-auto drop-shadow-2xl"
              />
            </picture>
          </div>
        </div>
      </div>
    </section>
  );
};
