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
OUT = ROOT / "public" / "models" / "fields.glb"
PREVIEW = ROOT / "art" / "fields" / "preview.jpg"
# Pinned on purpose, the same as the other art scripts and .github/workflows/art.yml.
BLENDER = "4.5.15"


def input_hash() -> str:
    """Every art script, in path order, hashed: tests/models.test.ts works it out the same way."""
    h = hashlib.sha256()
    for path in sorted((ROOT / "art").rglob("*.py"), key=lambda p: p.relative_to(ROOT).as_posix().encode()):
        h.update(path.read_bytes())
    return h.hexdigest()[:16]


# The planes fly their lines FLY metres over the wheat (SURVEY_SCENE.flyHeight).
FLY = 40.0

COLOURS = {
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




# --- Shapes the other kits didn't need.


def drum(m: Mesh, x: float, y: float, z: float, r: float, length: float, sides: int, name: str) -> None:
    """A cylinder lying along y (a bale on its side), centred on (x, y, z)."""
    verts = bmesh.ops.create_cone(m.bm, cap_ends=True, cap_tris=False, segments=sides, radius1=r, radius2=r, depth=length)["verts"]
    bmesh.ops.rotate(m.bm, verts=verts, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
    bmesh.ops.translate(m.bm, vec=Vector((x, y, z)), verts=verts)
    m._paint(verts, name)


def rod(m: Mesh, a: tuple[float, float, float], b: tuple[float, float, float], r: float, name: str) -> None:
    """A thin four-sided rod from a to b, at any slope (a wire, a strut)."""
    va, vb = Vector(a), Vector(b)
    d = vb - va
    verts = bmesh.ops.create_cone(m.bm, cap_ends=True, cap_tris=False, segments=4, radius1=r, radius2=r, depth=d.length)["verts"]
    bmesh.ops.rotate(m.bm, verts=verts, cent=Vector((0, 0, 0)), matrix=Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix())
    bmesh.ops.translate(m.bm, vec=(va + vb) / 2, verts=verts)
    m._paint(verts, name)


def wobble(k: int, salt: float) -> float:
    """A fixed, even spread in −1..1 for the k-th lump: the same every build."""
    return math.sin(k * 12.9898 + salt * 78.233) * 0.5 + math.sin(k * 4.1414 + salt * 3.7) * 0.5


def tractor(m: Mesh, x: float, y: float) -> None:
    """A blue tractor facing +x: big back wheels, small front ones, the cab over the back axle."""
    m.box(x, x + 3.6, y - 0.7, y + 0.7, 0.7, 1.7, "Tractor")
    m.box(x + 0.2, x + 1.7, y - 0.8, y + 0.8, 1.7, 3.0, "Glass")
    m.box(x + 0.1, x + 1.8, y - 0.9, y + 0.9, 3.0, 3.1, "White")
    for wy in (y - 1.0, y + 1.0):
        drum(m, x + 0.9, wy, 0.8, 0.8, 0.5, 10, "Tyre")
        drum(m, x + 3.1, wy, 0.5, 0.5, 0.35, 8, "Tyre")


# --- The fields' pieces.


def hedge() -> None:
    """30 m of hedge along x, about 2 m wide and 2.4 m high: overlapping lumps, two greens."""
    m = Mesh()
    for k in range(7):
        x = 2.2 + k * 4.3
        m.blob(x, wobble(k, 1) * 0.3, 1.2 + wobble(k, 2) * 0.15, 2.9, 1.1, 1.25 + wobble(k, 3) * 0.2, "Hedge" if k % 2 else "Hedge2")
    m.done("Hedge")


def oak() -> None:
    """A big field oak, about 12 m tall, its crown in three lumps."""
    m = Mesh()
    m.cone(0, 0, 0, 4.2, 0.45, 0.3, 6, "Bark")
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
    """A wooden pole with its crossarm, and three wires sagging 60 m to where the next pole stands."""
    m = Mesh()
    top = 9.0
    m.cone(0, 0, 0, top, 0.15, 0.11, 6, "Wood")
    m.box(-0.08, 0.08, -1.3, 1.3, top - 0.6, top - 0.45, "Wood")
    for y in (-1.15, 0, 1.15):
        z = top - 0.45 if y else top
        m.cone(0, y, z, z + 0.3, 0.06, 0.06, 5, "White")
        # Each wire hangs in a shallow curve: lowest 1.4 m down at midspan, in six straight pieces.
        pts = [(x, y, z + 0.3 - 1.4 * (1 - ((x - 30) / 30) ** 2)) for x in range(0, 61, 10)]
        for a, b in zip(pts, pts[1:]):
            rod(m, a, b, 0.025, "Black")
    m.done("PowerSpan")


def track() -> None:
    """30 m of farm track along x, 4 m wide: two dirt ruts with grass up the middle and along the sides."""
    m = Mesh()
    m.flat(0, 30, -2.2, 2.2, 0.02, "Verge")
    for y0, y1 in ((-1.7, -0.7), (0.7, 1.7)):
        m.flat(0, 30, y0, y1, 0.03, "Dirt")
    m.done("Track")


def farmstead() -> None:
    """The co-operative's yard, about 64 by 48 m, its open side to the field (−y)."""
    m = Mesh()
    m.flat(0, 64, 0, 44, 0.03, "Concrete")
    # The big barn: red boards, a grey roof, two tall doors to the yard.
    m.box(4, 34, 14, 30, 0, 7, "Barn")
    m.roof(3.4, 34.6, 13.4, 30.6, 7, 4.2, "Roof2")
    for x in (9, 24):
        m.box(x, x + 5, 13.96, 14, 0, 5.2, "Wall")
    # The machine shed: steel posts, a shallow roof, open to the yard, a tractor parked inside.
    for x in (38, 47, 56):
        for y in (14, 28):
            m.box(x - 0.15, x + 0.15, y - 0.15, y + 0.15, 0, 6, "Steel")
    m.roof(37.5, 56.5, 13.5, 28.5, 6, 1.6, "Silver")
    tractor(m, 41, 21)
    # The farmhouse behind, white with a red roof, and two trees by it.
    m.box(6, 18, 34, 42, 0, 5.5, "Wall")
    m.roof(5.6, 18.4, 33.6, 42.4, 5.5, 3.2, "Roof")
    for k in range(3):
        m.box(7.5 + k * 3.8, 9 + k * 3.8, 33.96, 34, 1.4, 2.6, "Glass")
        m.box(7.5 + k * 3.8, 9 + k * 3.8, 33.96, 34, 3.4, 4.6, "Glass")
    m.cone(22, 40, 0, 3, 0.25, 0.2, 6, "Bark")
    m.blob(22, 40, 5.2, 3.2, 3.2, 2.8, "Leaf")
    m.cone(-3, 36, 0, 3, 0.25, 0.2, 6, "Bark")
    m.blob(-3, 36, 5.0, 2.8, 2.8, 2.6, "Hedge2")
    # Two grain bins with conical roofs, and the grain leg towering beside them.
    for x in (44, 53):
        m.cone(x, 38, 0, 10, 4, 4, 14, "Silver")
        m.cone(x, 38, 10, 12.5, 4.2, 0.4, 14, "Silver")
    m.box(48, 49.4, 37.3, 38.7, 0, 22, "Steel")
    m.box(47.4, 50, 36.7, 39.3, 22, 24, "Barn")
    for x in (44, 53):
        rod(m, (48.7, 38, 21), (x, 38, 12.3), 0.18, "Steel")
    # A pallet of feed sacks and a grain trailer in the yard.
    m.box(30, 33, 4, 7, 0, 1.2, "Hay")
    m.box(52, 60, 4, 6.6, 0.9, 2.8, "Combine")
    for x in (53.5, 58.5):
        drum(m, x, 5.3, 0.55, 0.55, 3.0, 8, "Tyre")
    m.done("Farmstead")


def combine() -> None:
    """A combine at work, heading +x: 80 m of cut stubble behind it, the cutter bar, the cab and the grain tank, a tractor and trailer alongside."""
    m = Mesh()
    m.flat(-80, 0, -5, 5, 0.03, "Stubble")
    m.box(-9, 0, -1.7, 1.7, 1.0, 4.0, "Combine")
    m.box(-7.5, -1.5, -1.6, 1.6, 4.0, 5.2, "Combine")
    m.box(-2.4, 0.3, -1.3, 1.3, 3.0, 5.4, "Glass")
    m.box(-2.6, 0.5, -1.4, 1.4, 5.4, 5.6, "White")
    m.box(0, 2.2, -4.6, 4.6, 0.3, 1.4, "Amber")
    m.box(1.4, 2.4, -4.5, 4.5, 1.0, 1.6, "Steel")
    for wy in (-1.7, 1.7):
        drum(m, -2.0, wy, 0.9, 0.9, 0.6, 10, "Tyre")
        drum(m, -8.0, wy, 0.6, 0.6, 0.4, 8, "Tyre")
    # The unloading auger swung out over the trailer, and the trailer and tractor on the stubble beside.
    rod(m, (-6, -1.7, 5.0), (-4, -8, 5.4), 0.2, "Combine")
    m.box(-9, -2, -9.4, -6.6, 1.0, 3.2, "Barn")
    for x in (-8, -3):
        drum(m, x, -8.0, 0.55, 0.55, 3.0, 8, "Tyre")
    tractor(m, -1.6, -8.0)
    m.done("Combine")


def bale_stack() -> None:
    """Round straw bales on a patch of stubble: a stack of six and a few left where they dropped."""
    m = Mesh()
    m.flat(-6, 26, -9, 9, 0.03, "Stubble")
    for k in range(4):
        drum(m, k * 1.9, 0, 0.85, 0.85, 1.4, 10, "Hay")
    for k in range(2):
        drum(m, 0.95 + k * 1.9, 0, 2.4, 0.85, 1.4, 10, "Hay2")
    for k, (x, y) in enumerate(((12, -4), (17, 3), (22, -2))):
        drum(m, x, y, 0.85, 0.85, 1.4, 10, "Hay" if k % 2 else "Hay2")
    m.done("BaleStack")


def hay_shed() -> None:
    """An open-sided hay shed, 18 by 8 m, steel posts and a red roof, half full of bales."""
    m = Mesh()
    for x in (0, 6, 12, 18):
        for y in (0, 8):
            m.box(x - 0.15, x + 0.15, y - 0.15, y + 0.15, 0, 5.5, "Steel")
    m.roof(-0.6, 18.6, -0.6, 8.6, 5.5, 1.8, "Combine")
    for k in range(5):
        for j in range(2):
            m.box(1 + k * 1.7, 2.5 + k * 1.7, 1, 7, j * 1.6, j * 1.6 + 1.5, "Hay" if (k + j) % 2 else "Hay2")
    m.done("HayShed")


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


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    hedge()
    oak()
    poplars()
    power_span()
    track()
    farmstead()
    combine()
    bale_stack()
    hay_shed()

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
