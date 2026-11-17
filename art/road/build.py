"""
The open road's roadside (PR 13t), built headless in Blender from numbers.
Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/road/build.py -- [--preview]

Writes public/models/road.glb and public/models/models.json (the hash of
every art script), and with --preview also art/road/preview.jpg.

The road itself stays in code: its legs, width and centre line come from the
course (src/render/replayScene.ts). These are the pieces the time-trial and
truck replays stand along it, each at its own origin, built along +x (the way
the riders and trucks run). Pieces that stand beside the road face it across
−y here (the road is on their right as you come; the scene puts them on its
left, and turns them round for its right):

- TreeRound: a broad-leaved tree, its crown in two lumps.
- TreePine: a pine, three tiers on a short trunk.
- TreeBirch: a slim birch, white bark and a narrow crown.
- KmPost: a white roadside post with a coral cap, facing the oncoming road (−x).
- Sign: a blue sign on two legs, facing the oncoming road.
- Farm: a farmhouse, a barn, a grain silo and a fence.
- Village: a cluster of houses round a church with a tower.
- WindTurbine: a three-bladed turbine on its tower, blades still.
- StartRamp: a time trial's start house: a ramp down to the road, a canopy and the clock. Across the road, centred on it.
- FinishArch: a truss gantry over the road with the finish banner. Across the road, centred on it (sized for a 7 m road, scaled in code).
- FinishCrowd: barriers along the road's edge with people behind, 40 m long.
- FuelDepot: a truck stop at the start of a fuel run: a canopy over the pumps, tanks and a parked rig.
- Warehouse: the depot at the end of a run: a long shed with loading docks.

The game's axes (three.js): +x along, y up, z to the right. Blender is z-up,
so here x is the same, y is three.js −z (the left) and z is up; the glTF
exporter turns it round. Every piece keeps its daylight colours.
"""

from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "public" / "models" / "models.json"
OUT = ROOT / "public" / "models" / "road.glb"
PREVIEW = ROOT / "art" / "road" / "preview.jpg"
# Pinned on purpose, the same as the other art scripts and .github/workflows/art.yml.
BLENDER = "4.5.15"


def input_hash() -> str:
    """Every art script, in path order, hashed: tests/models.test.ts works it out the same way."""
    h = hashlib.sha256()
    for path in sorted((ROOT / "art").rglob("*.py"), key=lambda p: p.relative_to(ROOT).as_posix().encode()):
        h.update(path.read_bytes())
    return h.hexdigest()[:16]


# A time trial's road: REPLAY_SCENE.roadWidth in src/data/replay.ts. The
# arch and the start house are built for it; the truck road scales them.
ROAD = 7.0

COLOURS = {
    "White": "F4F4F2",
    "Wall": "E9E2D6",
    "Wall2": "D8DCE6",
    "Roof": "8C4A3F",
    "Roof2": "4A5878",
    "Barn": "A8473C",
    "Steel": "5D6873",
    "Silver": "B9C0C8",
    "Glass": "2C3560",
    "Black": "1D242B",
    "Tyre": "1D242B",
    "Bark": "6B5A4E",
    "Birch": "E9E6DF",
    "Leaf": "7A9474",
    "Leaf2": "8FA27A",
    "Pine": "4E6662",
    "Wood": "A3896B",
    "Coral": "E0695D",
    "Amber": "E3A23B",
    "SignBlue": "2F5BB7",
    "Teal": "2E9E95",
    "Lilac": "A88BE0",
    "Cab": "3E4A7A",
    "Concrete": "C9C6BF",
    "Shirt1": "4F5BD5",
    "Shirt2": "E0695D",
    "Shirt3": "E3A23B",
    "Shirt4": "2E9E95",
    "Skin": "D9A88B",
}


