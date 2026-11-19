"""
The Ozimka fields' kit (PR 13w), built headless in Blender from numbers:
the farm co-operative's wheat that the survey planes fly their lines over.
Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/fields/build.py -- [--preview]

Writes public/models/fields.glb and public/models/models.json (the hash of
every art script), and with --preview also art/fields/preview.jpg.

The wheat and its rows stay in code (src/render/replayScene.ts, from
SURVEY_SCENE). The survey replay stands these round the planes' lines (see
SURVEY_KIT in src/data/replay.ts), each piece at its own origin and built
along +x. Pieces that face the field face it across −y here:

- Hedge: 30 m of lumpy hawthorn hedge, the field's edges.
- Oak: a big oak standing out of a hedge.
- Poplars: 30 m of shelterbelt, five tall poplars in a row.
- PowerSpan: a wooden power pole and its three wires, sagging 60 m to the next pole.
- Track: 30 m of farm track, two dirt ruts and grass up the middle.
- Farmstead: the co-operative's yard, facing the field: a big barn, an open machine shed with a
  tractor, the farmhouse, two grain bins and the grain leg (the tallest thing for miles).
- Combine: a combine harvester at work in the next field, the cut stubble behind it and a
  tractor and grain trailer alongside.
- BaleStack: round straw bales stacked on a patch of stubble.
- HayShed: an open-sided hay shed with bales under it.

The game's axes (three.js): +x along, y up, z to the right. Blender is z-up,
so here x is the same, y is three.js −z (the left) and z is up; the glTF
exporter turns it round. Every piece keeps its daylight colours.

PR 13au polished it with the shared venue blocks (art/venuelib.py): poles
with braced crossarms and glass insulators; a farmstead with braced barn
doors, a porch and chimney, ribbed grain bins with ladders, spouts off the
grain leg and a car in the yard; a combine with its reel, a flared grain
tank and a dust trail; round-hubbed tractors; a trussed hay shed.
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
from venuelib import Mesh, car, run, srgb, wheel  # noqa: E402

OUT = ROOT / "public" / "models" / "fields.glb"
PREVIEW = ROOT / "art" / "fields" / "preview.jpg"

# The planes fly their lines FLY metres over the wheat (SURVEY_SCENE.flyHeight).
FLY = 40.0

venuelib.COLOURS.update({
    "White": "F4F4F2",
    "Wall": "E9E2D6",
    "Roof": "8C4A3F",
    "Roof2": "4A5878",
    "Barn": "A8473C",
    "Steel": "5D6873",
    "Silver": "B9C0C8",
    "Glass": "2C3560",
    "Black": "1D242B",
    "Tyre": "1D242B",
    "Bark": "6B5A4E",
    "Leaf": "7A9474",
    "Hedge": "5F7A5C",
    "Hedge2": "6E8964",
    "Poplar": "6F8A5E",
    "Wood": "8A7058",
    "Amber": "E3A23B",
    "Teal": "2E9E95",
    "Concrete": "C9C6BF",
    "Dirt": "A68B6B",
    "Verge": "9DB08A",
    "Stubble": "E6D3A0",
    "Hay": "D9B86A",
    "Hay2": "C4A257",
    "Combine": "C9483C",
    "Tractor": "2F5BB7",
    "Hub": "B9C0C8",
    "Trunk": "6B5A4E",
    "Dust": "D8C9A2",
    "Plank": "8E3A31",
})


def wobble(k: int, salt: float) -> float:
    """A fixed, even spread in −1..1 for the k-th lump: the same every build."""
    return math.sin(k * 12.9898 + salt * 78.233) * 0.5 + math.sin(k * 4.1414 + salt * 3.7) * 0.5


def tractor(m: Mesh, x: float, y: float) -> None:
    """A blue tractor facing +x: big back wheels, small front ones, the bonnet sloping down, the cab over the back axle with its exhaust stack."""
    hood = [(x + 1.6, 0.7), (x + 3.5, 0.7), (x + 3.7, 0.9), (x + 3.7, 1.4), (x + 3.4, 1.65), (x + 1.6, 1.75)]
    with m.at(0, y, 0):
        m.loft([[(px, -0.55, pz) for px, pz in hood], [(px, 0.55, pz) for px, pz in hood]], "Tractor", smooth=False)
        m.box(x + 0.3, x + 1.7, -0.7, 0.7, 0.9, 1.75, "Tractor")
        m.box(x + 3.7, x + 3.76, -0.4, 0.4, 0.95, 1.3, "Steel")
    # The cab: a glass box with dark corner posts and a white roof.
    m.box(x + 0.25, x + 1.75, y - 0.78, y + 0.78, 1.75, 2.95, "Glass")
    for px in (x + 0.25, x + 1.75):
        for py in (y - 0.78, y + 0.78):
            m.cone(px, py, 1.75, 2.95, 0.04, 0.04, 4, "Black")
    m.box(x + 0.1, x + 1.9, y - 0.9, y + 0.9, 2.95, 3.08, "White")
    m.cone(x + 2.2, y + 0.4, 1.7, 3.2, 0.06, 0.05, 6, "Black")
    for s in (-1, 1):
        wheel(m, x + 0.9, y + s * 1.0, 0.8, 0.5, "Amber", 12)
        wheel(m, x + 3.1, y + s * 0.85, 0.48, 0.32, "Amber", 10)


def trailer(m: Mesh, x0: float, x1: float, y: float, colour: str) -> None:
    """A grain trailer from x0 to x1 (its drawbar at x1), centred on y: a flared tub on two axles."""
    w = 1.3
    tub = [(-w + 0.25, 0.9), (w - 0.25, 0.9), (w + 0.15, 2.8), (-w - 0.15, 2.8)]
    m.loft([[(x0, y + cy, cz) for cy, cz in tub], [(x1 - 1.0, y + cy, cz) for cy, cz in tub]], colour, smooth=False)
    m.rod((x1 - 1.0, y, 0.9), (x1, y, 0.7), 0.06, "Steel")
    mid = (x0 + x1 - 1.0) / 2
    for ax in (mid - 0.7, mid + 0.7):
        for s in (-1, 1):
            wheel(m, ax, y + s * 1.2, 0.55, 0.4, "Hub", 10)


# --- The fields' pieces.


def hedge() -> None:
    """30 m of hedge along x, about 2 m wide and 2.4 m high: overlapping lumps, two greens."""
    m = Mesh()
    for k in range(7):
        x = 2.2 + k * 4.3
        m.blob(x, wobble(k, 1) * 0.3, 1.2 + wobble(k, 2) * 0.15, 2.9, 1.1, 1.25 + wobble(k, 3) * 0.2, "Hedge" if k % 2 else "Hedge2")
    m.done("Hedge")


def oak() -> None:
    """A big field oak, about 12 m tall, its crown in three lumps on two limbs."""
    m = Mesh()
    m.cone(0, 0, 0, 4.2, 0.45, 0.3, 6, "Bark")
    m.cyl((0, 0, 3.8), (1.6, -1.0, 7.0), 0.25, "Bark", 5, rb=0.12, cap=False)
    m.cyl((0, 0, 3.8), (-1.6, 1.0, 6.6), 0.25, "Bark", 5, rb=0.12, cap=False)
    m.blob(0, 0, 7.0, 4.6, 4.4, 3.4, "Leaf")
    m.blob(1.8, -1.2, 9.4, 2.8, 2.6, 2.2, "Hedge2")
    m.blob(-1.9, 1.1, 8.8, 2.6, 2.6, 2.0, "Leaf")
    m.done("Oak")


def poplars() -> None:
    """30 m of shelterbelt: five tall, narrow poplars in a row, about 15 m high."""
    m = Mesh()
    for k in range(5):
        x = 3 + k * 6
        h = 1 + wobble(k, 5) * 0.12
        m.cone(x, 0, 0, 2.4, 0.22, 0.18, 5, "Bark")
        m.blob(x, 0, 8.4 * h, 1.6, 1.6, 6.6 * h, "Poplar")
    m.done("Poplars")


def power_span() -> None:
    """A wooden pole with its braced crossarm and glass insulators, and three wires sagging 60 m to where the next pole stands."""
    m = Mesh()
    top = 9.0
    m.cone(0, 0, 0, top, 0.15, 0.11, 6, "Wood")
    m.box(-0.08, 0.08, -1.3, 1.3, top - 0.6, top - 0.45, "Wood")
    for s in (-1, 1):
        m.rod((0, 0, top - 1.4), (0, s * 0.8, top - 0.6), 0.03, "Steel")
    for y in (-1.15, 0, 1.15):
        z = top - 0.45 if y else top
        # A stack of three glass skirts on a pin.
        m.cone(0, y, z, z + 0.08, 0.03, 0.03, 5, "Steel")
        for k in range(3):
            m.cone(0, y, z + 0.08 + k * 0.07, z + 0.15 + k * 0.07, 0.09, 0.04, 7, "Teal")
        # Each wire hangs in a shallow curve: lowest 1.4 m down at midspan, in six straight pieces.
        pts = [(x, y, z + 0.3 - 1.4 * (1 - ((x - 30) / 30) ** 2)) for x in range(0, 61, 10)]
        for a, b in zip(pts, pts[1:]):
            m.rod(a, b, 0.025, "Black")
    m.done("PowerSpan")


def track() -> None:
    """30 m of farm track along x, 4 m wide: two dirt ruts with grass up the middle and along the sides."""
    m = Mesh()
    m.flat(0, 30, -2.2, 2.2, 0.02, "Verge")
    for y0, y1 in ((-1.7, -0.7), (0.7, 1.7)):
        m.flat(0, 30, y0, y1, 0.03, "Dirt")
    m.done("Track")


def grain_bin(m: Mesh, x: float, y: float) -> None:
    """A corrugated grain bin: ribbed walls, a conical roof with a vent cap, and a ladder up the yard side."""
    m.cone(x, y, 0, 10, 4, 4, 16, "Silver")
    for z in (2.5, 5, 7.5):
        m.cone(x, y, z - 0.08, z + 0.08, 4.06, 4.06, 16, "Steel")
    m.cone(x, y, 10, 12.5, 4.2, 0.6, 16, "Silver")
    m.cone(x, y, 12.5, 13.0, 0.6, 0.6, 8, "Steel")
    for dx in (-0.25, 0.25):
        m.rod((x + dx, y - 4.1, 0), (x + dx, y - 4.1, 10), 0.03, "Steel")
    for k in range(10):
        m.rod((x - 0.25, y - 4.1, 0.6 + k), (x + 0.25, y - 4.1, 0.6 + k), 0.02, "Steel")


def farmstead() -> None:
    """The co-operative's yard, about 64 by 48 m, its open side to the field (−y)."""
    m = Mesh()
    m.flat(0, 64, 0, 44, 0.03, "Concrete")
    # The big barn: red boards, a grey roof with two vents, two tall braced doors to the yard.
    m.box(4, 34, 14, 30, 0, 7, "Barn")
    for z in (1.75, 3.5, 5.25):
        m.box(3.96, 34.04, 13.96, 30.04, z, z + 0.06, "Plank")
    m.roof(3.4, 34.6, 13.4, 30.6, 7, 4.2, "Roof2")
    for x in (13, 25):
        m.box(x - 0.8, x + 0.8, 21.2, 22.8, 10.6, 11.8, "Silver")
        m.roof(x - 1.0, x + 1.0, 21.0, 23.0, 11.8, 0.6, "Roof2")
    for x in (9, 24):
        m.box(x, x + 5, 13.9, 13.96, 0, 5.2, "Wall")
        m.box(x - 0.15, x + 5.15, 13.84, 13.9, 5.2, 5.4, "Plank")
        m.rod((x + 0.2, 13.84, 0.2), (x + 4.8, 13.84, 5.0), 0.08, "Plank")
        m.rod((x + 4.8, 13.84, 0.2), (x + 0.2, 13.84, 5.0), 0.08, "Plank")
    # The machine shed: steel posts, a shallow roof, open to the yard, a tractor parked inside.
    for x in (38, 47, 56):
        for y in (14, 28):
            m.box(x - 0.15, x + 0.15, y - 0.15, y + 0.15, 0, 6, "Steel")
    m.roof(37.5, 56.5, 13.5, 28.5, 6, 1.6, "Silver")
    tractor(m, 41, 21)
    # The farmhouse behind, white with a red roof, a chimney and a porch, and two trees by it.
    m.box(6, 18, 34, 42, 0, 5.5, "Wall")
    m.roof(5.6, 18.4, 33.6, 42.4, 5.5, 3.2, "Roof")
    m.box(15, 16, 39, 40, 6, 9.6, "Roof")
    for k in range(3):
        for z in (1.4, 3.4):
            m.box(7.3 + k * 3.8, 9.2 + k * 3.8, 33.94, 34, z - 0.1, z + 1.3, "White")
            m.box(7.5 + k * 3.8, 9 + k * 3.8, 33.9, 33.94, z, z + 1.2, "Glass")
    m.box(10.2, 11.4, 33.9, 33.96, 0, 2.2, "Teal")
    m.box(9.2, 12.4, 32.2, 34, 0, 0.25, "Wood")
    for x in (9.4, 12.2):
        m.cone(x, 32.4, 0.25, 2.8, 0.08, 0.08, 6, "White")
    m.poly([(9.0, 34, 3.0), (12.6, 34, 3.0), (12.6, 32.0, 2.7), (9.0, 32.0, 2.7)], "Roof")
    m.cone(22, 40, 0, 3, 0.25, 0.2, 6, "Bark")
    m.blob(22, 40, 5.2, 3.2, 3.2, 2.8, "Leaf")
    m.cone(-3, 36, 0, 3, 0.25, 0.2, 6, "Bark")
    m.blob(-3, 36, 5.0, 2.8, 2.8, 2.6, "Hedge2")
    # Two grain bins and the grain leg towering between them, a spout down to each.
    for x in (44, 53):
        grain_bin(m, x, 38)
    m.box(48, 49.4, 37.3, 38.7, 0, 22, "Steel")
    m.box(47.4, 50, 36.7, 39.3, 22, 24, "Barn")
    m.roof(47.2, 50.2, 36.5, 39.5, 24, 0.8, "Steel")
    for x in (44, 53):
        m.rod((48.7, 38, 21), (x, 38, 12.8), 0.18, "Steel", 6)
    # A pallet of feed sacks, a grain trailer and the farm's car in the yard.
    m.box(30, 33, 4, 7, 0, 0.15, "Wood")
    for k in range(3):
        m.box(30.1 + k, 30.9 + k, 4.1, 6.9, 0.15, 1.15, "Hay")
    trailer(m, 52, 61, 5.3, "Combine")
    with m.at(22, 6, 0, math.pi / 2):
        car(m, "Tractor", 4.2, 1.8)
    m.done("Farmstead")


