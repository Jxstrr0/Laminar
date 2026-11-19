"""
The ski-jump hill's buildings (PR 13l), built headless in Blender from
numbers. Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/skijump/build.py -- [--preview]

Writes public/models/skijump.glb and public/models/models.json (the hash of
every art script), and with --preview also art/skijump/preview.jpg.

The hill itself stays in code: its landing slope is worked out by the sim for
each hill (src/sim/jumper.ts hillSurface), so a model of it would go stale.
These are the pieces that stand on it or beside it, each at its own origin,
for src/render/jumpScene.ts to place on whichever hill is in use:

- Inrun: the deck down the in-run, with two ice tracks (one for each lane
  the replay draws) and side walls, its origin at its foot, running back
  along −x. The scene tilts it to the in-run's angle.
- Table: the same deck for the take-off table, its origin at the edge, with
  the red lip.
- StartHouse: the cabin over the top of the in-run.
- JudgesTower, CoachStand, LightMast, Grandstand: beside the slope on the far
  side, each standing on its origin, facing the slope.
- FencePanel: one 5 m length of the fence along the slope's far edge.

The game's axes (three.js): the jumpers fly along +x, y is up, and the far
side of the hill is −z (the camera is on the +z side). Blender is z-up, so
here x is the same, y is three.js −z (towards the far side) and z is up; the
glTF exporter turns it round. Every piece keeps its daylight colours.

PR 13aw polished it with the shared venue blocks (art/venuelib.py): handrails
on posts along the deck; a start house with a sloping roof, framed windows,
a start light, a stair and a flag; judges' booths stepping out up the tower
with a judge behind each window; coaches on a braced stand; tapered masts
with lamp frames; a crowd, a rail and stairs in the grandstand; a teal band
along the fence.
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
from venuelib import Mesh, fan, person, run, srgb  # noqa: E402

OUT = ROOT / "public" / "models" / "skijump.glb"
PREVIEW = ROOT / "art" / "skijump" / "preview.jpg"
# The in-run and the table, m: the same as JUMP_SCENE in src/data/replay.ts.
INRUN = 50.0
TABLE = 7.0
# The deck: its width, how far its top stands proud of the snow (just enough not to flicker; the jumpers leave the lip at the snow's height), how deep it goes, and the two lanes' tracks (JUMP_SCENE.laneMine and laneOld; −z there is +y here).
DECK_WIDTH = 6.4
DECK_UP = 0.02
DECK_DOWN = -0.3
LANES = (-2.0, 2.0)
# Each lane's ice track: two grooves this far either side of the lane, this wide.
GROOVE_OFF, GROOVE_W = 0.13, 0.11
WALL_UP = 0.8

venuelib.COLOURS.update({
    "Deck": "E6ECF2",
    "Track": "7F97AD",
    "Wall": "C9D3DD",
    "Rail": "5D6873",
    "Lip": "D23B2F",
    "Steel": "5D6873",
    "Cabin": "EEF0F5",
    "Glass": "3E4A7A",
    "Roof": "2C3560",
    "Timber": "8A6A4A",
    "Seats": "3E4A7A",
    "SeatsAlt": "4A5788",
    "Riser": "2C3560",
    "Lamp": "FFF4D6",
    "Net": "DCE3EA",
    "Accent": "2E9E95",
    "Skin": "D9A88B",
    "Jacket": "4F5BD5",
    "Red": "D23B2F",
    "Amber": "E3A23B",
    "Green": "2E9E5B",
    "Lilac": "A88BE0",
})
COLOURS = venuelib.COLOURS


def deck(name: str, length: float, lip: bool) -> None:
    """A length of deck running back along −x from its origin: the slab, a pair of grooves for each lane, side walls with a rail on posts, and the red lip at the table's edge."""
    m = Mesh()
    half = DECK_WIDTH / 2
    m.box(-length, 0, -half, half, DECK_DOWN, DECK_UP, "Deck")
    for lane in LANES:
        for side in (-1, 1):
            c = lane + side * GROOVE_OFF
            m.box(-length, 0, c - GROOVE_W / 2, c + GROOVE_W / 2, DECK_UP, DECK_UP + 0.03, "Track")
    for side in (-1, 1):
        y = side * (half + 0.08)
        # The table's walls run on back under the in-run's, so no gap opens where the two slopes meet,
        # a hair thicker so their faces never lie in the in-run's walls' planes (no flicker where they overlap).
        t = 0.09 if lip else 0.08
        m.box(-length - (1.2 if lip else 0.0), 0, y - t, y + t, DECK_DOWN, DECK_UP + WALL_UP, "Wall")
        # The handrail stands on short posts above the wall, every 2.5 m.
        top = DECK_UP + WALL_UP
        m.rod((-length, y, top + 0.35), (0, y, top + 0.35), 0.03, "Rail", 5)
        for k in range(int(length / 2.5) + 1):
            x = -k * 2.5
            m.rod((x, y, top), (x, y, top + 0.35), 0.025, "Rail")
    if lip:
        m.box(-0.35, 0, -half, half, DECK_UP, DECK_UP + 0.035, "Lip")
    m.done(name)


