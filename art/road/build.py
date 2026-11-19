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

PR 13at polished it with the shared venue blocks (art/venuelib.py): windows,
chimneys and a domed silo on the farm, hay bales and a tractor; chimneys,
fences and a clock on the village church; a turbine with a rounded nacelle
and tapered, twisted blades; a lattice finish gantry; a crowd of rounded
people; proper rigs with cabs; pumps with screens, a shop and lying tanks
at the truck stop; ribbed dock doors at the warehouse.
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
from venuelib import lorry_cab, rounded, run, srgb, wheel  # noqa: E402

OUT = ROOT / "public" / "models" / "road.glb"
PREVIEW = ROOT / "art" / "road" / "preview.jpg"

# A time trial's road: REPLAY_SCENE.roadWidth in src/data/replay.ts. The
# arch and the start house are built for it; the truck road scales them.
ROAD = 7.0

venuelib.COLOURS.update({
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
    "Hay": "D9B86B",
    "Tractor": "2E9E95",
    "Hub": "B9C0C8",
    "Body": "E9ECF2",
    "Slat": "8A92A6",
})


class Mesh(venuelib.Mesh):
    """The shared Mesh, with the road's own upright cones, faceted crowns and painted quads."""

    def _paint(self, verts, name: str) -> None:
        idx = self._index(name)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = idx

    def cone(self, x: float, y: float, z0: float, z1: float, r0: float, r1: float, sides: int, name: str) -> None:
        """An upright cone or cylinder (r1 = r0) from z0 to z1, centred on (x, y)."""
        self.cyl((x, y, z0), (x, y, z1), r0, name, sides, rb=r1)

    def blob(self, x: float, y: float, z: float, rx: float, ry: float, rz: float, name: str) -> None:
        """A low, faceted lump (a tree's crown): an icosahedron stretched to these radii."""
        verts = bmesh.ops.create_icosphere(self.bm, subdivisions=1, radius=1.0)["verts"]
        bmesh.ops.scale(self.bm, vec=Vector((rx, ry, rz)), verts=verts)
        bmesh.ops.translate(self.bm, vec=Vector((x, y, z)), verts=verts)
        self._paint(verts, name)

    def flat(self, x0: float, x1: float, y0: float, y1: float, z: float, name: str) -> None:
        """A flat quad facing up at height z (paint on the road)."""
        self.poly([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], name)


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
    """A house x..x+w along, y..y+d deep, with a gable roof, a chimney, a door with a step and windows on its road side (−y) and its ends."""
    m.box(x, x + w, y, y + d, 0, h, wall)
    m.roof(x - 0.3, x + w + 0.3, y - 0.3, y + d + 0.3, h, d * 0.45, roof)
    m.box(x + w * 0.78, x + w * 0.78 + 0.7, y + d * 0.6, y + d * 0.6 + 0.7, h, h + d * 0.45 + 0.6, "Concrete")
    m.box(x + w * 0.42, x + w * 0.58, y - 0.03, y, 0, 2.0, "Wood")
    m.box(x + w * 0.4, x + w * 0.6, y - 0.5, y, 0, 0.15, "Concrete")
    for wx in (x + w * 0.14, x + w * 0.7):
        m.box(wx, wx + 0.9, y - 0.03, y, h * 0.45, h * 0.45 + 0.9, "Glass")
        m.box(wx - 0.08, wx + 0.98, y - 0.08, y, h * 0.45 - 0.08, h * 0.45, "White")
    for ex in (x - 0.03, x + w):
        m.box(ex, ex + 0.03, y + d * 0.35, y + d * 0.65, h * 0.45, h * 0.45 + 0.9, "Glass")


def bale(m: Mesh, x: float, y: float) -> None:
    """A round hay bale lying on its side, axis along y."""
    m.cyl((x, y - 0.6, 0.75), (x, y + 0.6, 0.75), 0.75, "Hay", 10)


