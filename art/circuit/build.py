"""
The circuit's trackside (PR 13m), built headless in Blender from numbers.
Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/circuit/build.py -- [--preview]

Writes public/models/circuit.glb and public/models/models.json (the hash of
every art script), and with --preview also art/circuit/preview.jpg.

The track stays in code: each circuit's lap comes from its corners and
straights (src/data/circuits.ts), so a model of one lap would fit no other.
These are the pieces the replay stands along whichever lap is raced
(src/render/replayScene.ts), each at its own origin, built along +x (the way
the cars drive), with the track's side on −y here (+z in the game, its
right):

- StartGantry: the gantry over the start line, its start lights facing the grid.
- GridLine: the chequered line across the 12 m road.
- PitBuilding: 150 m of garages, their doors and the pit wall facing the track.
- Grandstand: 100 m of stand, rising away from the track, with a roof.
- Footbridge: a bridge over the track on two stair towers.
- Barrier: one 4 m length of steel barrier on posts.
- Kerb: one 2 m length of kerb, red then white.
- MarshalPost: a marshals' hut with its flag pole.

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
OUT = ROOT / "public" / "models" / "circuit.glb"
PREVIEW = ROOT / "art" / "circuit" / "preview.jpg"
# Pinned on purpose, the same as the other art scripts and .github/workflows/art.yml.
BLENDER = "4.5.15"


def input_hash() -> str:
    """Every art script, in path order, hashed: tests/models.test.ts works it out the same way."""
    h = hashlib.sha256()
    for path in sorted((ROOT / "art").rglob("*.py"), key=lambda p: p.relative_to(ROOT).as_posix().encode()):
        h.update(path.read_bytes())
    return h.hexdigest()[:16]


# The road: REPLAY_SCENE.car.roadWidth in src/data/replay.ts.
ROAD = 12.0

COLOURS = {
    "Concrete": "C9CFD6",
    "Wall": "EEF0F5",
    "Door": "3E4A7A",
    "DoorAlt": "4F5BD5",
    "Glass": "2C3560",
    "Roof": "5D6873",
    "Steel": "5D6873",
    "Rail": "B9C0C8",
    "Seats": "3E4A7A",
    "SeatsAlt": "4A5788",
    "Red": "D23B2F",
    "White": "F4F4F2",
    "Black": "1D242B",
    "Lamp": "FF5A4E",
    "Accent": "2E9E95",
    "Hut": "E3A23B",
    "Flag": "F2C94C",
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
    """The material for a colour name, made once: matte, the start lights glowing."""
    if name not in MATS:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = srgb(COLOURS[name])
        bsdf.inputs["Roughness"].default_value = 0.3 if name == "Glass" else 0.45 if name in ("Steel", "Rail") else 0.85
        bsdf.inputs["Metallic"].default_value = 0.4 if name in ("Steel", "Rail") else 0.0
        if name == "Lamp":
            bsdf.inputs["Emission Color"].default_value = srgb(COLOURS[name])
            bsdf.inputs["Emission Strength"].default_value = 2.0
        MATS[name] = m
    return MATS[name]


class Mesh:
    """A bmesh that collects boxes with named materials, then becomes one object."""

    def __init__(self) -> None:
        self.bm = bmesh.new()
        self.names: list[str] = []

    def box(self, x0: float, x1: float, y0: float, y1: float, z0: float, z1: float, name: str) -> None:
        """An axis-aligned box between these bounds."""
        verts = bmesh.ops.create_cube(self.bm, size=1.0)["verts"]
        bmesh.ops.scale(self.bm, vec=Vector((x1 - x0, y1 - y0, z1 - z0)), verts=verts)
        bmesh.ops.translate(self.bm, vec=Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)), verts=verts)
        if name not in self.names:
            self.names.append(name)
        idx = self.names.index(name)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = idx

    def done(self, obj_name: str) -> bpy.types.Object:
        me = bpy.data.meshes.new(obj_name)
        self.bm.to_mesh(me)
        self.bm.free()
        for n in self.names:
            me.materials.append(mat(n))
        obj = bpy.data.objects.new(obj_name, me)
        bpy.context.collection.objects.link(obj)
        return obj


def start_gantry() -> None:
    """Two pillars either side of the road and a beam across, five pairs of start lights facing back down the grid (−x)."""
    m = Mesh()
    half = ROAD / 2 + 2.0
    for y in (-half, half):
        m.box(-0.4, 0.4, y - 0.4, y + 0.4, 0, 7.6, "Steel")
    m.box(-0.6, 0.6, -half - 0.4, half + 0.4, 6.2, 7.6, "Black")
    for k in range(5):
        y = -3.2 + k * 1.6
        for z in (6.5, 7.15):
            m.box(-0.66, -0.6, y - 0.28, y + 0.28, z, z + 0.4, "Lamp")
    # A teal band along the top.
    m.box(-0.62, 0.62, -half - 0.4, half + 0.4, 7.6, 7.85, "Accent")
    m.done("StartGantry")


def grid_line() -> None:
    """The chequered line across the road, a metre deep, a hair above the tarmac."""
    m = Mesh()
    sq = 0.5
    n = int(ROAD / sq)
    for i in range(n):
        for j in range(2):
            y = -ROAD / 2 + i * sq
            m.box(j * sq, (j + 1) * sq, y, y + sq, 0, 0.012, "Black" if (i + j) % 2 else "White")
    m.done("GridLine")


def pit_building() -> None:
    """150 m of garages with the track on −y: the pit lane's wall at the front, then the doors, a glazed upper floor and a roof terrace."""
    m = Mesh()
    length = 150.0
    # The building's front is at y = 0; the pit wall stands 8 m in front of it, by the track.
    m.box(0, length, 0, 14, 0, 8, "Wall")
    m.box(0, length, 0.0, 14.0, 8.0, 8.3, "Roof")
    n = 15
    for k in range(n):
        x = k * length / n + 1.0
        m.box(x, x + length / n - 2.0, -0.05, 0.0, 0.2, 4.2, "DoorAlt" if k % 3 == 0 else "Door")
    m.box(0.5, length - 0.5, -0.05, 0.0, 5.2, 7.2, "Glass")
    # The roof terrace's rail.
    m.box(0, length, -0.05, 0.05, 8.3, 9.3, "Rail")
    # The pit wall: a low concrete wall with a fence on top.
    m.box(0, length, -8.4, -8.0, 0, 1.0, "Concrete")
    m.box(0, length, -8.25, -8.15, 1.0, 3.0, "Rail")
    m.done("PitBuilding")


