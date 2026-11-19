"""
Lake Dolgo's kit (PR 13y), built headless in Blender from numbers: the frozen
lake the ice marathon races round, a ploughed loop with the wind changing
every side. Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/lake/build.py -- [--preview]

Writes public/models/lake.glb and public/models/models.json (the hash of
every art script), and with --preview also art/lake/preview.jpg.

The ploughed ice of the loop, the snow round it and the wind flags stay in
code (src/render/replayScene.ts). These are the pieces the skating replay
stands round the loop (see LAKE_KIT in src/data/replay.ts), each at its own
origin, built along +x (the way the skaters go). Pieces beside the loop face
it across −y here (the loop on their right as you come); the scene puts them
on its left, and turns them round for its right:

- Snowbank: 20 m of the snow the plough threw up beside the loop.
- Broom: a spruce branch stuck in the bank, the old way of marking a skating track on a lake.
- StartBanner: the start and finish, a pole on the outside with a banner out over the loop.
- WarmingHut: a wooden hut on skids with its stovepipe smoking, a bench and two people in winter coats.
- Plough: the little tractor with its blade that keeps the loop clear.
- Crowd: 12 m of people in winter coats standing on the bank, one with a flag.
- Shacks: three ice-fishing shacks on skids, a fisher at a hole between them.
- ShorePines: 40 m of the lake's shore, a snowy bank with pines along it.

The game's axes (three.js): +x along, y up, z to the right. Blender is z-up,
so here x is the same, y is three.js −z (the left) and z is up; the glTF
exporter turns it round. Every piece keeps its daylight colours.

PR 13au polished it with the shared venue blocks (art/venuelib.py): round
people in long coats and knitted hats, board huts with snow on their red
roofs, capped stovepipes and a lit window, a plough with a curved blade and
a beacon, a fisher on a stool with a rod, and spruces dusted on every tier.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

# Import the shared blocks without leaving a __pycache__ folder for the art workflow to commit.
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import venuelib  # noqa: E402
from kitlib import ROOT  # noqa: E402
from venuelib import Mesh, person, run, srgb, wheel  # noqa: E402

OUT = ROOT / "public" / "models" / "lake.glb"
PREVIEW = ROOT / "art" / "lake" / "preview.jpg"

# The ploughed loop: REPLAY_SCENE.roadWidth in src/data/replay.ts.
ROAD = 7.0

venuelib.COLOURS.update({
    "White": "F4F4F2",
    "Snow": "F2F5FA",
    "Snow2": "E6ECF3",
    "Ice": "E2EDF4",
    "Roof": "8C4A3F",
    "Wood": "8A6A50",
    "Wood2": "A3896B",
    "Steel": "5D6873",
    "Glass": "2C3560",
    "Black": "1D242B",
    "Tyre": "1D242B",
    "Bark": "6B5A4E",
    "Pine": "4E6662",
    "Pine2": "5A736D",
    "Coral": "E0695D",
    "Amber": "E3A23B",
    "SignBlue": "2F5BB7",
    "Teal": "2E9E95",
    "Lilac": "A88BE0",
    "Coat1": "4F5BD5",
    "Coat2": "E0695D",
    "Coat3": "E3A23B",
    "Coat4": "2E9E95",
    "Coat5": "6B7680",
    "Skin": "D9A88B",
    "Hat": "C9483C",
    "Smoke": "D7DBE6",
    "Hat2": "2F5BB7",
    "Hat3": "F4F4F2",
    "Window": "F2C66B",
    "Hub": "B9C0C8",
    "Trunk": "6B5A4E",
})


def wobble(k: int, salt: float) -> float:
    """A fixed, even spread in −1..1 for the k-th lump: the same every build."""
    return math.sin(k * 12.9898 + salt * 78.233) * 0.5 + math.sin(k * 4.1414 + salt * 3.7) * 0.5


HATS = ("Hat", "Hat2", "Hat3")


def bundled(m: Mesh, x: float, y: float, coat: str, k: int = 0) -> None:
    """Someone in a long winter coat and a knitted hat, standing, facing the loop (−y)."""
    person(m, x, y, coat, tall=0.96 + 0.04 * (k % 3), coat=True, hat=HATS[k % 3])


def pine(m: Mesh, x: float, y: float, h: float) -> None:
    """A snowy spruce `h` tall: a trunk, three tiers of needles, each tier's top dusted white."""
    m.cone(x, y, 0, h * 0.18, 0.18 * h / 8, 0.14 * h / 8, 5, "Bark")
    for k, (z0, r) in enumerate(((0.15, 0.32), (0.4, 0.25), (0.62, 0.17))):
        m.cone(x, y, h * z0, h * (z0 + 0.2), h * r, h * r * 0.35, 7, "Pine" if k % 2 else "Pine2")
        m.cone(x, y, h * (z0 + 0.2), h * (z0 + 0.32), h * r * 0.35, 0.04, 7, "Snow")
    m.cone(x, y, h * 0.82, h * 1.0, h * 0.07, 0.02, 7, "Snow")


