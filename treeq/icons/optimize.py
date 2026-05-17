"""
Run from anywhere:
  python "C:/Users/camer/Projects/Claude Cowork/TreeQ/treeq/icons/optimize.py"

Converts every PNG under treeq/icons/ to WebP (quality 80, 512x512, RGBA).
Deletes the original PNG after conversion. Skips existing .webp files.
"""

from PIL import Image
import numpy as np
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
TARGET_SIZE = (128, 128)
WEBP_QUALITY = 20

def remove_black_background(img, threshold=30):
    """Make near-black pixels transparent."""
    img = img.convert('RGBA')
    data = np.array(img)
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    black_mask = (r < threshold) & (g < threshold) & (b < threshold)
    data[:,:,3] = np.where(black_mask, 0, a)
    return Image.fromarray(data)

total_before = total_after = count = skipped = 0

for dirpath, _, filenames in os.walk(ROOT):
    for fname in filenames:
        if not fname.lower().endswith('.png'):
            continue
        src = os.path.join(dirpath, fname)
        dst = os.path.splitext(src)[0] + '.webp'
        if os.path.exists(dst):
            skipped += 1
            continue
        before = os.path.getsize(src)
        try:
            img = Image.open(src)
            img = remove_black_background(img)
            img = img.resize(TARGET_SIZE, Image.LANCZOS)
            img.save(dst, 'WEBP', quality=WEBP_QUALITY, method=6)
            after = os.path.getsize(dst)
            os.remove(src)
            rel = os.path.relpath(dst, ROOT)
            print(f'{rel}: {before/1024:.0f} KB -> {after/1024:.1f} KB ({(1-after/before)*100:.0f}% smaller)')
            total_before += before
            total_after += after
            count += 1
        except Exception as e:
            print(f'ERROR {fname}: {e}')

print(f'\n{count} converted, {skipped} skipped (webp already exists)')
if count:
    print(f'Total: {total_before/1024:.0f} KB -> {total_after/1024:.1f} KB ({(1-total_after/total_before)*100:.0f}% smaller)')
