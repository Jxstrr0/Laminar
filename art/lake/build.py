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
"""

from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "public" / "models" / "models.json"
OUT = ROOT / "public" / "models" / "lake.glb"
PREVIEW = ROOT / "art" / "lake" / "preview.jpg"
# Pinned on purpose, the same as the other art scripts and .github/workflows/art.yml.
BLENDER = "4.5.15"


def input_hash() -> str:
    """Every art script, in path order, hashed: tests/models.test.ts works it out the same way."""
    h = hashlib.sha256()
    for path in sorted((ROOT / "art").rglob("*.py"), key=lambda p: p.relative_to(ROOT).as_posix().encode()):
        h.update(path.read_bytes())
    return h.hexdigest()[:16]


# The ploughed loop: REPLAY_SCENE.roadWidth in src/data/replay.ts.
ROAD = 7.0

COLOURS = {
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


def wobble(k: int, salt: float) -> float:
    """A fixed, even spread in −1..1 for the k-th lump: the same every build."""
    return math.sin(k * 12.9898 + salt * 78.233) * 0.5 + math.sin(k * 4.1414 + salt * 3.7) * 0.5


def bundled(m: Mesh, x: float, y: float, coat: str) -> None:
    """Someone in a long winter coat and a knitted hat, standing."""
    m.box(x - 0.18, x + 0.18, y - 0.12, y + 0.12, 0, 0.6, "Black")
    m.box(x - 0.25, x + 0.25, y - 0.18, y + 0.18, 0.6, 1.5, coat)
    m.box(x - 0.12, x + 0.12, y - 0.12, y + 0.12, 1.5, 1.74, "Skin")
    m.box(x - 0.14, x + 0.14, y - 0.14, y + 0.14, 1.72, 1.86, "Hat")


def pine(m: Mesh, x: float, y: float, h: float) -> None:
    """A snowy spruce `h` tall: a trunk, three tiers of needles, the top tier's tip white."""
    m.cone(x, y, 0, h * 0.18, 0.18 * h / 8, 0.14 * h / 8, 5, "Bark")
    for k, (z0, r) in enumerate(((0.15, 0.32), (0.4, 0.25), (0.62, 0.17))):
        m.cone(x, y, h * z0, h * (z0 + 0.32), h * r, 0.04, 7, "Pine" if k % 2 else "Pine2")
    m.cone(x, y, h * 0.82, h * 1.0, h * 0.07, 0.02, 7, "Snow")


def hut(m: Mesh, x0: float, y0: float, w: float, d: float, h: float, wall: str) -> None:
    """A small hut on skids, `w` along x and `d` deep, a snowy gable roof and a stovepipe."""
    for y in (y0 + 0.2, y0 + d - 0.2):
        m.box(x0 - 0.3, x0 + w + 0.3, y - 0.08, y + 0.08, 0, 0.15, "Steel")
    m.box(x0, x0 + w, y0, y0 + d, 0.15, h, wall)
    m.roof(x0 - 0.2, x0 + w + 0.2, y0 - 0.2, y0 + d + 0.2, h, 0.9, "Snow")
    m.box(x0 + w * 0.4, x0 + w * 0.6, y0 - 0.02, y0, 0.15, h - 0.4, "Wood")
    m.cone(x0 + w * 0.8, y0 + d * 0.6, h, h + 1.3, 0.09, 0.09, 6, "Black")


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
    m.cone(0, 0, 0.7, 1.6, 0.28, 0.02, 6, "Pine")
    m.done("Broom")