def combine() -> None:
    """A combine at work, heading +x: 80 m of cut stubble behind it, the header and its reel, the cab, the grain tank, a tractor and trailer alongside, dust behind."""
    m = Mesh()
    m.flat(-80, 0, -5, 5, 0.03, "Stubble")
    # The body, its back sloping, the grain tank flaring on top.
    side = [(-9, 0.9), (-0.4, 0.9), (0.2, 1.6), (0.2, 3.4), (-1.0, 4.0), (-9.0, 4.0), (-9.6, 3.2), (-9.6, 1.6)]
    m.loft([[(x, -1.7, z) for x, z in side], [(x, 1.7, z) for x, z in side]], "Combine", smooth=False)
    tank = [(-7.6, -1.6, 4.0), (-1.6, -1.6, 4.0), (-1.6, 1.6, 4.0), (-7.6, 1.6, 4.0)]
    lid = [(-8.0, -1.9, 5.3), (-1.2, -1.9, 5.3), (-1.2, 1.9, 5.3), (-8.0, 1.9, 5.3)]
    m.loft([tank, lid], "Combine", cap_start=False, smooth=False)
    m.cone(-6.5, 1.2, 5.3, 6.4, 0.12, 0.12, 6, "Black")
    # The cab up front, its roof white.
    m.box(-2.2, 0.4, -1.3, 1.3, 3.4, 5.4, "Glass")
    m.box(-2.4, 0.6, -1.4, 1.4, 5.4, 5.6, "White")
    # The header: a wide cutter on a feeder, and the reel above it.
    m.box(0.2, 1.4, -0.7, 0.7, 0.9, 2.3, "Combine")
    hdr = [(1.0, 0.25), (2.6, 0.25), (2.6, 0.45), (1.6, 1.4), (1.0, 1.4)]
    m.loft([[(x, -4.6, z) for x, z in hdr], [(x, 4.6, z) for x, z in hdr]], "Amber", smooth=False)
    m.drum(2.2, 0, 1.9, 0.12, 9.0, 6, "Amber")
    for k in range(6):
        a = 2 * math.pi * k / 6
        m.rod((2.2 + 0.6 * math.cos(a), -4.4, 1.9 + 0.6 * math.sin(a)), (2.2 + 0.6 * math.cos(a), 4.4, 1.9 + 0.6 * math.sin(a)), 0.03, "Amber")
    for s in (-1, 1):
        m.rod((1.0, s * 4.4, 1.4), (2.2, s * 4.4, 1.9), 0.05, "Amber")
        wheel(m, -2.0, s * 1.8, 0.95, 0.65, "Hub", 12)
        wheel(m, -8.0, s * 1.6, 0.6, 0.4, "Hub", 10)
    # The unloading auger swung out over the trailer, the trailer and tractor on the stubble beside.
    m.rod((-6, -1.7, 5.0), (-4, -8, 5.4), 0.2, "Combine", 6)
    trailer(m, -10, -1.5, -8.0, "Barn")
    tractor(m, -1.6, -8.0)
    # Dust and chaff behind.
    for k in range(4):
        m.blob(-11 - k * 2.6, wobble(k, 9) * 0.6, 1.4 + k * 0.4, 1.4 + k * 0.5, 1.8 + k * 0.4, 1.0 + k * 0.3, "Dust")
    m.done("Combine")


