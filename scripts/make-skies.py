"""
The replays' skies (PR 13az): Poly Haven's CC0 "pure sky" HDRIs, tone-mapped
in Blender to small equirectangular JPEGs the game can load on a phone.

    ~/blender/blender --background --factory-startup --python scripts/make-skies.py -- <folder of .hdr files>

The HDRIs themselves are not committed (each 4k file is about 18 MB). Fetch
the 4k .hdr for each id below from https://polyhaven.com/a/<id> into one
folder, then run this. It writes public/sky/<id>.jpg (4096 x 2048) and prints
each sky's horizon colour, which goes in src/data/skies.ts as the fog colour,
so the far ground fades into the sky instead of meeting it at a line.

Credits for every sky are in CREDITS.md.
"""

from __future__ import annotations

import sys
from pathlib import Path

import bpy
import numpy as np

# id: (exposure, AgX look). Daylight skies keep their own brightness; the
# dusk ones are darker and punchier, for the phone's dark mode.
SKIES = {
    "kloofendal_48d_partly_cloudy_puresky": (0.0, "None"),
    "autumn_field_puresky": (0.0, "None"),
    "kloofendal_43d_clear_puresky": (0.0, "None"),
    "overcast_soil_puresky": (0.0, "None"),
    "kloppenheim_06_puresky": (-2.5, "AgX - Punchy"),
    "evening_road_01_puresky": (-2.0, "AgX - Punchy"),
}
WIDTH, HEIGHT = 4096, 2048
QUALITY = 78
OUT = Path(__file__).resolve().parent.parent / "public" / "sky"


def to_srgb(v: float) -> float:
    return 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055


def horizon(path: Path) -> str:
    """The mean colour of a thin band just above the horizon, as #rrggbb."""
    img = bpy.data.images.load(str(path))
    w, h = img.size
    px = np.array(img.pixels[:]).reshape(h, w, 4)  # rows bottom-up, linear
    mid = h // 2
    band = px[mid + 2 : mid + 2 + max(2, h // 60), :, :3].reshape(-1, 3).mean(0)
    bpy.data.images.remove(img)
    return "#" + "".join("%02x" % round(255 * min(1.0, max(0.0, to_srgb(float(c))))) for c in band)


def main() -> None:
    src = Path(sys.argv[sys.argv.index("--") + 1])
    OUT.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.view_settings.view_transform = "AgX"
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = QUALITY
    for sky_id, (exposure, look) in SKIES.items():
        scene.view_settings.exposure = exposure
        scene.view_settings.look = look
        img = bpy.data.images.load(str(src / f"{sky_id}.hdr"))
        img.scale(WIDTH, HEIGHT)
        out = OUT / f"{sky_id}.jpg"
        img.save_render(str(out), scene=scene)
        bpy.data.images.remove(img)
        print(f"SKY {sky_id} horizon {horizon(out)} {out.stat().st_size // 1024} KiB")


main()
