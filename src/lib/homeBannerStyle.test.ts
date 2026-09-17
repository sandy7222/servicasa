import { describe, expect, it } from 'vitest';
import {
  bannerMediaFadeGradient,
  clampBannerMediaFade,
  isLightBannerBackground,
  normalizeBannerBackground,
} from './homeBannerStyle';

describe('homeBannerStyle', () => {
  it('normaliza un hex inválido al fondo oscuro por defecto', () => {
    expect(normalizeBannerBackground('rojo')).toBe('#0F172A');
    expect(normalizeBannerBackground('#F8FAFC')).toBe('#F8FAFC');
  });

  it('acota la fusión entre 0 y 100', () => {
    expect(clampBannerMediaFade(-10)).toBe(0);
    expect(clampBannerMediaFade(140)).toBe(100);
    expect(clampBannerMediaFade(undefined)).toBe(70);
  });

  it('detecta fondos claros para invertir el color del texto', () => {
    expect(isLightBannerBackground('#F8FAFC')).toBe(true);
    expect(isLightBannerBackground('#0F172A')).toBe(false);
  });

  it('no pinta degradé cuando la fusión está en 0', () => {
    expect(bannerMediaFadeGradient('#0F172A', 0, 'right')).toBe('none');
    expect(bannerMediaFadeGradient('#0F172A', 70, 'right')).toContain('linear-gradient(to right');
  });
});
