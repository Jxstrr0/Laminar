"""
The Lugovoy meadow's kit (PR 13v), built headless in Blender from numbers:
the drone club's field round the quads' gate course. Nobody opens the
Blender UI.

    ~/blender/blender --background --factory-startup --python art/meadow/build.py -- [--preview]

Writes public/models/meadow.glb and public/models/models.json (the hash of
every art script), and with --preview also art/meadow/preview.jpg.

The mown line and the gates stay in code (src/render/replayScene.ts), from
the course and DRONE_SCENE. These are the pieces the quad replay stands round
them, each at its own origin, built along +x (the way the quads fly). Pieces
beside the line face it across −y here (the line on their right as you
come); the scene puts them on its left, and turns them round for its right:

- TreeRound, TreePine, TreeBirch: the trees round the meadow (as the open road's).
- HayBale: a round bale on its side, cushioning the outside of a turn.
- Bunting: 12 m of pennants on a line between two poles.
- StartPads: the two launch pads across the line at the start, one each side.
- PilotTent: the pilots' gazebo: a canopy, a table, two pilots in goggles and the race screen.
- TimingTower: a scaffold tower with the lap board, facing the line.
- Spectators: 16 m of folding chairs and people watching.
- ClubHut: the club's wooden hut, its sign, a windsock (limp: races fly in still air) and three parked cars.

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
OUT = ROOT / "public" / "models" / "meadow.glb"
PREVIEW = ROOT / "art" / "meadow" / "preview.jpg"
# Pinned on purpose, the same as the other art scripts and .github/workflows/art.yml.
BLENDER = "4.5.15"


def input_hash() -> str:
    """Every art script, in path order, hashed: tests/models.test.ts works it out the same way."""
    h = hashlib.sha256()
    for path in sorted((ROOT / "art").rglob("*.py"), key=lambda p: p.relative_to(ROOT).as_posix().encode()):
        h.update(path.read_bytes())
    return h.hexdigest()[:16]


# The mown line: DRONE_SCENE.roadWidth in src/data/replay.ts; the quads race
# FLY metres over it (DRONE_SCENE.flyHeight), through gates drawn in code.
LINE = 3.0
FLY = 1.5

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
    "Hay": "D9B86A",
    "Hay2": "C4A257",
    "Canvas": "F2EFE8",
    "Screen": "3D5BFF",
    "Grass": "9DB08A",
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


# --- Shapes the road kit didn't need.


def drum(m: Mesh, x: float, y: float, z: float, r: float, length: float, sides: int, name: str) -> None:
    """A cylinder lying along y (a bale on its side), centred on (x, y, z)."""
    verts = bmesh.ops.create_cone(m.bm, cap_ends=True, cap_tris=False, segments=sides, radius1=r, radius2=r, depth=length)["verts"]
    bmesh.ops.rotate(m.bm, verts=verts, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
    bmesh.ops.translate(m.bm, vec=Vector((x, y, z)), verts=verts)
    m._paint(verts, name)


def tri(m: Mesh, a: tuple[float, float, float], b: tuple[float, float, float], c: tuple[float, float, float], name: str) -> None:
    """One flat triangle (a pennant), seen from both sides."""
    v = [m.bm.verts.new(p) for p in (a, b, c)]
    m.bm.faces.new(v)
    m._paint(v, name)


def person(m: Mesh, x: float, y: float, shirt: str, sitting: bool = False) -> None:
    """Someone standing (or sitting on a chair at y): legs, a shirt and a head, as a few boxes."""
    if sitting:
        m.box(x - 0.25, x + 0.25, y - 0.25, y + 0.25, 0.42, 0.47, "Steel")
        m.box(x - 0.18, x + 0.18, y - 0.45, y - 0.05, 0, 0.5, "Black")
        m.box(x - 0.22, x + 0.22, y - 0.12, y + 0.18, 0.47, 1.1, shirt)
        m.box(x - 0.12, x + 0.12, y - 0.1, y + 0.14, 1.1, 1.38, "Skin")
        return
    m.box(x - 0.18, x + 0.18, y - 0.12, y + 0.12, 0, 0.85, "Black")
    m.box(x - 0.22, x + 0.22, y - 0.15, y + 0.15, 0.85, 1.5, shirt)
    m.box(x - 0.12, x + 0.12, y - 0.12, y + 0.12, 1.5, 1.78, "Skin")


# --- The meadow's pieces.


def hay_bale() -> None:
    """A round bale on its side, its flat faces along the line, a darker band where the net wraps."""
    m = Mesh()
    drum(m, 0, 0.6, 0.7, 0.7, 1.2, 10, "Hay")
    drum(m, 0, 0.6, 0.7, 0.72, 0.5, 10, "Hay2")
    m.done("HayBale")


def bunting() -> None:
    """Two white poles 12 m apart and a line of pennants sagging between them, colours in turn."""
    m = Mesh()
    for x in (0, 12):
        m.cone(x, 0, 0, 3.0, 0.05, 0.04, 6, "White")
    colours = ("Coral", "Amber", "Teal", "Lilac", "SignBlue")
    for k in range(16):
        x0 = 0.35 + k * 0.72
        # The line sags: lowest midway between the poles.
        sag = lambda x: 2.9 - 0.5 * (1 - ((x - 6) / 6) ** 2)
        z0, z1 = sag(x0), sag(x0 + 0.5)
        tri(m, (x0, 0, z0), (x0 + 0.5, 0, z1), (x0 + 0.25, 0, (z0 + z1) / 2 - 0.45), colours[k % 5])
    m.done("Bunting")


def start_pads() -> None:
    """Two launch pads across the line at the start, one in each quad's lane (±0.3 m), with a white start line between."""
    m = Mesh()
    for y in (-0.3, 0.3):
        m.box(-0.25, 0.25, y - 0.27 if y < 0 else y - 0.23, y + 0.23 if y < 0 else y + 0.27, 0, 0.03, "Black")
        m.flat(-0.15, 0.15, y - 0.12, y + 0.12, 0.031, "Coral" if y > 0 else "Teal")
    m.flat(0.3, 0.42, -LINE / 2, LINE / 2, 0.02, "White")
    m.done("StartPads")