def srgb(hex_: str) -> tuple[float, float, float, float]:
    """An sRGB hex colour as Blender's linear RGBA."""
    out = []
    for i in (0, 2, 4):
        c = int(hex_[i : i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


MATS: dict[str, bpy.types.Material] = {}


def mat(name: str) -> bpy.types.Material:
    """The material for a colour name, made once: matte, the steel a little shiny."""
    if name not in MATS:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = srgb(COLOURS[name])
        bsdf.inputs["Roughness"].default_value = 0.3 if name == "Glass" else 0.45 if name in ("Steel", "Silver") else 0.85
        bsdf.inputs["Metallic"].default_value = 0.4 if name in ("Steel", "Silver") else 0.0
        MATS[name] = m
    return MATS[name]


class Mesh:
    """A bmesh that collects shapes with named materials, then becomes one object."""

    def __init__(self) -> None:
        self.bm = bmesh.new()
        self.names: list[str] = []

    def _paint(self, verts, name: str) -> None:
        if name not in self.names:
            self.names.append(name)
        idx = self.names.index(name)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = idx

    def box(self, x0: float, x1: float, y0: float, y1: float, z0: float, z1: float, name: str) -> None:
        """An axis-aligned box between these bounds."""
        verts = bmesh.ops.create_cube(self.bm, size=1.0)["verts"]
        bmesh.ops.scale(self.bm, vec=Vector((x1 - x0, y1 - y0, z1 - z0)), verts=verts)
        bmesh.ops.translate(self.bm, vec=Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)), verts=verts)
        self._paint(verts, name)

    def cone(self, x: float, y: float, z0: float, z1: float, r0: float, r1: float, sides: int, name: str) -> None:
        """An upright cone or cylinder (r1 = r0) from z0 to z1, centred on (x, y)."""
        verts = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=sides, radius1=r0, radius2=r1, depth=z1 - z0)["verts"]
        bmesh.ops.translate(self.bm, vec=Vector((x, y, (z0 + z1) / 2)), verts=verts)
        self._paint(verts, name)

    def blob(self, x: float, y: float, z: float, rx: float, ry: float, rz: float, name: str) -> None:
        """A low, faceted lump (a tree's crown): an icosahedron stretched to these radii."""
        verts = bmesh.ops.create_icosphere(self.bm, subdivisions=1, radius=1.0)["verts"]
        bmesh.ops.scale(self.bm, vec=Vector((rx, ry, rz)), verts=verts)
        bmesh.ops.translate(self.bm, vec=Vector((x, y, z)), verts=verts)
        self._paint(verts, name)

    def flat(self, x0: float, x1: float, y0: float, y1: float, z: float, name: str) -> None:
        """A flat quad facing up at height z (paint on the road)."""
        a = [self.bm.verts.new(p) for p in ((x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z))]
        self.bm.faces.new(a)
        self._paint(a, name)

    def roof(self, x0: float, x1: float, y0: float, y1: float, z0: float, ridge: float, name: str) -> None:
        """A gable roof over the box x0..x1, y0..y1 from the eaves at z0, its ridge along x at z0 + ridge."""
        bm = self.bm
        ym = (y0 + y1) / 2
        a = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, ym, z0 + ridge), (x1, ym, z0 + ridge))]
        faces = [(a[0], a[1], a[5], a[4]), (a[2], a[3], a[4], a[5]), (a[0], a[4], a[3]), (a[1], a[2], a[5]), (a[0], a[3], a[2], a[1])]
        for f in faces:
            bm.faces.new(f)
        self._paint(a, name)

    def done(self, obj_name: str) -> bpy.types.Object:
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(obj_name)
        self.bm.to_mesh(me)
        self.bm.free()
        for n in self.names:
            me.materials.append(mat(n))
        obj = bpy.data.objects.new(obj_name, me)
        bpy.context.collection.objects.link(obj)
        return obj


# --- Trees: a few draws each, many copies, so kept to a few dozen faces.


def tree_round() -> None:
    m = Mesh()
    m.cone(0, 0, 0, 3.2, 0.22, 0.16, 6, "Bark")
    m.blob(0, 0, 4.6, 2.6, 2.6, 2.2, "Leaf")
    m.blob(0.6, 0.3, 6.3, 1.7, 1.7, 1.5, "Leaf")
    m.done("TreeRound")