def grandstand() -> None:
    """100 m of stand with the track on +y here (the right-hand side of the road): fourteen rows stepping up away from it, and a roof on posts."""
    m = Mesh()
    length = 100.0
    row, step = 0.9, 0.5
    rows = 14
    # A concrete front wall, then the rows going back (−y, away from the track).
    m.box(0, length, -0.3, 0, 0, 2.0, "Concrete")
    for r in range(rows):
        y1 = -r * row
        m.box(0, length, y1 - row, y1, 0, 2.0 + r * step, "SeatsAlt" if r % 2 else "Seats")
    back = -rows * row
    for x in (0.0, 25.0, 50.0, 75.0, 100.0):
        m.box(x - 0.2, x + 0.2, back - 0.4, back, 0, 12.0, "Steel")
    m.box(-1.0, length + 1.0, back - 0.6, 2.0, 12.0, 12.4, "Roof")
    m.done("Grandstand")


def footbridge() -> None:
    """A bridge over the track: a deck 6.5 m up, glazed sides, and a stair tower each side."""
    m = Mesh()
    half = ROAD / 2 + 7.0
    m.box(-2.0, 2.0, -half, half, 6.5, 7.0, "Concrete")
    for x in (-2.0, 1.9):
        m.box(x, x + 0.1, -half, half, 7.0, 8.4, "Glass")
    m.box(-2.1, 2.1, -half, half, 8.4, 8.6, "Roof")
    for y in (-half - 2.5, half + 2.5):
        m.box(-2.5, 2.5, y - 2.5, y + 2.5, 0, 8.6, "Wall")
    m.done("Footbridge")