def start_banner() -> None:
    """The start and finish: a pole on the outside (+y) and an arm out over the loop carrying the banner, a chequered strip on the ice below.

    One pole only: the loop starts and finishes on a corner, where a pole on the inside would stand in the next side's ice.
    """
    m = Mesh()
    half = ROAD / 2 + 1.2
    m.cone(0, half, 0, 4.8, 0.12, 0.1, 6, "Steel")
    m.box(-0.08, 0.08, -ROAD / 2, half, 4.5, 4.7, "Steel")
    m.box(-0.06, 0.06, -ROAD / 2 + 0.2, half - 0.4, 3.4, 4.4, "SignBlue")
    m.box(-0.08, 0.08, -ROAD / 2 + 0.6, half - 0.8, 3.55, 4.25, "White")
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
        m.blob(4.0 + k * 0.25, 1.9 - k * 0.1, 4.2 + k * 0.6, 0.35 + k * 0.12, 0.35 + k * 0.12, 0.3 + k * 0.1, "Smoke")
    m.box(0.6, 3.0, -1.0, -0.6, 0.4, 0.5, "Wood")
    for x in (0.7, 2.9):
        m.box(x - 0.05, x + 0.05, -0.95, -0.65, 0, 0.4, "Wood")
    bundled(m, 4.0, -1.4, "Coat1")
    bundled(m, 4.7, -1.1, "Coat3")
    # A table with a big flask of tea.
    m.box(5.6, 6.6, -1.3, -0.5, 0.75, 0.82, "Wood")
    for x in (5.7, 6.5):
        m.box(x - 0.04, x + 0.04, -1.25, -0.55, 0, 0.75, "Steel")
    m.cone(6.1, -0.9, 0.82, 1.22, 0.12, 0.12, 8, "Coral")
    m.done("WarmingHut")


def plough() -> None:
    """The little tractor that keeps the loop clear, facing +x, its blade raised at the front."""
    m = Mesh()
    m.box(0, 2.8, -0.6, 0.6, 0.5, 1.4, "Amber")
    m.box(0.2, 1.4, -0.7, 0.7, 1.4, 2.5, "Glass")
    m.box(0.1, 1.5, -0.75, 0.75, 2.5, 2.6, "Amber")
    for x, r in ((0.7, 0.6), (2.3, 0.42)):
        for y in (-0.8, 0.8):
            m.box(x - r, x + r, y - 0.18, y + 0.18, 0, 2 * r, "Tyre")
    m.box(3.1, 3.3, -1.6, 1.6, 0.3, 1.1, "Coral")
    m.done("Plough")


def crowd() -> None:
    """12 m of people in winter coats standing on the bank, facing the loop (−y), one waving a flag."""
    m = Mesh()
    coats = ("Coat1", "Coat2", "Coat3", "Coat4", "Coat5")
    for k in range(8):
        x = 0.7 + k * 1.5 + wobble(k, 4) * 0.2
        bundled(m, x, 1.2 + (k % 2) * 0.6, coats[(k * 3) % 5])
    m.cone(6.0, 1.3, 1.2, 3.0, 0.02, 0.02, 5, "Steel")
    m.box(6.0, 6.9, 1.28, 1.32, 2.4, 3.0, "Teal")
    m.done("Crowd")


def shacks() -> None:
    """Three ice-fishing shacks on skids in a loose huddle, a fisher on a stool at a hole between them."""
    m = Mesh()
    for k, (x, y, wall) in enumerate(((0, 0, "Coral"), (4.2, 1.4, "SignBlue"), (1.6, 4.0, "Amber"))):
        hut(m, x, y, 2.2, 1.8, 2.0 + 0.2 * (k % 2), wall)
    m.flat(3.0, 3.6, -1.4, -0.8, 0.02, "Glass")
    m.box(2.2, 2.5, -1.25, -0.95, 0, 0.4, "Steel")
    m.box(2.15, 2.55, -1.35, -0.85, 0.4, 1.1, "Coat5")
    m.box(2.24, 2.46, -1.2, -1.0, 1.1, 1.36, "Skin")
    m.box(2.22, 2.48, -1.22, -0.98, 1.34, 1.46, "Hat")
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


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    snowbank()
    broom()
    start_banner()
    warming_hut()
    plough()
    crowd()
    shacks()
    shore_pines()

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
