"""
The replays' ground detail (PR 13az) and the tunnel's walls and floor (PR 13ba): ambientCG's CC0 colour maps turned into
soft greyscale multipliers, so they shade the venue's own colour instead of
replacing it.

    python3 scripts/make-ground.py <folder with the unzipped 1K-JPG downloads>

Needs Pillow and numpy. Download each id below from
https://ambientcg.com/view?id=<id> (1K-JPG) and unzip it into its own folder
named after the id. Writes public/tex/<kind>.jpg (512 x 512). Credits in CREDITS.md.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

# kind: (ambientCG id, contrast). Every texture averages 0.88, a touch darker than the flat colour.
GROUND = {
    "grass": ("Grass004", 0.10),
    "asphalt": ("Asphalt031", 0.09),
    "snow": ("Snow006", 0.06),
    # The tunnel (PR 13ba): plaster on the walls, smooth concrete on the floor.
    "wall": ("Plaster001", 0.025),
    "floor": ("Concrete034", 0.04),
}
MEAN, SIZE = 0.88, 512
OUT = Path(__file__).resolve().parent.parent / "public" / "tex"

src = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
for kind, (asset, contrast) in GROUND.items():
    img = Image.open(src / asset / f"{asset}_1K-JPG_Color.jpg").convert("L")
    if img.size[0] == 2 * img.size[1]:
        # A 2:1 texture: two copies stacked make a square that still tiles.
        half = img.resize((SIZE, SIZE // 2), Image.LANCZOS)
        img = Image.new("L", (SIZE, SIZE))
        img.paste(half, (0, 0))
        img.paste(half, (0, SIZE // 2))
    else:
        img = img.resize((SIZE, SIZE), Image.LANCZOS)
    a = np.asarray(img).astype(float) / 255
    a = np.clip((a - a.mean()) / a.std() * contrast + MEAN, 0, 1)
    Image.fromarray((a * 255).round().astype("uint8")).save(OUT / f"{kind}.jpg", quality=80, optimize=True)
    print(kind, (OUT / f"{kind}.jpg").stat().st_size // 1024, "KiB")
