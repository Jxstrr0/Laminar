"""
The salt flat's camp and course furniture (PR 13n), built headless in
Blender from numbers. Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/saltflat/build.py -- [--preview]

Writes public/models/saltflat.glb and public/models/models.json (the hash of
every art script), and with --preview also art/saltflat/preview.jpg.

The course stays in code: a run-up, the timed kilometre and room to stop,
the length of each set by the car's class (src/sim/recordReplay.ts). These
are the pieces the record replay stands along it (src/render/replayScene.ts),
each at its own origin, built along +x (the way the cars run). Pieces that
stand beside the course face it across −y here (the course is on their
right as the car comes; the scene puts them on its left, and turns them
round for its right):

- TeamCamp: the team's transporter, an awning, two motorhomes and a fuel bowser.
- TimingHut: the timekeepers' trailer, with its aerial.
- TimingPost: one beam post of the timing lights, its eye across the course.
- KmBoard: a kilometre board, facing the oncoming car (−x).
- Marker: an orange post marking the course's edge.
- ViewingArea: canopies and parked cars where people watch the timed kilometre.
- RecoveryTruck: the flatbed that waits where the cars stop.

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
OUT = ROOT / "public" / "models" / "saltflat.glb"
PREVIEW = ROOT / "art" / "saltflat" / "preview.jpg"
# Pinned on purpose, the same as the other art scripts and .github/workflows/art.yml.
BLENDER = "4.5.15"


def input_hash() -> str:
    """Every art script, in path order, hashed: tests/models.test.ts works it out the same way."""
    h = hashlib.sha256()
    for path in sorted((ROOT / "art").rglob("*.py"), key=lambda p: p.relative_to(ROOT).as_posix().encode()):
        h.update(path.read_bytes())
    return h.hexdigest()[:16]


# The graded course: RECORD_SCENE.roadWidth in src/data/replay.ts.
ROAD = 16.0

COLOURS = {
    "White": "F4F4F2",
    "Body": "E9ECF2",
    "Stripe": "2E9E95",
    "Cab": "3E4A7A",
    "Glass": "2C3560",
    "Tyre": "1D242B",
    "Black": "1D242B",
    "Steel": "5D6873",
    "Canvas": "EEF0F5",
    "Coral": "E0695D",
    "Amber": "E3A23B",
    "Orange": "F07A2A",
    "Tank": "B9C0C8",
    "Lamp": "FF5A4E",
    "Car1": "4F5BD5",
    "Car2": "A88BE0",
    "Car3": "6B7680",
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


def vehicle(m: "Mesh", x0: float, length: float, y0: float, width: float, height: float, body: str, cab: bool = True) -> None:
    """A lorry or van as boxes: a body, a cab at the front (+x), and wheels."""
    cab_len = 2.4 if cab else 0.0
    m.box(x0, x0 + length - cab_len, y0, y0 + width, 0.6, height, body)
    if cab:
        m.box(x0 + length - cab_len, x0 + length, y0, y0 + width, 0.6, height * 0.75, "Cab")
        m.box(x0 + length - 0.05, x0 + length + 0.01, y0 + 0.2, y0 + width - 0.2, height * 0.45, height * 0.7, "Glass")
    for wx in (x0 + 1.2, x0 + length - 1.4):
        for wy in (y0 - 0.05, y0 + width - 0.35):
            m.box(wx - 0.5, wx + 0.5, wy, wy + 0.4, 0, 1.0, "Tyre")


def team_camp() -> None:
    """The team's camp, the course on its −y side: the transporter with its teal stripe, an awning, two motorhomes and a fuel bowser."""
    m = Mesh()
    vehicle(m, 0, 16, 2, 2.6, 4.2, "Body")
    m.box(0, 13.6, 1.98, 2.0, 2.0, 2.4, "Stripe")
    # The awning off the transporter's course side, on four posts.
    m.box(1, 12, -5, 2, 3.3, 3.45, "Canvas")
    for x in (1.2, 11.8):
        m.box(x - 0.06, x + 0.06, -5, -4.88, 0, 3.3, "Steel")
    # Tool chests under it.
    for x in (3, 6, 9):
        m.box(x, x + 1.4, -1.5, -0.8, 0, 1.0, "Coral")
    vehicle(m, 20, 9, 2, 2.4, 3.2, "White")
    vehicle(m, 31, 9, 2, 2.4, 3.2, "White")
    # The fuel bowser: a tank on a short chassis.
    m.box(42, 50, 2.2, 4.4, 0.6, 1.0, "Steel")
    m.box(42.5, 48.5, 2.3, 4.3, 1.0, 3.0, "Tank")
    m.box(48.5, 50.5, 2.2, 4.4, 0.6, 2.8, "Cab")
    m.done("TeamCamp")


def timing_hut() -> None:
    """The timekeepers' trailer, a window to the course (−y), and a mast with its aerial."""
    m = Mesh()
    m.box(0, 6, 0, 2.4, 0.4, 3.0, "Body")
    m.box(-0.2, 6.2, -0.1, 2.5, 3.0, 3.15, "Steel")
    m.box(1, 5, -0.03, 0.0, 1.5, 2.5, "Glass")
    m.box(0.3, 0.9, 1.0, 1.4, 0, 0.4, "Black")
    m.box(5.1, 5.7, 1.0, 1.4, 0, 0.4, "Black")
    m.box(6.4, 6.55, 2.0, 2.15, 0, 8.0, "Steel")
    m.box(6.2, 6.75, 1.85, 2.3, 8.0, 8.15, "Amber")
    m.done("TimingHut")