def start_house() -> None:
    """The cabin over the top of the in-run, its front on the origin: a sloping roof, framed windows down the in-run, the start bar and the start light, a stair up its side and a flag."""
    m = Mesh()
    w = DECK_WIDTH / 2 + 1.0
    m.box(-4.5, 0, -w, w, 0, 3.2, "Cabin")
    # The roof slopes up to the back, its eave over the start; the walls rise to meet it.
    def roof_z(x: float) -> float:
        return 3.2 + (0.5 - x) / 5.4 * 0.9

    profile = [(0.5, 3.2), (-4.9, 4.1), (-4.9, 4.25), (0.5, 3.35)]
    m.loft([[(x, y, z) for x, z in profile] for y in (-w - 0.3, w + 0.3)], "Roof", smooth=False)
    for y in (-w, w):
        m.poly([(0, y, 3.2), (-4.5, y, 3.2), (-4.5, y, roof_z(-4.5)), (0, y, roof_z(0))], "Cabin")
    m.poly([(-4.5, -w, 3.2), (-4.5, w, 3.2), (-4.5, w, roof_z(-4.5)), (-4.5, -w, roof_z(-4.5))], "Cabin")
    m.poly([(0, -w, 3.2), (0, w, 3.2), (0, w, roof_z(0)), (0, -w, roof_z(0))], "Cabin")
    # Three framed windows facing down the in-run.
    for k in range(3):
        y0 = -w + 0.5 + k * (2 * w - 1.0) / 3
        y1 = y0 + (2 * w - 1.0) / 3 - 0.2
        m.box(0.0, 0.05, y0 - 0.08, y1 + 0.08, 1.32, 2.68, "Roof")
        m.box(0.05, 0.08, y0, y1, 1.4, 2.6, "Glass")
    # The start bar across the deck on its posts, and the start light beside it.
    for y in (-DECK_WIDTH / 2, DECK_WIDTH / 2):
        m.cone(0.68, y, 0, 1.1, 0.06, 0.06, 6, "Steel")
    m.box(0.6, 0.75, -DECK_WIDTH / 2, DECK_WIDTH / 2, 0.95, 1.05, "Accent")
    m.cone(1.0, -w - 0.2, 0, 2.2, 0.05, 0.05, 6, "Steel")
    m.box(0.9, 1.1, -w - 0.35, -w - 0.05, 2.2, 3.0, "Roof")
    for z, lamp in ((2.8, "Red"), (2.6, "Amber"), (2.4, "Green")):
        m.cyl((1.1, -w - 0.2, z), (1.14, -w - 0.2, z), 0.07, lamp, 8)
    # A stair up the far side, and a flag on the roof.
    for k in range(8):
        m.box(-4.4 + k * 0.5, -3.9 + k * 0.5, w + 0.05, w + 1.05, k * 0.4, k * 0.4 + 0.1, "Steel")
    m.rod((-4.4, w + 1.05, 0.9), (-0.4, w + 1.05, 4.1), 0.03, "Rail")
    m.cone(-4.4, 0, 4.1, 7.5, 0.04, 0.03, 6, "Steel")
    m.box(-4.38, -3.1, -0.02, 0.02, 6.7, 7.4, "Accent")
    m.done("StartHouse")