def hut(m: Mesh, x0: float, y0: float, w: float, d: float, h: float, wall: str) -> None:
    """A small hut on skids, `w` along x and `d` deep, its door and a window to −y, a snowy gable roof and a capped stovepipe."""
    for y in (y0 + 0.2, y0 + d - 0.2):
        m.box(x0 - 0.2, x0 + w + 0.2, y - 0.08, y + 0.08, 0, 0.15, "Steel")
        for x in (x0 - 0.2, x0 + w + 0.2):
            m.rod((x, y, 0.15), (x + (0.25 if x > x0 else -0.25), y, 0.4), 0.06, "Steel")
    m.box(x0, x0 + w, y0, y0 + d, 0.15, h, wall)
    # Boards: darker lines along the front.
    for z in (0.15 + (h - 0.15) * f for f in (0.33, 0.66)):
        m.box(x0 - 0.01, x0 + w + 0.01, y0 - 0.01, y0 + d + 0.01, z, z + 0.03, "Wood")
    m.roof(x0 - 0.2, x0 + w + 0.2, y0 - 0.2, y0 + d + 0.2, h, 0.9, "Roof")
    m.roof(x0 - 0.22, x0 + w + 0.22, y0 - 0.12, y0 + d + 0.12, h + 0.12, 0.84, "Snow")
    m.box(x0 + w * 0.35, x0 + w * 0.6, y0 - 0.04, y0, 0.15, h - 0.4, "Wood")
    m.box(x0 + w * 0.55, x0 + w * 0.58, y0 - 0.07, y0 - 0.04, (h - 0.25) / 2, (h - 0.25) / 2 + 0.06, "Steel")
    if w > 3:
        m.box(x0 + w * 0.7, x0 + w * 0.92, y0 - 0.05, y0, h * 0.45, h * 0.8, "White")
        m.box(x0 + w * 0.72, x0 + w * 0.9, y0 - 0.07, y0 - 0.05, h * 0.47, h * 0.78, "Window")
    m.cone(x0 + w * 0.8, y0 + d * 0.6, h, h + 1.3, 0.09, 0.09, 6, "Black")
    m.cone(x0 + w * 0.8, y0 + d * 0.6, h + 1.3, h + 1.45, 0.18, 0.05, 6, "Black")


# --- The lake's pieces.


def snowbank() -> None:
    """20 m of ploughed snow beside the loop, about 2.4 m wide and 0.7 m high, lumpy: its near foot at y = 0."""
    m = Mesh()
    for k in range(6):
        x = 1.7 + k * 3.3
        m.blob(x, 1.2 + wobble(k, 1) * 0.2, 0.0, 2.3, 1.3, 0.55 + wobble(k, 2) * 0.1, "Snow")
    bank = m.done("Snowbank")
    # Smooth shading: soft drifts, not rocks.
    for p in bank.data.polygons:
        p.use_smooth = True