def barrier() -> None:
    """One 4 m length of steel barrier: two rails on short posts."""
    m = Mesh()
    for x in (0.0, 2.0):
        m.box(x, x + 0.12, -0.06, 0.06, 0, 0.9, "Steel")
    m.box(0, 4.0, -0.03, 0.03, 0.35, 0.6, "Rail")
    m.box(0, 4.0, -0.03, 0.03, 0.65, 0.85, "Rail")
    m.done("Barrier")


def kerb() -> None:
    """One 2 m length of kerb, a metre wide, red then white."""
    m = Mesh()
    m.box(0, 1.0, -0.5, 0.5, 0, 0.06, "Red")
    m.box(1.0, 2.0, -0.5, 0.5, 0, 0.06, "White")
    m.done("Kerb")


def marshal_post() -> None:
    """A marshals' hut on a low platform, with a flag pole."""
    m = Mesh()
    m.box(-1.6, 1.6, -1.2, 1.2, 0, 0.4, "Concrete")
    m.box(-1.2, 1.2, -0.9, 0.9, 0.4, 2.8, "Hut")
    m.box(-1.4, 1.4, -1.1, 1.1, 2.8, 3.0, "Roof")
    m.box(-1.0, 1.0, -0.92, -0.9, 1.4, 2.4, "Glass")
    m.box(1.4, 1.5, -1.0, -0.9, 0.4, 4.5, "Steel")
    m.box(1.5, 2.5, -0.97, -0.93, 3.7, 4.4, "Flag")
    m.done("MarshalPost")


def preview(path: Path) -> None:
    """Lay the pieces along a straight as the replay would, and shoot it from behind the grid."""
    scene = bpy.context.scene
    o = {ob.name: ob for ob in scene.objects}
    half = ROAD / 2
    # Road and grass for the preview only.
    bm = bmesh.new()
    for (y0, y1, colour) in ((-60, -half, "8FA37E"), (-half, half, "6B737A"), (half, 60, "8FA37E")):
        f = bm.faces.new([bm.verts.new(p) for p in ((-80, y0, 0), (260, y0, 0), (260, y1, 0), (-80, y1, 0))])
        f.material_index = 0 if colour == "8FA37E" else 1
    me = bpy.data.meshes.new("Ground")
    bm.to_mesh(me)
    for colour in ("8FA37E", "6B737A"):
        gm = bpy.data.materials.new(colour)
        gm.use_nodes = True
        gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb(colour)
        me.materials.append(gm)
    ground = bpy.data.objects.new("Ground", me)
    scene.collection.objects.link(ground)
    o["PitBuilding"].location = (20, half + 10, 0)
    o["Grandstand"].location = (30, -(half + 12), 0)
    o["Footbridge"].location = (200, 0, 0)
    for k in range(40):
        for side in (-1, 1):
            b = o["Barrier"].copy()
            b.location = (-60 + k * 4 + (0 if side < 0 else 0), side * (half + 3), 0)
            scene.collection.objects.link(b)
    o["Barrier"].location = (-1000, 0, 0)
    o["Kerb"].location = (-1000, 0, 0)
    o["MarshalPost"].location = (120, -(half + 6), 0)

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
    cam_obj.location = (-14, -2, 4)
    scene.collection.objects.link(cam_obj)
    cam_obj.rotation_euler = (Vector((40, 0, 1)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    start_gantry()
    grid_line()
    pit_building()
    grandstand()
    footbridge()
    barrier()
    kerb()
    marshal_post()

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