def tractor(m: Mesh, x: float, y: float) -> None:
    """A small tractor facing +x: big rear wheels, small front ones, the bonnet and a cab."""
    m.box(x - 0.4, x + 2.4, y - 0.5, y + 0.5, 0.6, 1.3, "Tractor")
    m.box(x - 0.6, x + 0.6, y - 0.6, y + 0.6, 1.3, 2.6, "Glass")
    m.box(x - 0.7, x + 0.7, y - 0.7, y + 0.7, 2.6, 2.7, "Tractor")
    for s in (-1, 1):
        wheel(m, x - 0.2, y + s * 0.85, 0.75, 0.45)
        wheel(m, x + 1.9, y + s * 0.7, 0.42, 0.28)
    m.cyl((x + 1.6, y + 0.3, 1.3), (x + 1.6, y + 0.3, 2.4), 0.06, "Black", 6)


def farm() -> None:
    """A farmhouse near the road, a red barn behind with its big doors, a silo with a domed cap, hay bales, a tractor and a fence along the road side."""
    m = Mesh()
    house(m, 0, 0, 9, 7, 4.2, "Wall", "Roof")
    m.box(14, 30, 6, 18, 0, 6, "Barn")
    m.roof(13.6, 30.4, 5.6, 18.4, 6, 4.5, "Roof2")
    m.box(19, 25, 5.97, 6.0, 0, 4.5, "White")
    m.box(19.2, 24.8, 5.95, 5.97, 0.2, 4.3, "Barn")
    m.poly([(19.2, 5.94, 0.2), (19.4, 5.94, 0.2), (24.8, 5.94, 4.1), (24.6, 5.94, 4.3)], "White")
    m.box(21.2, 22.8, 5.97, 6.0, 7.2, 8.2, "White")
    m.cone(34, 12, 0, 13, 2.6, 2.6, 12, "Silver")
    m.sphere((34, 12, 13), 2.65, "Steel", 12, (1, 1, 0.55))
    for k in range(4):
        m.cone(34, 12, 2 + k * 3, 2.15 + k * 3, 2.66, 2.66, 12, "Steel")
    m.box(36.4, 36.7, 11.7, 12.3, 0, 13, "Steel")
    for k, (bx, by) in enumerate(((6, 13), (7.8, 13.4), (6.9, 15.2), (11, 22), (12.8, 22.3))):
        bale(m, bx, by)
    tractor(m, 2, 11)
    # A post-and-rail fence along the road side.
    for x in range(-6, 40, 4):
        m.box(x - 0.08, x + 0.08, -4.08, -3.92, 0, 1.2, "Wood")
    m.box(-6, 38, -4.05, -3.95, 0.9, 1.0, "Wood")
    m.box(-6, 38, -4.05, -3.95, 0.45, 0.55, "Wood")
    m.done("Farm")


def village() -> None:
    """A few houses either side of a lane, with picket fences, round a church with a tower, a clock and a spire."""
    m = Mesh()
    spots = ((0, 0, 8, 6, 4.5, "Wall", "Roof"), (11, 1, 7, 6, 5.2, "Wall2", "Roof2"), (21, 0, 9, 7, 4.8, "Wall", "Roof"),
             (2, 16, 7, 6, 4.4, "Wall2", "Roof"), (24, 17, 8, 6, 5.0, "Wall", "Roof2"))
    for x, y, w, d, h, wall, roof in spots:
        house(m, x, y, w, d, h, wall, roof)
    # Picket fences along the front gardens.
    for x0, x1 in ((-1, 9), (20, 31)):
        m.box(x0, x1, -2.05, -1.95, 0.55, 0.65, "White")
        for k in range(int(x1 - x0) + 1):
            px = x0 + k
            m.box(px - 0.04, px + 0.04, -2.04, -1.96, 0, 0.9, "White")
    # The church: a nave with tall windows, and a square tower with a clock and a spire.
    m.box(10, 22, 13, 21, 0, 7, "White")
    m.roof(9.6, 22.4, 12.6, 21.4, 7, 4, "Roof2")
    for k in range(4):
        wx = 12 + k * 2.6
        m.box(wx, wx + 0.8, 12.97, 13.0, 2.0, 5.2, "Glass")
    m.box(6.5, 10, 15, 19, 0, 15, "White")
    m.box(6.4, 10.1, 14.9, 19.1, 11, 12, "Wood")
    m.cyl((8.25, 14.88, 13.4), (8.25, 14.85, 13.4), 0.9, "Black", 12)
    m.cyl((8.25, 14.86, 13.4), (8.25, 14.82, 13.4), 0.75, "White", 12)
    m.box(6.7, 7.5, 14.97, 15.0, 6.0, 9.0, "Glass")
    m.cone(8.25, 17, 15, 22, 2.5, 0.05, 4, "Roof2")
    m.cyl((8.25, 17, 22), (8.25, 17, 23.2), 0.05, "Steel", 4)
    m.done("Village")