def pilot_tent() -> None:
    """The pilots' gazebo, its open front to the line (−y): four legs, a peaked canopy, a table, two seated pilots in goggles, the race screen."""
    m = Mesh()
    for x in (0, 4):
        for y in (0, 3):
            m.box(x - 0.05, x + 0.05, y - 0.05, y + 0.05, 0, 2.2, "Steel")
    m.box(-0.1, 4.1, -0.1, 3.1, 2.2, 2.45, "Teal")
    m.roof(-0.1, 4.1, -0.1, 3.1, 2.45, 0.8, "Canvas")
    m.box(0.5, 3.5, 0.5, 1.2, 0.72, 0.78, "White")
    for x in (0.5, 3.4):
        m.box(x, x + 0.06, 0.55, 1.15, 0, 0.72, "Steel")
    for x, shirt in ((1.3, "Shirt1"), (2.7, "Shirt2")):
        person(m, x, 1.75, shirt, sitting=True)
        m.box(x - 0.13, x + 0.13, 1.6, 1.66, 1.2, 1.3, "Black")
        m.box(x - 0.18, x + 0.18, 0.8, 1.1, 0.78, 0.84, "Black")
    # The race screen on its stand at the tent's side, facing the line.
    m.box(4.4, 4.5, 1.0, 1.1, 0, 1.6, "Steel")
    m.box(3.9, 5.0, 0.98, 1.02, 1.4, 2.1, "Black")
    m.box(3.95, 4.95, 0.96, 0.98, 1.45, 2.05, "Screen")
    m.done("PilotTent")


def timing_tower() -> None:
    """A scaffold tower beside the line with the lap board on top, facing the line (−y), and a chequered flag."""
    m = Mesh()
    for x in (0, 1.2):
        for y in (0.2, 1.4):
            m.box(x - 0.04, x + 0.04, y - 0.04, y + 0.04, 0, 3.4, "Silver")
    for z in (1.1, 2.2, 3.3):
        m.box(-0.05, 1.25, 0.15, 1.45, z, z + 0.08, "Silver")
    m.box(-0.4, 1.6, 0.1, 0.25, 3.4, 4.4, "Black")
    for k in range(3):
        m.box(-0.2 + k * 0.6, 0.15 + k * 0.6, 0.08, 0.1, 3.6, 4.2, "Amber")
    m.box(1.55, 1.6, 0.8, 0.85, 3.4, 5.2, "Steel")
    for i in range(4):
        for j in range(3):
            m.box(1.6, 1.62, 0.85 + i * 0.2, 1.05 + i * 0.2, 4.6 + j * 0.2, 4.8 + j * 0.2, "Black" if (i + j) % 2 else "White")
    m.done("TimingTower")


