from PIL import Image
import numpy as np, os, shutil

SRC = r'C:\Users\camer\Projects\Claude Cowork\TreeQ\treeq\icons\Service Tiles'
DST = r'C:\Users\camer\Projects\Claude Cowork\TreeQ\treeq\deploy\public\icons'
SIZE = (128, 128)
QUALITY = 20

def remove_black_bg(img, threshold=30):
    img = img.convert('RGBA')
    data = np.array(img)
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    data[:,:,3] = np.where((r < threshold) & (g < threshold) & (b < threshold), 0, a)
    return Image.fromarray(data)

# Copy already-converted stump-grinding.webp
src_stump = os.path.join(SRC, 'stump-grinding.webp')
dst_stump = os.path.join(DST, 'stump-grinding.webp')
shutil.copy2(src_stump, dst_stump)
kb = os.path.getsize(dst_stump) / 1024
print(f'stump-grinding.webp  -> copied ({kb:.1f} KB)')

for fname in sorted(os.listdir(SRC)):
    if not fname.lower().endswith('.png'):
        continue
    src = os.path.join(SRC, fname)
    out_name = os.path.splitext(fname)[0] + '.webp'
    dst = os.path.join(DST, out_name)
    before = os.path.getsize(src)
    img = Image.open(src)
    img = remove_black_bg(img)
    img = img.resize(SIZE, Image.LANCZOS)
    img.save(dst, 'WEBP', quality=QUALITY, method=6)
    after = os.path.getsize(dst)
    print(f'{fname:35s} -> {out_name:30s}  {before//1024} KB -> {after/1024:.1f} KB')