def bale_stack() -> None:
    """Round straw bales on a patch of stubble: a stack of six and a few left where they dropped."""
    m = Mesh()
    m.flat(-6, 26, -9, 9, 0.03, "Stubble")
    for k in range(4):
        m.drum(k * 1.9, 0, 0.85, 0.85, 1.4, 12, "Hay")
    for k in range(2):
        m.drum(0.95 + k * 1.9, 0, 2.4, 0.85, 1.4, 12, "Hay2")
    for k, (x, y) in enumerate(((12, -4), (17, 3), (22, -2))):
        m.drum(x, y, 0.85, 0.85, 1.4, 12, "Hay" if k % 2 else "Hay2")
    m.done("BaleStack")


def hay_shed() -> None:
    """An open-sided hay shed, 18 by 8 m, steel posts, trusses and a red roof, half full of bales."""
    m = Mesh()
    for x in (0, 6, 12, 18):
        for y in (0, 8):
            m.box(x - 0.15, x + 0.15, y - 0.15, y + 0.15, 0, 5.5, "Steel")
        # A truss under the roof: the tie, a king post and two struts.
        m.rod((x, 0, 5.5), (x, 8, 5.5), 0.06, "Steel")
        m.rod((x, 2, 5.5), (x, 4, 7.2), 0.05, "Steel")
        m.rod((x, 6, 5.5), (x, 4, 7.2), 0.05, "Steel")
        m.rod((x, 4, 5.5), (x, 4, 7.2), 0.05, "Steel")
    m.roof(-0.6, 18.6, -0.6, 8.6, 5.5, 1.8, "Combine")
    for k in range(5):
        for j in range(2):
            m.box(1 + k * 1.7, 2.5 + k * 1.7, 1, 7, j * 1.6, j * 1.6 + 1.5, "Hay" if (k + j) % 2 else "Hay2")
    m.done("HayShed")