def wind_turbine() -> None:
    """A wind turbine: a tapered round tower, a rounded nacelle facing the oncoming road (−x) with its spinner, and three still blades that taper and twist."""
    m = Mesh()
    m.cone(0, 0, 0, 60, 1.8, 1.0, 14, "White")
    m.cone(0, 0, 0, 1.2, 2.6, 2.6, 14, "Concrete")
    rings = [[(x, 1.4 * cy / 1.4, 60.8 + cz) for cy, cz in rounded(2.4 * f, 3.0 * f, 0.9 * f, 2)] for x, f in ((5.0, 0.7), (4.2, 0.95), (-1.5, 1.0), (-2.6, 0.85))]
    m.loft(rings, "White")
    hub = Vector((-3.1, 0, 60.8))
    m.cyl(hub, hub + Vector((-2.2, 0, 0)), 1.0, "White", 12, rb=0.15)
    for k in range(3):
        a = math.radians(90 + 120 * k)
        out = Vector((0, math.cos(a), math.sin(a)))
        side = Vector((0, -math.sin(a), math.cos(a)))
        loops = []
        for t in (0.03, 0.1, 0.3, 0.6, 0.85, 1.0):
            r = 1.0 + 26 * t
            chord = 2.6 * (1 - t) ** 0.7 + 0.35 if t > 0.08 else 1.2
            twist = math.radians(18 * (1 - t))
            fwd = Vector((-math.sin(twist), 0, 0)) + side * math.cos(twist)
            thick = Vector((math.cos(twist), 0, 0)) + side * math.sin(twist)
            c = hub + Vector((-0.6, 0, 0)) + out * r
            sec = [(-0.3, 0.0), (0.0, 0.12), (0.7, 0.0), (0.0, -0.08)]
            loops.append([c + fwd * (u * chord) + thick * (w * chord) for u, w in sec])
        m.loft(loops, "White", cap_start=False)
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
    """A lattice truss gantry over the road at the finish line, the banner facing the oncoming riders (−x), the clock on top and the line itself."""
    m = Mesh()
    half = ROAD / 2 + 0.8
    t = 0.35

    def truss(a: Vector, b: Vector, n: int) -> None:
        """A square lattice truss of four chords from a to b, braced with zigzags on each face."""
        d = (b - a)
        u = d.orthogonal().normalized() * t
        w = d.normalized().cross(u)
        corners = [u + w, u - w, -u - w, -u + w]
        for c in corners:
            m.cyl(a + c, b + c, 0.05, "Steel", 6, cap=False)
        for k in range(n):
            p0, p1 = a + d * (k / n), a + d * ((k + 1) / n)
            for i in range(4):
                c0, c1 = corners[i], corners[(i + 1) % 4]
                m.cyl(p0 + (c0 if k % 2 == 0 else c1), p1 + (c1 if k % 2 == 0 else c0), 0.025, "Steel", 4, cap=False)

    for y in (-half, half):
        truss(Vector((0, y, 0)), Vector((0, y, 5.9)), 8)
        m.box(-0.5, 0.5, y - 0.5, y + 0.5, 0, 0.12, "Steel")
    truss(Vector((0, -half - t, 5.9)), Vector((0, half + t, 5.9)), 10)
    m.box(-0.5, -0.4, -half + 0.4, half - 0.4, 4.5, 5.6, "White")
    m.box(-0.53, -0.5, -half + 0.6, half - 0.6, 4.75, 5.35, "Coral")
    m.box(-0.3, 0.3, -1.0, 1.0, 6.25, 7.1, "Black")
    m.box(-0.32, -0.3, -0.85, 0.85, 6.35, 7.0, "Amber")
    # The finish line across the road, in checks painted on it.
    for k in range(int(ROAD / 0.5)):
        y = -ROAD / 2 + k * 0.5
        m.flat(-0.25 if k % 2 else 0.0, 0.0 if k % 2 else 0.25, y, y + 0.5, 0.02, "Black")
        m.flat(0.0 if k % 2 else -0.25, 0.25 if k % 2 else 0.0, y, y + 0.5, 0.02, "White")
    m.done("FinishArch")


