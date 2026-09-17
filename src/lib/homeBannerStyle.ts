export const DEFAULT_BANNER_BACKGROUND = '#0F172A';
export const DEFAULT_BANNER_MEDIA_FADE = 70;

export const BANNER_BACKGROUND_PRESETS: { label: string; value: string }[] = [
  { label: 'Oscuro', value: '#0F172A' },
  { label: 'Blanco', value: '#F8FAFC' },
  { label: 'Celeste', value: '#E8F4F8' },
  { label: 'Teal', value: '#134E4A' },
];

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

export function normalizeBannerBackground(hex?: string | null): string {
  return parseHex(hex ?? '') ? hex!.trim() : DEFAULT_BANNER_BACKGROUND;
}

export function clampBannerMediaFade(value?: number | null): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_BANNER_MEDIA_FADE;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function isLightBannerBackground(hex?: string | null): boolean {
  const rgb = parseHex(normalizeBannerBackground(hex));
  if (!rgb) return false;
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b > 165;
}

/** Degradé que funde la foto con el color de fondo del banner (efecto del boceto). */
export function bannerMediaFadeGradient(hex: string, fade: number, axis: 'right' | 'bottom'): string {
  const rgb = parseHex(normalizeBannerBackground(hex)) ?? { r: 15, g: 23, b: 42 };
  const strength = clampBannerMediaFade(fade);
  if (strength <= 0) return 'none';
  const opaqueEnd = strength * 0.4;
  const clearAt = 20 + strength * 0.55;
  const dir = axis === 'right' ? 'to right' : 'to bottom';
  return `linear-gradient(${dir}, rgb(${rgb.r},${rgb.g},${rgb.b}) 0%, rgba(${rgb.r},${rgb.g},${rgb.b},1) ${opaqueEnd}%, rgba(${rgb.r},${rgb.g},${rgb.b},0) ${clearAt}%)`;
}