def broom() -> None:
    """A spruce branch stuck upright in the bank: a stick and a small green sprig, about 1.6 m."""
    m = Mesh()
    m.cone(0, 0, 0, 1.0, 0.03, 0.025, 5, "Bark")
    m.cone(0, 0, 0.7, 1.15, 0.3, 0.12, 6, "Pine")
    m.cone(0, 0, 1.1, 1.6, 0.22, 0.02, 6, "Pine2")
    m.done("Broom")


def start_banner() -> None:
    """The start and finish: a pole on the outside (+y) and an arm out over the loop carrying the banner, a chequered strip on the ice below.

    One pole only: the loop starts and finishes on a corner, where a pole on the inside would stand in the next side's ice.
    """
    m = Mesh()
    half = ROAD / 2 + 1.2
    m.cone(0, half, 0, 4.8, 0.12, 0.1, 6, "Steel")
    m.cone(0, half, 0, 0.3, 0.45, 0.35, 8, "Snow")
    m.box(-0.08, 0.08, -ROAD / 2, half, 4.5, 4.7, "Steel")
    m.rod((0, half, 3.6), (0, half - 1.6, 4.5), 0.04, "Steel")
    m.box(-0.06, 0.06, -ROAD / 2 + 0.2, half - 0.4, 3.4, 4.4, "SignBlue")
    m.box(-0.08, 0.08, -ROAD / 2 + 0.6, half - 0.8, 3.55, 4.25, "White")
    for y in (-ROAD / 2 + 0.3, half - 0.5):
        m.rod((0, y, 4.5), (0, y, 4.4), 0.015, "Steel")
    for k in range(int(ROAD / 0.5)):
        y = -ROAD / 2 + k * 0.5
        for j in range(2):
            m.flat(-1.0 + j * 0.5, -0.5 + j * 0.5, y, y + 0.5, 0.02, "Black" if (k + j) % 2 else "White")
    m.done("StartBanner")


def warming_hut() -> None:
    """A wooden hut on skids, its door to the loop (−y), the stovepipe smoking, a bench outside and two people in coats."""
    m = Mesh()
    hut(m, 0, 0, 5, 3.2, 2.6, "Wood2")
    for k in range(3):
        m.blob(4.0 + k * 0.25, 1.9 - k * 0.1, 4.4 + k * 0.6, 0.35 + k * 0.12, 0.35 + k * 0.12, 0.3 + k * 0.1, "Smoke")
    m.box(0.6, 3.0, -1.0, -0.6, 0.4, 0.5, "Wood")
    m.box(0.6, 3.0, -0.62, -0.56, 0.5, 0.9, "Wood")
    for x in (0.7, 2.9):
        m.box(x - 0.05, x + 0.05, -0.95, -0.65, 0, 0.4, "Wood")
    bundled(m, 4.0, -1.4, "Coat1", 0)
    bundled(m, 4.7, -1.1, "Coat3", 1)
    # A table with a big flask of tea and two mugs.
    m.box(5.6, 6.6, -1.3, -0.5, 0.75, 0.82, "Wood")
    for x in (5.7, 6.5):
        m.box(x - 0.04, x + 0.04, -1.25, -0.55, 0, 0.75, "Steel")
    m.cone(6.1, -0.9, 0.82, 1.18, 0.11, 0.11, 8, "Coral")
    m.cone(6.1, -0.9, 1.18, 1.26, 0.07, 0.07, 8, "Black")
    for x in (5.8, 6.4):
        m.cone(x, -1.1, 0.82, 0.92, 0.04, 0.04, 6, "White")
    # Skates hung on the wall by their laces, and a pile of firewood.
    for x in (1.2, 1.5):
        m.box(x - 0.03, x + 0.03, -0.06, -0.02, 1.4, 1.65, "Black")
        m.box(x - 0.12, x + 0.12, -0.08, -0.06, 1.38, 1.4, "Steel")
    for k in range(3):
        m.drum(5.3 + k * 0.05, 1.6, 0.12 + k * 0.2, 0.1, 1.2, 6, "Wood")
        m.drum(5.5 + k * 0.05, 1.6, 0.12 + k * 0.2, 0.1, 1.2, 6, "Wood2")
    m.done("WarmingHut")


