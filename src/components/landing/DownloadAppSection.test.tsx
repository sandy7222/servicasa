import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DownloadAppSection } from './DownloadAppSection';

const setUserAgent = (ua: string) => vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);

describe('DownloadAppSection — iPhone', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('ya no dice "Muy pronto" para iPhone: ofrece instalar la web desde Safari', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120');
    render(<DownloadAppSection />);
    expect(screen.getAllByText('Instalar en iPhone').length).toBeGreaterThan(0);
    expect(screen.queryByText('Descargar para iPhone')).toBeNull();
  });

  it('en una compu la guía empieza cerrada y se abre al tocar el botón', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120');
    render(<DownloadAppSection />);
    expect(screen.queryByText('Cómo instalarla en tu iPhone')).toBeNull();
    fireEvent.click(screen.getAllByText('Instalar en iPhone')[0]);
    expect(screen.getAllByText('Cómo instalarla en tu iPhone').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Agregar a pantalla de inicio/).length).toBeGreaterThan(0);
  });

  it('en un iPhone la guía ya aparece abierta', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1');
    render(<DownloadAppSection />);
    expect(screen.getAllByText('Cómo instalarla en tu iPhone').length).toBeGreaterThan(0);
  });

  it('el botón de Android sigue apuntando al APK', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/120');
    render(<DownloadAppSection />);
    const link = screen.getAllByText('Descargar para Android')[0].closest('a');
    expect(link?.getAttribute('href')).toContain('tecniurbano.apk');
  });
});
