"""Builds the avatar thumbnails published with the page: one 96 px JPEG per included avatar and a sprite sheet of
64 px tiles for the online gallery (index order; avatars whose thumbnail couldn't be downloaded are left out).
usage: python3 -I tools/make_thumbs.py DOWNLOAD_DIR   (DOWNLOAD_DIR holds t0, t1, ... raw thumbnails; the featured
avatars' raw thumbnails go in assets/avatars as NAME.thumb, which are not kept in the repository)"""
import json, os, sys
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1]
idx = json.load(open(os.path.join(root, 'src/avatar/vrm/avatar-index.json')))
out = os.path.join(root, 'assets/avatars')
def square(im, n):
    im = im.convert('RGBA'); bg = Image.new('RGBA', im.size, (42, 42, 42, 255)); bg.alpha_composite(im); im = bg.convert('RGB')
    w, h = im.size; s = min(w, h); im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    return im.resize((n, n), Image.LANCZOS)
for f in os.listdir(out):
    if f.endswith('.thumb'):
        try: square(Image.open(os.path.join(out, f)), 96).save(os.path.join(out, f[:-6] + '.jpg'), quality=82)
        except Exception as e: print('skip', f, e)
T, COLS = 64, 24
have = []
tiles = []
for i in range(len(idx['avatars'])):
    p = os.path.join(src, 't%d' % i)
    try:
        im = Image.open(p); im.seek(0); tiles.append(square(im, T)); have.append(i)
    except Exception: pass
rows = (len(tiles) + COLS - 1) // COLS
sheet = Image.new('RGB', (COLS * T, max(1, rows) * T), (42, 42, 42))
for k, im in enumerate(tiles): sheet.paste(im, ((k % COLS) * T, (k // COLS) * T))
sheet.save(os.path.join(out, 'thumbs.jpg'), quality=78, optimize=True)
json.dump({'file': 'avatars/thumbs.jpg', 'tile': T, 'cols': COLS, 'have': have}, open(os.path.join(root, 'src/ui/avatar-thumbs.json'), 'w'), separators=(',', ':'))
print(len(have), 'of', len(idx['avatars']), 'thumbnails;', os.path.getsize(os.path.join(out, 'thumbs.jpg')) // 1024, 'kB sheet')