def person(m: Mesh, x: float, y: float, shirt: str, tall: float = 1.0) -> None:
    """Someone standing: legs, a rounded body, arms and a head."""
    h = tall
    m.cyl((x, y, 0), (x, y, 0.85 * h), 0.17, "Black", 6, cap=False)
    m.cyl((x, y, 0.85 * h), (x, y, 1.45 * h), 0.22, shirt, 7, rb=0.19)
    for s in (-1, 1):
        m.cyl((x, y + s * 0.24, 1.42 * h), (x - 0.05, y + s * 0.27, 0.95 * h), 0.06, shirt, 4, cap=False)
    m.sphere((x, y, 1.62 * h), 0.14, "Skin", 8)


def finish_crowd() -> None:
    """40 m of barriers along the road's edge (at y = 0) with people behind them, every third waving a flag."""
    m = Mesh()
    for x in range(0, 40, 4):
        m.box(x, x + 3.9, -0.05, 0.05, 0.3, 1.1, "White" if (x // 4) % 2 else "Coral")
        m.box(x + 0.1, x + 0.2, -0.3, 0.3, 0, 0.3, "Steel")
        m.box(x + 3.7, x + 3.8, -0.3, 0.3, 0, 0.3, "Steel")
    shirts = ("Shirt1", "Shirt2", "Shirt3", "Shirt4")
    for k in range(20):
        x = 0.8 + k * 1.95
        y = 0.6 + (k % 3) * 0.55
        person(m, x, y, shirts[(k * 7) % 4], 0.92 + 0.1 * ((k * 5) % 3) / 2)
        if k % 3 == 1:
            m.cyl((x + 0.05, y - 0.3, 1.4), (x + 0.05, y - 0.3, 2.4), 0.02, "Steel", 4)
            m.box(x + 0.05, x + 0.65, y - 0.31, y - 0.29, 2.0, 2.4, "Teal" if k % 2 else "Lilac")
    m.done("FinishCrowd")


def rig(m: Mesh, x0: float, y0: float, body: str) -> None:
    """A parked rig along +x from (x0, y0) (its left side at y0): a rounded box trailer, the tractor unit with its cab at the front, and wheels."""
    with m.at(x0, y0 + 1.25, 0):
        m.loft([[(x, cy, 2.6 + cz) for cy, cz in rounded(2.5, 2.8, 0.12, 2)] for x in (0.0, 13.6)], body)
        m.box(0.5, 15.0, -1.05, 1.05, 0.55, 1.2, "Black")
        for wx in (1.2, 2.5, 3.8, 14.2):
            for s in (-1, 1):
                wheel(m, wx, s * 0.95, 0.5, 0.36)
        lorry_cab(m, 14.0, 2.5, 3.6, "Cab", 2.6)


def fuel_depot() -> None:
    """A truck stop: a canopy on posts over two pump islands with their screens, a shop with a glazed front, lying tanks on saddles behind and a rig parked, the road on its −y side."""
    m = Mesh()
    m.box(-2, 34, -2, 26, 0, 0.05, "Concrete")
    for x in (2, 14, 26):
        for y in (2, 12):
            m.cyl((x, y, 0), (x, y, 6.0), 0.25, "White", 8)
    m.box(0, 28, 0, 14, 6.0, 6.6, "White")
    m.box(-0.02, 28.02, -0.02, 14.02, 6.2, 6.5, "Teal")
    m.box(0.5, 27.5, 0.5, 13.5, 5.98, 6.0, "Lamp")
    for y in (4.5, 9.5):
        m.box(4, 24, y - 0.6, y + 0.6, 0.05, 0.3, "Concrete")
        for x in (7, 14, 21):
            m.box(x - 0.4, x + 0.4, y - 0.3, y + 0.3, 0.3, 2.0, "Coral")
            m.box(x - 0.3, x + 0.3, y - 0.32, y - 0.3, 1.3, 1.8, "Black")
            m.box(x - 0.42, x + 0.42, y - 0.32, y + 0.32, 2.0, 2.1, "White")
    # The shop at the forecourt's end.
    m.box(30, 40, 0, 10, 0, 4.2, "Wall2")
    m.box(29.6, 40.4, -0.6, 10.4, 4.2, 4.6, "Teal")
    m.box(30.5, 39.5, -0.03, 0.0, 0.3, 3.4, "Glass")
    for k in range(1, 4):
        m.box(30.5 + k * 2.25 - 0.06, 30.5 + k * 2.25 + 0.06, -0.06, -0.03, 0.3, 3.4, "Steel")
    # Lying tanks on concrete saddles.
    for k in range(3):
        ty = 19 + k * 3.6
        m.loft([[(x, ty + 1.5 * math.cos(a), 2.1 + 1.5 * math.sin(a)) for a in (2 * math.pi * j / 12 for j in range(12))] for x in (3.0, 15.0)], "Silver")
        for sx in (5, 13):
            m.box(sx - 0.4, sx + 0.4, ty - 1.2, ty + 1.2, 0, 0.9, "Concrete")
    rig(m, 17, 18.5, "White")
    m.done("FuelDepot")


def warehouse() -> None:
    """The depot at the end of the run: a long shed with a low-pitched roof, ribbed dock doors under canopies on its road side (−y), and a rig backed up."""
    m = Mesh()
    m.box(-4, 64, -14, 30, 0, 0.05, "Concrete")
    m.box(0, 60, 0, 26, 0, 10, "Wall2")
    m.roof(-0.4, 60.4, -0.4, 26.4, 10, 2.5, "Roof2")
    m.box(0, 60, -0.03, 0, 8.8, 9.6, "Teal")
    for k in range(6):
        x = 4 + k * 9
        m.box(x, x + 4, -0.05, 0, 0.9, 5.0, "Steel")
        m.box(x - 0.3, x + 4.3, -1.2, 0, 0.9, 1.2, "Concrete")
        m.box(x - 0.2, x + 4.2, -1.4, 0, 5.6, 5.8, "Steel")
        m.box(x - 0.15, x + 0.05, -0.12, 0, 0.9, 5.2, "Amber")
        m.box(x + 3.95, x + 4.15, -0.12, 0, 0.9, 5.2, "Amber")
    for k in range(6):
        x = 4 + k * 9
        for r in range(1, 4):
            z = 0.9 + r * 1.02
            m.box(x, x + 4, -0.08, -0.05, z - 0.03, z + 0.03, "Slat")
    m.box(48, 58, -0.03, 0, 1.0, 2.6, "Glass")
    with m.at(24, -1.4, 0, -math.pi / 2):
        rig(m, 0, -1.25, "Coral")
    m.done("Warehouse")


def build() -> None:
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


run(OUT, PREVIEW, build, preview)