def judges_tower() -> None:
    """Five judges' booths stepping out up a slim tower, each glazed towards the slope (−y) with a judge behind the glass, on four braced legs, a stair up the back."""
    m = Mesh()
    for x in (-2.0, 2.0):
        for y in (-1.5, 1.5):
            m.cone(x, y, 0, 6.0, 0.15, 0.12, 8, "Steel")
    for x in (-2.0, 2.0):
        m.rod((x, -1.5, 0.3), (x, 1.5, 5.7), 0.06, "Steel")
        m.rod((x, 1.5, 0.3), (x, -1.5, 5.7), 0.06, "Steel")
    m.box(-2.5, 2.5, -1.6, 2.0, 6.0, 15.0, "Cabin")
    # Each booth steps out a little further towards the slope than the one below, so every judge sees the landing.
    for k in range(5):
        z = 6.2 + k * 1.7
        out = -1.6 - 0.25 * k - 0.35
        m.box(-2.3, 2.3, out, -1.6, z, z + 1.5, "Cabin")
        m.poly([(-2.2, out - 0.01, z + 0.4), (2.2, out - 0.01, z + 0.4), (2.2, out - 0.01, z + 1.35), (-2.2, out - 0.01, z + 1.35)], "Glass")
        m.box(-2.35, 2.35, out - 0.1, -1.6, z + 1.5, z + 1.6, "Roof")
        m.sphere((0.0, out + 0.5, z + 0.95), 0.13, "Skin", 6)
        m.cyl((0.0, out + 0.5, z + 0.3), (0.0, out + 0.5, z + 0.82), 0.2, "Jacket", 6, rb=0.16)
    m.prism([(-2.8, -3.6), (2.8, -3.6), (2.8, 2.3), (-2.8, 2.3)], 15.0, 15.4, "Roof")
    # A stair up the back with its rail.
    for k in range(12):
        m.box(-0.6, 0.6, 2.0 + k * 0.35, 2.35 + k * 0.35, k * 0.5, k * 0.5 + 0.12, "Steel")
    for x in (-0.6, 0.6):
        m.rod((x, 2.0, 1.0), (x, 6.2, 6.6), 0.03, "Rail")
    m.done("JudgesTower")


def coach_stand() -> None:
    """The coaches' platform: a timber deck on braced legs with a rail along its front, three coaches in team jackets watching the take-off, one with a flag."""
    m = Mesh()
    for x in (-3.6, 0.0, 3.6):
        for y in (-1.0, 1.0):
            m.cone(x, y, 0, 3.0, 0.08, 0.08, 6, "Steel")
    for y in (-1.0, 1.0):
        m.rod((-3.6, y, 0.2), (0.0, y, 2.8), 0.04, "Steel")
        m.rod((3.6, y, 0.2), (0.0, y, 2.8), 0.04, "Steel")
    m.box(-4.0, 4.0, -1.25, 1.25, 3.0, 3.2, "Timber")
    for y in (-1.25, 1.25):
        m.rod((-4.0, y, 4.2), (4.0, y, 4.2), 0.04, "Rail", 5)
        for x in (-4.0, -2.0, 0.0, 2.0, 4.0):
            m.rod((x, y, 3.2), (x, y, 4.2), 0.03, "Rail")
    for k, (x, jacket) in enumerate(((-2.4, "Jacket"), (0.2, "Accent"), (2.6, "Lip"))):
        with m.at(x, 0.0, 3.2):
            person(m, 0, 0, jacket, coat=True, hat=("Roof", "Cabin", "Roof")[k])
    m.cone(0.6, -0.4, 4.4, 6.0, 0.02, 0.02, 5, "Steel")
    m.box(0.6, 1.3, -0.42, -0.38, 5.4, 6.0, "Accent")
    m.done("CoachStand")


def light_mast() -> None:
    """A floodlight mast: a tall tapering steel pole with a lattice frame of lamps turned to the slope."""
    m = Mesh()
    m.cone(0, 0, 0, 24.0, 0.32, 0.14, 10, "Steel")
    m.cone(0, 0, 0, 0.4, 0.6, 0.6, 10, "Wall")
    m.box(-1.7, 1.7, -0.3, -0.15, 22.9, 23.0, "Steel")
    m.box(-1.7, 1.7, -0.3, -0.15, 25.4, 25.5, "Steel")
    for x in (-1.7, 1.7):
        m.box(x - 0.05, x + 0.05, -0.3, -0.15, 22.9, 25.5, "Steel")
    m.rod((0, 0, 23.0), (0, -0.22, 23.0), 0.06, "Steel")
    for i in range(3):
        for j in range(2):
            x = -1.05 + i * 1.05
            z = 23.6 + j * 1.1
            m.box(x - 0.42, x + 0.42, -0.62, -0.3, z - 0.42, z + 0.42, "Roof")
            m.box(x - 0.36, x + 0.36, -0.64, -0.62, z - 0.36, z + 0.36, "Lamp")
    m.done("LightMast")


