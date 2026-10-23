"""CDaily programme artwork; never modifies the approved Conclavia parent mark.

Input: official Bricolage Grotesque variable TTF (OFL, kept beside exported font).
Requires fontTools. Emits outlined lettering, independent of browser fonts.
"""
import argparse
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

p = argparse.ArgumentParser()
p.add_argument('--font', required=True)
p.add_argument('--out', default='public/brand')
p.add_argument('--proofs')
a = p.parse_args()
font = instantiateVariableFont(TTFont(a.font), {'opsz': 96, 'wdth': 95, 'wght': 720})
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
units = font['head'].unitsPerEm

def lettering(text, size, ink, spacing=-.8):
    scale, x, parts = size / units, 0, []
    for char in text:
        glyph = glyphs[cmap[ord(char)]]
        pen = SVGPathPen(glyphs)
        glyph.draw(pen)
        parts.append(f'<path transform="translate({x:.3f} 0)" d="{pen.getCommands()}"/>')
        x += glyph.width * scale + spacing
    return f'<g fill="{ink}" transform="translate(0 82) scale({scale:.6f} {-scale:.6f})">' + ''.join(
        part.replace(f'translate({pos:.3f} 0)', f'translate({pos/scale:.3f} 0)')
        for part, pos in zip(parts, [sum((glyphs[cmap[ord(c)]].width*scale+spacing) for c in text[:i]) for i in range(len(text))])
    ) + '</g>', x

def artwork(variant, white=False):
    ink, accent = ('#ffffff', '#b6c8ff') if white else ('#182f3b', '#305bd2')
    if variant == 'open-c':
        letters, width = lettering('daily', 106, ink, -1.2)
        symbol = f'<path d="M71 18C59 7 39 7 25 16C9 26 7 48 17 63C28 80 55 85 76 68" fill="none" stroke="{ink}" stroke-width="14"/>'
        symbol += f'<path d="M17 96H66" fill="none" stroke="{accent}" stroke-width="5"/>'
        content, width = symbol + '<g transform="translate(94 0)">' + letters + '</g>', 94 + width + 5
    elif variant == 'type':
        letters, width = lettering('CDaily', 108, ink, -1.8)
        content = letters + f'<circle cx="{width+8:.3f}" cy="77" r="5" fill="{accent}"/>'
        width += 19
    else:
        letters, width = lettering('CDAILY', 101, ink, -1.2)
        content = letters + f'<path d="M2 97H48" stroke="{accent}" stroke-width="5"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.3f} 108" role="img" aria-label="CDaily"><title>CDaily</title>{content}</svg>\n'

out = Path(a.out)
out.mkdir(parents=True, exist_ok=True)
for white, name in [(False, 'cdaily.svg'), (True, 'cdaily-white.svg')]:
    (out / name).write_text(artwork('open-c', white))
if a.proofs:
    proof = Path(a.proofs)
    proof.mkdir(parents=True, exist_ok=True)
    for name in ['open-c', 'type', 'caps']:
        (proof / (name + '.svg')).write_text(artwork(name))
print('Outlined programme wordmark and variants exported; parent brand untouched.')