def plough() -> None:
    """The little tractor that keeps the loop clear, facing +x: a curved blade raised at the front, an amber beacon on the cab."""
    m = Mesh()
    hood = [(1.3, 0.45), (2.8, 0.45), (2.95, 0.6), (2.95, 1.15), (2.7, 1.35), (1.3, 1.4)]
    m.loft([[(x, -0.55, z) for x, z in hood], [(x, 0.55, z) for x, z in hood]], "Amber", smooth=False)
    m.box(0.0, 1.4, -0.6, 0.6, 0.5, 1.4, "Amber")
    m.box(0.15, 1.35, -0.68, 0.68, 1.4, 2.45, "Glass")
    for x in (0.15, 1.35):
        for y in (-0.68, 0.68):
            m.cone(x, y, 1.4, 2.45, 0.035, 0.035, 4, "Black")
    m.box(0.05, 1.45, -0.75, 0.75, 2.45, 2.56, "Amber")
    m.cone(0.75, 0, 2.56, 2.72, 0.09, 0.09, 8, "Lamp")
    m.cone(1.8, 0.35, 1.35, 2.5, 0.05, 0.05, 6, "Black")
    for x, r, w in ((0.6, 0.6, 0.38), (2.3, 0.42, 0.3)):
        for s in (-1, 1):
            wheel(m, x, s * 0.8, r, w, "Amber", 10)
    # The blade: a curved steel mouldboard on two arms.
    curve = [(3.45 - 0.18 * math.sin(math.pi * t / 4), 0.3 + 0.8 * t / 4) for t in range(5)]
    m.loft([[(x, y, z) for x, z in curve] for y in (-1.6, 1.6)], "Coral", cap_start=False, cap_end=False, smooth=True)
    for s in (-1, 1):
        m.rod((2.9, s * 0.4, 0.6), (3.3, s * 0.4, 0.7), 0.05, "Steel")
    m.done("Plough")


def crowd() -> None:
    """12 m of people in winter coats standing on the bank, facing the loop (−y), one waving a flag."""
    m = Mesh()
    coats = ("Coat1", "Coat2", "Coat3", "Coat4", "Coat5")
    for k in range(8):
        x = 0.7 + k * 1.5 + wobble(k, 4) * 0.2
        bundled(m, x, 1.2 + (k % 2) * 0.6, coats[(k * 3) % 5], k)
    m.cone(6.0, 1.0, 1.2, 3.0, 0.02, 0.02, 5, "Steel")
    m.box(6.0, 6.9, 0.98, 1.02, 2.4, 3.0, "Teal")
    m.done("Crowd")


def shacks() -> None:
    """Three ice-fishing shacks on skids in a loose huddle, a fisher on a stool at a hole between them with a rod."""
    m = Mesh()
    for k, (x, y, wall) in enumerate(((0, 0, "Coral"), (4.2, 1.4, "SignBlue"), (1.6, 4.0, "Amber"))):
        hut(m, x, y, 2.2, 1.8, 2.0 + 0.2 * (k % 2), wall)
    hole = [(3.3 + 0.3 * math.cos(k * math.pi / 4), -1.1 + 0.3 * math.sin(k * math.pi / 4), 0.02) for k in range(8)]
    m.poly(hole, "Glass")
    m.box(2.2, 2.5, -1.25, -0.95, 0.0, 0.4, "Steel")
    with m.at(2.35, -1.1, 0, math.pi / 2):
        person(m, 0, 0, "Coat5", sitting=True, coat=True, hat="Hat")
    m.rod((2.55, -1.3, 0.75), (3.3, -1.1, 0.9), 0.012, "Black")
    m.rod((3.3, -1.1, 0.9), (3.3, -1.1, 0.02), 0.004, "White", 3)
    m.box(1.8, 2.1, -0.6, -0.3, 0, 0.25, "Teal")
    m.done("Shacks")