def build() -> None:
    hedge()
    oak()
    poplars()
    power_span()
    track()
    farmstead()
    combine()
    bale_stack()
    hay_shed()


def preview(path: Path) -> None:
    """Lay the pieces round a corner of the field as the replay would, and shoot it from behind a plane at its height."""
    scene = bpy.context.scene
    o = {ob.name: ob for ob in scene.objects}

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

    plane("Wheat", -1500, 1500, -1500, 1500, 0, "E3CF8F")

    def put(name: str, x: float, y: float, turn: float = 0.0) -> None:
        c = o[name].copy()
        c.location = (x, y, 0)
        c.rotation_euler = (0, 0, turn)
        scene.collection.objects.link(c)

    # The field: lines run along x from 0 to 600; its far edge hedge at x = 650, its near edge along y = 40 (the left).
    for k in range(-2, 22):
        put("Hedge", -50 + k * 30, 40)
    for k in range(0, 30):
        put("Hedge", 650, 40 - k * 30, -math.pi / 2)
        put("Track", 658, 40 - k * 30, -math.pi / 2)
        if k % 3 == 1:
            put("Oak", 650, 25 - k * 30)
    for k in range(0, 15):
        put("PowerSpan", 670, 40 - k * 60, -math.pi / 2)
        if k % 3:
            put("Poplars", 720, 40 - k * 60, -math.pi / 2)
    put("Farmstead", 420, 110)
    put("Combine", 820, -200, -math.pi / 2)
    put("BaleStack", 760, -60)
    put("HayShed", 720, 120)
    for n in ("Hedge", "Track", "Oak", "PowerSpan", "Poplars", "Farmstead", "Combine", "BaleStack", "HayShed"):
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
    cam_obj.location = (300, -40, FLY + 2)
    scene.collection.objects.link(cam_obj)
    cam_obj.rotation_euler = (Vector((560, 110, 0)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


run(OUT, PREVIEW, build, preview)