def tree_pine() -> None:
    m = Mesh()
    m.cone(0, 0, 0, 1.6, 0.2, 0.18, 5, "Bark")
    for k, (z0, r) in enumerate(((1.4, 2.4), (3.4, 1.9), (5.2, 1.3))):
        m.cone(0, 0, z0, z0 + 2.8 - 0.4 * k, r, 0.05, 7, "Pine")
    m.done("TreePine")


def tree_birch() -> None:
    m = Mesh()
    m.cone(0, 0, 0, 5.0, 0.14, 0.09, 5, "Birch")
    m.blob(0, 0, 6.0, 1.3, 1.3, 2.4, "Leaf2")
    m.done("TreeBirch")


# --- Road furniture.


def km_post() -> None:
    """A white post with a coral cap and a black band, its face to the oncoming road (−x)."""
    m = Mesh()
    m.box(-0.1, 0.1, -0.1, 0.1, 0, 1.0, "White")
    m.box(-0.11, 0.11, -0.11, 0.11, 1.0, 1.2, "Coral")
    m.box(-0.12, -0.1, -0.08, 0.08, 0.7, 0.85, "Black")
    m.done("KmPost")


def sign() -> None:
    """A blue route sign on two legs, a white border and three white bars of 'text', facing the oncoming road."""
    m = Mesh()
    for y in (-1.0, 1.0):
        m.box(-0.06, 0.06, y - 0.06, y + 0.06, 0, 2.2, "Steel")
    m.box(-0.1, -0.02, -1.5, 1.5, 2.0, 4.0, "White")
    m.box(-0.13, -0.1, -1.4, 1.4, 2.1, 3.9, "SignBlue")
    for k, w in enumerate((2.0, 1.4, 1.7)):
        z = 3.5 - k * 0.55
        m.box(-0.15, -0.13, -w / 2, w / 2, z, z + 0.2, "White")
    m.done("Sign")


def house(m: Mesh, x: float, y: float, w: float, d: float, h: float, wall: str, roof: str) -> None:
    """A house x..x+w along, y..y+d deep, with a gable roof, a door and windows on its road side (−y)."""
    m.box(x, x + w, y, y + d, 0, h, wall)
    m.roof(x - 0.3, x + w + 0.3, y - 0.3, y + d + 0.3, h, d * 0.45, roof)
    m.box(x + w * 0.42, x + w * 0.58, y - 0.03, y, 0, 2.0, "Wood")
    for wx in (x + w * 0.18, x + w * 0.72):
        m.box(wx, wx + 0.9, y - 0.03, y, h * 0.45, h * 0.45 + 0.9, "Glass")


def farm() -> None:
    """A farmhouse near the road, a red barn behind, a silo and a fence along the road side."""
    m = Mesh()
    house(m, 0, 0, 9, 7, 4.2, "Wall", "Roof")
    m.box(14, 30, 6, 18, 0, 6, "Barn")
    m.roof(13.6, 30.4, 5.6, 18.4, 6, 4.5, "Roof2")
    m.box(19, 25, 5.97, 6.0, 0, 4.5, "White")
    m.cone(34, 12, 0, 13, 2.6, 2.6, 10, "Silver")
    m.cone(34, 12, 13, 15, 2.7, 0.3, 10, "Steel")
    # A post-and-rail fence along the road side.
    for x in range(-6, 40, 4):
        m.box(x - 0.08, x + 0.08, -4.08, -3.92, 0, 1.2, "Wood")
    m.box(-6, 38, -4.05, -3.95, 0.9, 1.0, "Wood")
    m.box(-6, 38, -4.05, -3.95, 0.45, 0.55, "Wood")
    m.done("Farm")