def shore_pines() -> None:
    """40 m of the lake's shore, its edge along x facing the lake (−y): a low snowy bank and a row of spruces behind it."""
    m = Mesh()
    m.roof(0, 40, 0, 14, 0, 1.4, "Snow2")
    for k in range(9):
        x = 2 + k * 4.4 + wobble(k, 6) * 1.2
        y = 8 + wobble(k, 7) * 3.5
        pine(m, x, y, 9 + wobble(k, 8) * 3.5)
    m.done("ShorePines")


def build() -> None:
    snowbank()
    broom()
    start_banner()
    warming_hut()
    plough()
    crowd()
    shacks()
    shore_pines()


def preview(path: Path) -> None:
    """Lay the pieces round the start of the loop as the replay would, and shoot it from behind a skater."""
    scene = bpy.context.scene
    o = {ob.name: ob for ob in scene.objects}
    half = ROAD / 2

    def plane(name: str, x0: float, x1: float, y0: float, y1: float, z: float, colour: str) -> None:
        bm = bmesh.new()
        bm.faces.new([bm.verts.new(p) for p in ((x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z))])
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        sm = bpy.data.materials.new(name + "Mat")
        sm.use_nodes = True
        sm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb(colour)
        me.materials.append(sm)
        scene.collection.objects.link(bpy.data.objects.new(name, me))

    plane("Lake", -400, 600, -400, 400, 0, "C3D0DA")
    plane("Loop", -60, 400, -half, half, 0.01, "E2EDF4")

    def put(name: str, x: float, y: float, turn: float = 0.0) -> None:
        c = o[name].copy()
        c.location = (x, y, 0)
        c.rotation_euler = (0, 0, turn)
        scene.collection.objects.link(c)

    for k in range(-3, 20):
        put("Snowbank", k * 20, half + 0.5)
        put("Snowbank", k * 20 + 20, -(half + 0.5), math.pi)
        if k % 2 == 0:
            put("Broom", k * 20 + 5, half + 1.2)
            put("Broom", k * 20 + 15, -(half + 1.2))
    o["StartBanner"].location = (0, 0, 0)
    o["WarmingHut"].location = (14, half + 9, 0)
    o["Plough"].location = (24, half + 13, 0)
    o["Crowd"].location = (-16, half + 2.5, 0)
    o["Shacks"].location = (90, -(half + 40), 0)
    put("Shacks", 160, half + 60, 0.6)
    for k in range(12):
        put("ShorePines", 60 + k * 40, 260, 0)
        put("ShorePines", 100 + k * 40, -260, math.pi)
    for n in ("Snowbank", "Broom", "ShorePines"):
        o[n].location = (-5000, 0, 0)
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.device = "CPU"
    scene.render.image_settings.file_format = "JPEG"
    scene.render.resolution_x, scene.render.resolution_y = 960, 600
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = srgb("DDE6F0")
    scene.world = world
    sun = bpy.data.lights.new("Key", "SUN")
    sun.energy = 3.0
    sun_obj = bpy.data.objects.new("Key", sun)
    sun_obj.rotation_euler = (0.7, 0.2, -0.5)
    scene.collection.objects.link(sun_obj)
    cam = bpy.data.cameras.new("Cam")
    cam.angle = math.radians(60)
    cam_obj = bpy.data.objects.new("Cam", cam)
    cam_obj.location = (-14, -1.5, 3.0)
    scene.collection.objects.link(cam_obj)
    cam_obj.rotation_euler = (Vector((30, 4, 1.0)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


run(OUT, PREVIEW, build, preview)
