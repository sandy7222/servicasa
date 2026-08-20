"""One-off script to generate PWA icons from the TecniUrbano logo.
Crops the house glyph (excludes the wordmark, illegible at icon sizes) and
renders it centered on light and dark backgrounds for the manifest icons,
maskable icon, and apple-touch-icon.
"""
from PIL import Image

SRC = 'src/assets/logo-tecniurbano.png'
OUT_DIR = 'public/icons'

BG_LIGHT = (248, 250, 252, 255)  # slate-50, matches app background
BG_DARK = (15, 23, 42, 255)      # #0F172A, matches header/nav

im = Image.open(SRC).convert('RGBA')
# Tight crop around the house/wrench glyph only (excludes "TecniUrbano" wordmark below it)
glyph = im.crop((300, 168, 957, 849))

def render(size, bg, padding_ratio):
    canvas = Image.new('RGBA', (size, size), bg)
    inner = int(size * (1 - 2 * padding_ratio))
    gw, gh = glyph.size
    scale = inner / max(gw, gh)
    resized = glyph.resize((int(gw * scale), int(gh * scale)), Image.LANCZOS)
    x = (size - resized.width) // 2
    y = (size - resized.height) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas

# Standard "any" purpose icons: transparent-safe padding, light bg for consistency
render(192, BG_LIGHT, 0.08).save(f'{OUT_DIR}/icon-192.png')
render(512, BG_LIGHT, 0.08).save(f'{OUT_DIR}/icon-512.png')

# Maskable icon: OS crops to a circle/rounded-square, so keep glyph within the ~80% safe zone
render(512, BG_LIGHT, 0.14).save(f'{OUT_DIR}/icon-512-maskable.png')

# Apple touch icon: iOS renders transparency as black, must be fully opaque; dark bg matches header
render(180, BG_DARK, 0.14).convert('RGB').save(f'{OUT_DIR}/apple-touch-icon.png')

# Favicon-quality small icon (replaces the full logo+wordmark currently used at 16-32px)
render(64, BG_LIGHT, 0.06).save(f'{OUT_DIR}/favicon.png')

print('done')
