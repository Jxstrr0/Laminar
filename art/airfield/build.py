"""
Belyanka airfield's buildings and runway furniture (PR 13o), built headless
in Blender from numbers. Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/airfield/build.py -- [--preview]

Writes public/models/airfield.glb and public/models/models.json (the hash of
every art script), and with --preview also art/airfield/preview.jpg.

The runway stays in code (AIRFIELD_SCENE.runway in src/data/replay.ts: its
length, width and centre line). These are the pieces the kit-plane replay
stands round it (src/render/replayScene.ts), each at its own origin, built
along +x (the runway's direction), facing the runway across −y here:

- Buildings: the whole field side as one piece: the apron and its taxiway,
  three hangars, the clubhouse, the control tower, parked planes and a fuel
  truck. Its origin is at the apron's runway-side corner nearest the
  runway's start.
- Threshold: the white bars across one end of the runway.
- RunwayLight: one edge light.
- Windsock: the windsock on its mast.
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
OUT = ROOT / "public" / "models" / "airfield.glb"
PREVIEW = ROOT / "art" / "airfield" / "preview.jpg"
# Pinned on purpose, the same as the other art scripts and .github/workflows/art.yml.
BLENDER = "4.5.15"


def input_hash() -> str:
    """Every art script, in path order, hashed: tests/models.test.ts works it out the same way."""
    h = hashlib.sha256()
    for path in sorted((ROOT / "art").rglob("*.py"), key=lambda p: p.relative_to(ROOT).as_posix().encode()):
        h.update(path.read_bytes())
    return h.hexdigest()[:16]


# The runway's width: AIRFIELD_SCENE.runway.width in src/data/replay.ts.
RUNWAY = 20.0
# The apron's runway-side edge is this far from the runway's centre line, and the taxiway joins the runway's edge.
APRON_OUT = 35.0

COLOURS = {
    "Concrete": "C9CFD6",
    "Taxi": "B3BCC4",
    "Yellow": "E3B23B",
    "White": "F4F4F2",
    "Hangar": "E9ECF2",
    "HangarRoof": "8A90B0",
    "Door": "6B7680",
    "Wall": "EEF0F5",
    "Glass": "2C3560",
    "Roof": "5D6873",
    "Steel": "5D6873",
    "Teal": "2E9E95",
    "Plane1": "F4F4F2",
    "Plane2": "E0695D",
    "Plane3": "4F5BD5",
    "Tyre": "1D242B",
    "Tank": "B9C0C8",
    "Cab": "3E4A7A",
    "Lamp": "FFF4D6",
    "Orange": "F07A2A",
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
    """The material for a colour name, made once: matte, the runway lights glowing."""
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


def hangar(m: "Mesh", x0: float, y0: float, width: float, depth: float, height: float) -> None:
    """A hangar: walls, a barrel roof as steps of an arc, and the big doors facing the apron (−y)."""
    m.box(x0, x0 + width, y0, y0 + depth, 0, height * 0.6, "Hangar")
    steps = 8
    rise = height * 0.4
    for k in range(steps):
        a0 = math.pi * k / steps
        a1 = math.pi * (k + 1) / steps
        # Each step of the roof spans the width between two angles of a half-circle, squashed to the rise.
        xa = x0 + width / 2 - (width / 2) * math.cos(a0)
        xb = x0 + width / 2 - (width / 2) * math.cos(a1)
        z = height * 0.6 + rise * math.sin((a0 + a1) / 2)
        m.box(xa, xb, y0, y0 + depth, height * 0.6, z, "HangarRoof")
    m.box(x0 + 2, x0 + width - 2, y0 - 0.05, y0, 0, height * 0.55, "Door")
    # A teal band over the doors.
    m.box(x0, x0 + width, y0 - 0.06, y0, height * 0.55, height * 0.6, "Teal")


def plane(m: "Mesh", x: float, y: float, colour: str) -> None:
    """A parked high-wing light plane, nose to the runway (−y)."""
    m.box(x - 0.6, x + 0.6, y - 3.5, y + 3.0, 0.6, 1.8, colour)
    m.box(x - 0.4, x + 0.4, y + 3.0, y + 6.0, 1.0, 1.6, colour)
    m.box(x - 5.5, x + 5.5, y - 2.4, y - 1.0, 1.85, 2.0, colour)
    m.box(x - 1.8, x + 1.8, y + 5.0, y + 6.0, 1.3, 1.4, colour)
    m.box(x - 0.06, x + 0.06, y + 5.0, y + 6.0, 1.4, 2.6, colour)
    m.box(x - 0.5, x + 0.5, y - 2.0, y - 1.4, 1.2, 1.8, "Glass")
    for wx in (-1.1, 1.1):
        m.box(x + wx - 0.15, x + wx + 0.15, y - 0.5, y - 0.1, 0, 0.6, "Tyre")
    m.box(x - 0.15, x + 0.15, y - 3.3, y - 2.9, 0, 0.6, "Tyre")


def buildings() -> None:
    """The field side, from the apron's runway-side corner: apron and taxiway, three hangars, the clubhouse, the tower, parked planes and a fuel truck."""
    m = Mesh()
    width = 300.0
    depth = 60.0
    # The apron, a hair above the grass, and the taxiway down to the runway's edge.
    m.box(0, width, 0, depth, 0, 0.02, "Concrete")
    m.box(width - 40, width - 22, -(APRON_OUT - RUNWAY / 2), 0, 0, 0.02, "Taxi")
    m.box(width - 31.2, width - 30.8, -(APRON_OUT - RUNWAY / 2), depth * 0.6, 0.02, 0.03, "Yellow")
    # Three hangars along the back of the apron.
    for k in range(3):
        hangar(m, 10 + k * 50, depth, 40, 30, 14)
    # The clubhouse: low, glazed towards the apron.
    m.box(170, 215, depth + 2, depth + 16, 0, 5, "Wall")
    m.box(171, 214, depth + 1.95, depth + 2, 1.2, 4.0, "Glass")
    m.box(169, 216, depth + 1, depth + 17, 5, 5.4, "Roof")
    # The control tower: a shaft and a glazed cab.
    m.box(232, 238, depth + 4, depth + 10, 0, 15, "Wall")
    m.box(230, 240, depth + 2, depth + 12, 15, 19, "Glass")
    m.box(229.5, 240.5, depth + 1.5, depth + 12.5, 19, 19.6, "Roof")
    m.box(234.8, 235.2, depth + 6.8, depth + 7.2, 19.6, 23, "Steel")
    # Planes parked on the apron, noses to the runway.
    for x, colour in ((30, "Plane1"), (60, "Plane2"), (90, "Plane3"), (130, "Plane1")):
        plane(m, x, 22, colour)
    # The fuel truck.
    m.box(150, 156, 12, 14.4, 0.6, 2.8, "Tank")
    m.box(156, 158.4, 12, 14.4, 0.6, 2.6, "Cab")
    for wx in (151.2, 157.4):
        for wy in (11.9, 14.1):
            m.box(wx - 0.45, wx + 0.45, wy, wy + 0.4, 0, 0.9, "Tyre")
    m.done("Buildings")