def spectators() -> None:
    """16 m of folding chairs and people watching, a cool box and a parasol, facing the line (−y)."""
    m = Mesh()
    shirts = ("Shirt1", "Shirt2", "Shirt3", "Shirt4")
    for k in range(9):
        x = 0.8 + k * 1.75
        if k % 3 == 2:
            person(m, x, 1.9, shirts[(k * 3) % 4])
        else:
            person(m, x, 1.2, shirts[(k * 5) % 4], sitting=True)
    m.box(5.2, 5.8, 0.8, 1.2, 0, 0.4, "Coral")
    m.cone(11, 1.6, 0, 2.2, 0.03, 0.03, 6, "White")
    m.cone(11, 1.6, 1.9, 2.4, 1.3, 0.05, 8, "Amber")
    m.done("Spectators")


def club_hut() -> None:
    """The club's hut, its door and sign to the line (−y), a windsock hanging limp on its mast, and three parked cars beside."""
    m = Mesh()
    m.box(0, 7, 0, 5, 0, 3, "Wood")
    m.roof(-0.4, 7.4, -0.4, 5.4, 3, 1.4, "Roof2")
    m.box(3, 4, -0.03, 0, 0, 2.1, "Teal")
    m.box(0.8, 2.2, -0.03, 0, 1.2, 2.1, "Glass")
    m.box(4.8, 6.2, -0.03, 0, 1.2, 2.1, "Glass")
    m.box(1.5, 5.5, -0.06, -0.03, 3.1, 3.6, "White")
    m.box(2.0, 5.0, -0.08, -0.06, 3.2, 3.5, "Lilac")
    # The windsock: a mast and a cone drooping, still air.
    m.cone(-2, 1, 0, 6, 0.06, 0.05, 6, "White")
    bm = m.bm
    verts = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=8, radius1=0.25, radius2=0.12, depth=1.4)["verts"]
    bmesh.ops.rotate(bm, verts=verts, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(math.radians(160), 3, "Y"))
    bmesh.ops.translate(bm, vec=Vector((-1.85, 1, 5.3)), verts=verts)
    m._paint(verts, "Coral")
    # Three hatchbacks parked nose to the hut.
    for k, body in enumerate(("Shirt1", "Silver", "Shirt3")):
        x = 9 + k * 3
        m.box(x, x + 1.8, 0.5, 4.5, 0.3, 1.0, body)
        m.box(x + 0.1, x + 1.7, 1.4, 3.6, 1.0, 1.5, "Glass")
        for wy in (1.0, 3.8):
            for wx in (x - 0.05, x + 1.6):
                m.box(wx, wx + 0.25, wy - 0.35, wy + 0.35, 0, 0.6, "Tyre")
    m.done("ClubHut")


def preview(path: Path) -> None:
    """Lay the pieces round a stretch of the mown line as the replay would, and shoot it from behind a quad."""
    scene = bpy.context.scene
    o = {ob.name: ob for ob in scene.objects}
    half = LINE / 2

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

    plane("Meadow", -200, 300, -200, 200, 0, "B9C7A2")
    plane("Line", -50, 120, -half, half, 0.01, "8FA77E")

    def put(name: str, x: float, y: float, turned: bool = False) -> None:
        c = o[name].copy()
        c.location = (x, y, 0)
        if turned:
            c.rotation_euler = (0, 0, math.pi)
        scene.collection.objects.link(c)

    o["StartPads"].location = (0, 0, 0)
    o["PilotTent"].location = (4, half + 5, 0)
    put("TimingTower", 3, -(half + 2.5), True)
    o["TimingTower"].location = (-1000, 0, 0)
    o["Spectators"].location = (20, half + 4, 0)
    o["ClubHut"].location = (-10, half + 26, 0)
    o["Bunting"].location = (40, half + 2, 0)
    put("Bunting", 64, -(half + 2), True)
    for k in range(6):
        put("HayBale", 70 + k * 2.2, -(half + 2.5 + k * 0.6), True)
    o["HayBale"].location = (-1000, 0, 0)
    names = ("TreeRound", "TreePine", "TreeBirch")
    for k in range(40):
        put(names[(k * 5) % 3], -30 + k * 6, (1 if k % 2 else -1) * (40 + (k * 7) % 15))
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
    cam_obj.location = (-6, -1, 3.2)
    scene.collection.objects.link(cam_obj)
    cam_obj.rotation_euler = (Vector((30, 3, 1.2)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tree_round()
    tree_pine()
    tree_birch()
    hay_bale()
    bunting()
    start_pads()
    pilot_tent()
    timing_tower()
    spectators()
    club_hut()

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