def grandstand() -> None:
    """A stand at the outrun: eight rows stepping up and back from the slope (−y), a crowd on them, a front rail, a stair at each end and a sloping roof on tapered posts."""
    m = Mesh()
    length = 30.0
    row, step = 0.9, 0.5
    for r in range(8):
        y0 = r * row
        m.box(-length / 2, length / 2, y0, y0 + row, 0, 0.6 + r * step, "SeatsAlt" if r % 2 else "Seats")
    # The crowd: a seat every 0.6 m, about half full, the stairs at each end left clear.
    jackets = ("Jacket", "Accent", "Lip", "Amber", "Cabin", "Lilac")
    k = 0
    for r in range(8):
        for j in range(47):
            k += 1
            x = -length / 2 + 1.4 + j * 0.6
            if spread(k, 1) > 0.5 - 0.03 * r:
                continue
            fan(m, x, r * row + 0.45, 0.6 + r * step, jackets[int(spread(k, 2) * 6)])
    for x in (-length / 2 + 0.6, length / 2 - 0.6):
        for r in range(8):
            m.box(x - 0.5, x + 0.5, r * row, r * row + row, 0.6 + r * step, 0.65 + r * step, "Wall")
    m.rod((-length / 2, -0.05, 1.6), (length / 2, -0.05, 1.6), 0.03, "Rail", 5)
    for x in range(-15, 16, 3):
        m.rod((x, -0.05, 0.6), (x, -0.05, 1.6), 0.025, "Rail")
    for x in (-length / 2, -length / 6, length / 6, length / 2):
        m.cone(x, 8 * row - 0.15, 0, 8.4, 0.2, 0.12, 8, "Steel")
        m.rod((x, 8 * row - 0.15, 6.0), (x, 3.0, 7.9), 0.08, "Steel")
    m.prism([(-length / 2 - 0.5, -0.5), (length / 2 + 0.5, -0.5), (length / 2 + 0.5, 8 * row + 0.3), (-length / 2 - 0.5, 8 * row + 0.3)], 7.8, 8.0, "Roof")
    m.done("Grandstand")


def fence_panel() -> None:
    """One 5 m length of the slope's safety fence, along +x from its origin: two round posts, the net between and a teal band along its top."""
    m = Mesh()
    for x in (0.0, 5.0):
        m.cone(x, 0, 0, 1.05, 0.04, 0.04, 6, "Rail")
    m.box(0.0, 5.0, -0.02, 0.02, 0.1, 0.75, "Net")
    m.box(0.0, 5.0, -0.025, 0.025, 0.75, 0.95, "Accent")
    m.done("FencePanel")


def spread(k: int, salt: float) -> float:
    """A fixed, even spread in 0..1 for the k-th seat: the same every build."""
    v = math.sin(k * 12.9898 + salt * 78.233) * 43758.5453
    return v - math.floor(v)


def preview_scene() -> None:
    """Lay the pieces out as the scene does on a plain slope, light it, and shoot it from the replay's side."""
    scene = bpy.context.scene
    objs = {o.name: o for o in scene.objects}
    td, idg = math.radians(11), math.radians(35)
    objs["Table"].rotation_euler = (0, td, 0)
    top = Vector((-TABLE * math.cos(td), 0, TABLE * math.sin(td)))
    objs["Inrun"].location = top
    objs["Inrun"].rotation_euler = (0, idg, 0)
    run_top = top + Vector((-INRUN * math.cos(idg), 0, INRUN * math.sin(idg)))
    objs["StartHouse"].location = run_top
    # A plain snow slope for the pieces to stand on: 35° down from the table's foot.
    bm = bmesh.new()
    pts = [(-60, 20), (0, -3), (60, -38), (110, -50), (160, -50)]
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        bm.faces.new([bm.verts.new(p) for p in ((x0, -12, z0), (x1, -12, z1), (x1, 12, z1), (x0, 12, z0))])
    me = bpy.data.meshes.new("Snow")
    bm.to_mesh(me)
    snow = bpy.data.objects.new("Snow", me)
    m = bpy.data.materials.new("SnowMat")
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb("F4F7FA")
    me.materials.append(m)
    scene.collection.objects.link(snow)

    def ground(x: float) -> float:
        for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
            if x0 <= x <= x1:
                return z0 + (z1 - z0) * (x - x0) / (x1 - x0)
        return pts[-1][1]

    objs["JudgesTower"].location = (60, 19, ground(60))
    objs["CoachStand"].location = (18, 17, ground(18))
    objs["LightMast"].location = (35, 21, ground(35))
    objs["Grandstand"].location = (135, 22, ground(135))
    objs["FencePanel"].location = (20, 12.3, ground(20))

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
    cam_obj.location = (-8, -55, 18)
    scene.collection.objects.link(cam_obj)
    cam_obj.rotation_euler = (Vector((25, 10, -8)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    scene.render.filepath = str(PREVIEW)
    bpy.ops.render.render(write_still=True)


def build() -> None:
    deck("Inrun", INRUN, False)
    deck("Table", TABLE, True)
    start_house()
    judges_tower()
    coach_stand()
    light_mast()
    grandstand()
    fence_panel()


def preview(path: Path) -> None:
    preview_scene()


run(OUT, PREVIEW, build, preview)