def threshold() -> None:
    """The white bars across the runway's start, a hair above it: eight bars, four each side of the centre line, 30 m long."""
    m = Mesh()
    bar, gap = 1.8, 0.6
    for side in (-1, 1):
        for k in range(4):
            y0 = side * (1.5 + k * (bar + gap))
            m.box(6, 36, min(y0, y0 + side * bar), max(y0, y0 + side * bar), 0, 0.015, "White")
    m.done("Threshold")


def runway_light() -> None:
    """One runway edge light: a short post and a lamp."""
    m = Mesh()
    m.box(-0.1, 0.1, -0.1, 0.1, 0, 0.35, "Steel")
    m.box(-0.18, 0.18, -0.18, 0.18, 0.35, 0.55, "Lamp")
    m.done("RunwayLight")


def windsock() -> None:
    """The windsock: a mast with the striped sock streaming along +x."""
    m = Mesh()
    m.box(-0.08, 0.08, -0.08, 0.08, 0, 6.0, "Steel")
    for k in range(5):
        r = 0.45 - k * 0.06
        m.box(0.1 + k * 0.7, 0.8 + k * 0.7, -r, r, 5.6 - r, 5.6 + r, "Orange" if k % 2 == 0 else "White")
    m.done("Windsock")


def preview(path: Path) -> None:
    """Lay the pieces by a stretch of runway as the replay would, and shoot it from the passes' camera."""
    scene = bpy.context.scene
    o = {ob.name: ob for ob in scene.objects}
    bm = bmesh.new()
    for (y0, y1, colour) in ((-400, -RUNWAY / 2, "C9D3B8"), (-RUNWAY / 2, RUNWAY / 2, "6B737A"), (RUNWAY / 2, 400, "C9D3B8")):
        f = bm.faces.new([bm.verts.new(p) for p in ((-800, y0, 0), (900, y0, 0), (900, y1, 0), (-800, y1, 0))])
        f.material_index = 0 if colour == "C9D3B8" else 1
    me = bpy.data.meshes.new("Ground")
    bm.to_mesh(me)
    for colour in ("C9D3B8", "6B737A"):
        gm = bpy.data.materials.new(colour)
        gm.use_nodes = True
        gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb(colour)
        me.materials.append(gm)
    scene.collection.objects.link(bpy.data.objects.new("Ground", me))
    o["Buildings"].location = (-350, APRON_OUT, 0)
    o["Threshold"].location = (-700, 0, 0)
    o["Windsock"].location = (100, 30, 0)
    for k in range(25):
        for side in (-1, 1):
            c = o["RunwayLight"].copy()
            c.location = (-700 + k * 60, side * (RUNWAY / 2 + 1.5), 0)
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
    cam_obj.location = (120, -25, 18)
    scene.collection.objects.link(cam_obj)
    cam_obj.rotation_euler = (Vector((-200, 60, 0)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    buildings()
    threshold()
    runway_light()
    windsock()

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