def village() -> None:
    """A few houses either side of a lane, round a church with a tower and a spire."""
    m = Mesh()
    spots = ((0, 0, 8, 6, 4.5, "Wall", "Roof"), (11, 1, 7, 6, 5.2, "Wall2", "Roof2"), (21, 0, 9, 7, 4.8, "Wall", "Roof"),
             (2, 16, 7, 6, 4.4, "Wall2", "Roof"), (24, 17, 8, 6, 5.0, "Wall", "Roof2"))
    for x, y, w, d, h, wall, roof in spots:
        house(m, x, y, w, d, h, wall, roof)
    # The church: a nave and a square tower with a spire.
    m.box(10, 22, 13, 21, 0, 7, "White")
    m.roof(9.6, 22.4, 12.6, 21.4, 7, 4, "Roof2")
    m.box(6.5, 10, 15, 19, 0, 15, "White")
    m.box(6.4, 10.1, 14.9, 19.1, 11, 12, "Wood")
    m.cone(8.25, 17, 15, 22, 2.5, 0.05, 4, "Roof2")
    m.done("Village")


def wind_turbine() -> None:
    """A wind turbine: a tapered tower, the nacelle facing the oncoming road (−x), three still blades."""
    m = Mesh()
    m.cone(0, 0, 0, 60, 1.8, 1.0, 10, "White")
    m.box(-2.5, 4.5, -1.3, 1.3, 59, 62.5, "White")
    m.box(-3.4, -2.5, -0.8, 0.8, 60, 61.6, "Silver")
    hub = Vector((-3.6, 0, 60.8))
    for k in range(3):
        a = math.radians(90 + 120 * k)
        bm = m.bm
        verts = bmesh.ops.create_cube(bm, size=1.0)["verts"]
        bmesh.ops.scale(bm, vec=Vector((0.3, 1.6, 26)), verts=verts)
        bmesh.ops.translate(bm, vec=Vector((0, 0, 13)), verts=verts)
        bmesh.ops.rotate(bm, verts=verts, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(a - math.pi / 2, 3, "X"))
        bmesh.ops.translate(bm, vec=hub, verts=verts)
        m._paint(verts, "White")
    m.done("WindTurbine")


def start_ramp() -> None:
    """A time trial's start house over the road's start: the ramp down onto it, a canopy on four legs, the clock beside."""
    m = Mesh()
    half = ROAD / 2
    # The ramp: a deck behind the line and a slope down to it.
    m.box(-9, -4, -1.6, 1.6, 0, 1.0, "Concrete")
    bm = m.bm
    a = [bm.verts.new(p) for p in ((-4, -1.6, 1.0), (0, -1.6, 0.02), (0, 1.6, 0.02), (-4, 1.6, 1.0), (-4, -1.6, 0), (0, -1.6, 0), (0, 1.6, 0), (-4, 1.6, 0))]
    for f in ((a[0], a[1], a[2], a[3]), (a[4], a[7], a[6], a[5]), (a[0], a[4], a[5], a[1]), (a[3], a[2], a[6], a[7]), (a[0], a[3], a[7], a[4])):
        bm.faces.new(f)
    m._paint(a, "Concrete")
    m.box(-4, 0, -1.6, 1.6, 0.02, 0.03, "Coral")
    # The canopy on its legs, a teal fascia with a lilac stripe.
    for x in (-9.5, -0.5):
        for y in (-half + 0.3, half - 0.3):
            m.box(x - 0.1, x + 0.1, y - 0.1, y + 0.1, 0, 4.0, "Steel")
    m.box(-10, 0, -half, half, 4.0, 4.3, "White")
    m.box(-10.02, 0.02, -half - 0.02, half + 0.02, 4.3, 4.9, "Teal")
    m.box(-10.03, 0.03, -half - 0.03, half + 0.03, 4.55, 4.65, "Lilac")
    # The start clock on a post at the left side, facing the rider (−x).
    m.box(-0.5, -0.3, -half - 1.5, -half - 1.3, 0, 2.2, "Steel")
    m.box(-0.6, -0.3, -half - 2.1, -half - 0.7, 2.2, 3.0, "Black")
    m.box(-0.62, -0.6, -half - 1.9, -half - 0.9, 2.4, 2.8, "Amber")
    m.done("StartRamp")