def timing_post() -> None:
    """One post of the timing lights: a striped pole with the beam's eye facing across the course (−y)."""
    m = Mesh()
    for k in range(5):
        m.box(-0.08, 0.08, -0.08, 0.08, k * 0.5, (k + 1) * 0.5, "Black" if k % 2 else "Amber")
    m.box(-0.18, 0.18, -0.3, 0.1, 0.9, 1.25, "Black")
    m.box(-0.06, 0.06, -0.32, -0.3, 1.02, 1.14, "Lamp")
    m.done("TimingPost")


def km_board() -> None:
    """A kilometre board on two legs, facing the oncoming car (−x): black and white quarters, readable at speed."""
    m = Mesh()
    for y in (-0.9, 0.9):
        m.box(-0.06, 0.06, y - 0.06, y + 0.06, 0, 1.2, "Steel")
    for i, (y0, z0) in enumerate(((-1.0, 1.2), (0.0, 1.2), (-1.0, 2.2), (0.0, 2.2))):
        m.box(-0.08, 0.0, y0, y0 + 1.0, z0, z0 + 1.0, "Black" if i in (0, 3) else "White")
    m.done("KmBoard")


def marker() -> None:
    """An orange post marking the course's edge, with a white band."""
    m = Mesh()
    m.box(-0.06, 0.06, -0.06, 0.06, 0, 0.6, "Orange")
    m.box(-0.065, 0.065, -0.065, 0.065, 0.6, 0.75, "White")
    m.box(-0.06, 0.06, -0.06, 0.06, 0.75, 1.0, "Orange")
    m.done("Marker")


def viewing_area() -> None:
    """Where people watch the timed kilometre: three canopies in a row, facing the course (−y), and parked cars behind."""
    m = Mesh()
    for k, colour in enumerate(("Coral", "Stripe", "Amber")):
        x = k * 7.0
        m.box(x, x + 5, 0, 5, 2.6, 2.75, colour)
        for px in (x + 0.1, x + 4.9):
            for py in (0.1, 4.9):
                m.box(px - 0.05, px + 0.05, py - 0.05, py + 0.05, 0, 2.6, "Steel")
        m.box(x + 1, x + 4, 3.5, 4.2, 0, 0.8, "Canvas")
    for k, colour in enumerate(("Car1", "Car2", "Car3", "Car1", "Car3")):
        x = k * 4.5
        m.box(x, x + 4.2, 8, 9.8, 0.3, 1.1, colour)
        m.box(x + 0.9, x + 3.2, 8.1, 9.7, 1.1, 1.6, "Glass")
    m.done("ViewingArea")


def recovery_truck() -> None:
    """The flatbed that waits where the cars stop: a long bed, a winch and the cab."""
    m = Mesh()
    vehicle(m, 0, 10, 0, 2.5, 3.0, "Body")
    m.box(0, 7.6, -0.05, 2.55, 1.2, 1.35, "Stripe")
    m.box(6.6, 7.4, 0.6, 1.9, 1.35, 2.4, "Steel")
    # Amber beacons on the cab.
    m.box(9.0, 9.3, 0.3, 0.6, 2.25, 2.5, "Amber")
    m.box(9.0, 9.3, 1.9, 2.2, 2.25, 2.5, "Amber")
    m.done("RecoveryTruck")


def preview(path: Path) -> None:
    """Lay the pieces by a stretch of course as the replay would, and shoot it from behind a car."""
    scene = bpy.context.scene
    o = {ob.name: ob for ob in scene.objects}
    half = ROAD / 2
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new(p) for p in ((-200, -300, 0), (800, -300, 0), (800, 300, 0), (-200, 300, 0))])
    me = bpy.data.meshes.new("Salt")
    bm.to_mesh(me)
    sm = bpy.data.materials.new("SaltMat")
    sm.use_nodes = True
    sm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb("ECE8DE")
    me.materials.append(sm)
    scene.collection.objects.link(bpy.data.objects.new("Salt", me))
    o["TeamCamp"].location = (10, half + 30, 0)
    o["TimingHut"].location = (120, half + 18, 0)
    o["TimingPost"].location = (130, half + 2, 0)
    o["KmBoard"].location = (100, half + 6, 0)
    o["ViewingArea"].location = (200, half + 50, 0)
    o["RecoveryTruck"].location = (300, -(half + 20), 0)
    o["Marker"].location = (60, half + 1, 0)
    for k in range(1, 12):
        for side in (-1, 1):
            c = o["Marker"].copy()
            c.location = (60 + k * 25, side * (half + 1), 0)
            scene.collection.objects.link(c)
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
    cam_obj.location = (-20, -4, 6)
    scene.collection.objects.link(cam_obj)
    cam_obj.rotation_euler = (Vector((60, 8, 0)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    team_camp()
    timing_hut()
    timing_post()
    km_board()
    marker()
    viewing_area()
    recovery_truck()

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