def finish_arch() -> None:
    """A truss gantry over the road at the finish line, the banner facing the oncoming riders (−x), and the line itself."""
    m = Mesh()
    half = ROAD / 2 + 0.8
    for y in (-half, half):
        m.box(-0.35, 0.35, y - 0.35, y + 0.35, 0, 5.5, "Steel")
    m.box(-0.35, 0.35, -half - 0.35, half + 0.35, 5.5, 6.3, "Steel")
    m.box(-0.45, -0.35, -half + 0.4, half - 0.4, 4.6, 6.2, "White")
    m.box(-0.48, -0.45, -half + 0.6, half - 0.6, 5.1, 5.7, "Coral")
    # The finish line across the road, in checks painted on it.
    for k in range(int(ROAD / 0.5)):
        y = -ROAD / 2 + k * 0.5
        m.flat(-0.25 if k % 2 else 0.0, 0.0 if k % 2 else 0.25, y, y + 0.5, 0.02, "Black")
        m.flat(0.0 if k % 2 else -0.25, 0.25 if k % 2 else 0.0, y, y + 0.5, 0.02, "White")
    m.done("FinishArch")


def person(m: Mesh, x: float, y: float, shirt: str) -> None:
    """Someone standing: legs, a shirt and a head, as a few boxes."""
    m.box(x - 0.18, x + 0.18, y - 0.12, y + 0.12, 0, 0.85, "Black")
    m.box(x - 0.22, x + 0.22, y - 0.15, y + 0.15, 0.85, 1.5, shirt)
    m.box(x - 0.12, x + 0.12, y - 0.12, y + 0.12, 1.5, 1.78, "Skin")


def finish_crowd() -> None:
    """40 m of barriers along the road's edge (at y = 0) with people behind them, every third waving a flag."""
    m = Mesh()
    for x in range(0, 40, 4):
        m.box(x, x + 3.9, -0.05, 0.05, 0.3, 1.1, "White" if (x // 4) % 2 else "Coral")
        m.box(x + 0.1, x + 0.2, -0.3, 0.3, 0, 0.3, "Steel")
    shirts = ("Shirt1", "Shirt2", "Shirt3", "Shirt4")
    for k in range(20):
        x = 0.8 + k * 1.95
        y = 0.6 + (k % 3) * 0.55
        person(m, x, y, shirts[(k * 7) % 4])
        if k % 3 == 1:
            m.box(x - 0.02, x + 0.02, y - 0.02, y + 0.02, 1.5, 2.4, "Steel")
            m.box(x, x + 0.6, y - 0.01, y + 0.01, 2.0, 2.4, "Teal" if k % 2 else "Lilac")
    m.done("FinishCrowd")


def rig(m: Mesh, x0: float, y0: float, body: str) -> None:
    """A parked rig: a box trailer, a tractor at the front (+x) and wheels."""
    m.box(x0, x0 + 13.6, y0, y0 + 2.5, 1.2, 4.0, body)
    m.box(x0 + 14, x0 + 16.6, y0, y0 + 2.5, 0.9, 3.6, "Cab")
    m.box(x0 + 16.55, x0 + 16.62, y0 + 0.2, y0 + 2.3, 2.3, 3.2, "Glass")
    for wx in (x0 + 1.2, x0 + 2.6, x0 + 11.5, x0 + 15.6):
        for wy in (y0 - 0.05, y0 + 2.15):
            m.box(wx - 0.5, wx + 0.5, wy, wy + 0.4, 0, 1.0, "Tyre")


def fuel_depot() -> None:
    """A truck stop: a canopy on posts over two pump islands, round tanks behind and a rig parked, the road on its −y side."""
    m = Mesh()
    m.box(-2, 34, -2, 26, 0, 0.05, "Concrete")
    for x in (2, 14, 26):
        for y in (2, 12):
            m.box(x - 0.25, x + 0.25, y - 0.25, y + 0.25, 0, 6.0, "White")
    m.box(0, 28, 0, 14, 6.0, 6.6, "White")
    m.box(-0.02, 28.02, -0.02, 14.02, 6.2, 6.5, "Teal")
    for y in (4.5, 9.5):
        m.box(4, 24, y - 0.6, y + 0.6, 0.05, 0.3, "Concrete")
        for x in (7, 14, 21):
            m.box(x - 0.4, x + 0.4, y - 0.3, y + 0.3, 0.3, 2.0, "Coral")
    for k in range(3):
        m.cone(6 + k * 8, 21, 0, 7, 3, 3, 12, "Silver")
    rig(m, 4, 15.5, "White")
    m.done("FuelDepot")


def warehouse() -> None:
    """The depot at the end of the run: a long shed with a low-pitched roof, loading docks on its road side (−y) and a rig backed up."""
    m = Mesh()
    m.box(-4, 64, -14, 30, 0, 0.05, "Concrete")
    m.box(0, 60, 0, 26, 0, 10, "Wall2")
    m.roof(-0.4, 60.4, -0.4, 26.4, 10, 2.5, "Roof2")
    m.box(0, 60, -0.03, 0, 8.8, 9.6, "Teal")
    for k in range(6):
        x = 4 + k * 9
        m.box(x, x + 4, -0.05, 0, 0.9, 5.0, "Steel")
        m.box(x - 0.3, x + 4.3, -1.2, 0, 0.9, 1.2, "Concrete")
    rig(m, 21, -18, "Coral")
    m.done("Warehouse")


def preview(path: Path) -> None:
    """Lay the pieces along a stretch of road as the replay would, and shoot it from behind a rider."""
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

    plane("Grass", -300, 1500, -900, 900, 0, "C9D3B8")
    plane("Road", -300, 1500, -half, half, 0.01, "8A8F99")

    def put(name: str, x: float, y: float, turned: bool = False) -> None:
        c = o[name].copy()
        c.location = (x, y, 0)
        # A piece on the right (+y here is the left; −y the right) turns round to face the road.
        if turned:
            c.rotation_euler = (0, 0, math.pi)
        scene.collection.objects.link(c)

    o["StartRamp"].location = (0, 0, 0)
    o["FinishArch"].location = (420, 0, 0)
    o["FinishCrowd"].location = (380, half + 1.5, 0)
    put("FinishCrowd", 420, -(half + 1.5), True)
    o["Farm"].location = (150, half + 30, 0)
    o["Village"].location = (300, -(half + 40), 0)
    o["Village"].rotation_euler = (0, 0, math.pi)
    o["WindTurbine"].location = (500, half + 260, 0)
    put("WindTurbine", 650, half + 300)
    o["KmPost"].location = (100, -(half + 1.5), 0)
    o["Sign"].location = (220, -(half + 3), 0)
    o["FuelDepot"].location = (-200, half + 40, 0)
    o["Warehouse"].location = (-200, -(half + 300), 0)
    names = ("TreeRound", "TreePine", "TreeBirch")
    for k in range(60):
        side = 1 if k % 2 else -1
        x = 20 + k * 14
        if 280 < x < 340 or 130 < x < 200:
            continue
        put(names[(k * 5) % 3], x, side * (half + 9 + (k * 7) % 12))
    for n in names:
        o[n].location = (-1000, 0, 0)
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
    cam_obj.location = (-22, -3, 7)
    scene.collection.objects.link(cam_obj)
    cam_obj.rotation_euler = (Vector((80, 4, 0)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tree_round()
    tree_pine()
    tree_birch()
    km_post()
    sign()
    farm()
    village()
    wind_turbine()
    start_ramp()
    finish_arch()
    finish_crowd()
    fuel_depot()
    warehouse()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT),
        export_format="GLB",
        use_selection=False,
        export_extras=False,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_vertex_color="NONE",
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_apply=True,
        export_draco_mesh_compression_enable=False,
    )
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    if "--preview" in argv:
        preview(PREVIEW)
        print(f"wrote {PREVIEW}")
    MANIFEST.write_text(json.dumps({"inputHash": input_hash(), "blender": BLENDER}, indent=2) + "\n")
    print(f"wrote {MANIFEST}")


main()
