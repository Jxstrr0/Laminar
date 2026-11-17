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
OUT = ROOT / "public" / "models" / "skijump.glb"
PREVIEW = ROOT / "art" / "skijump" / "preview.jpg"
# Pinned on purpose, the same as the other art scripts and .github/workflows/art.yml.
BLENDER = "4.5.15"


def input_hash() -> str:
    """Every art script, in path order, hashed: tests/models.test.ts works it out the same way."""
    h = hashlib.sha256()
    for path in sorted((ROOT / "art").rglob("*.py"), key=lambda p: p.relative_to(ROOT).as_posix().encode()):
        h.update(path.read_bytes())
    return h.hexdigest()[:16]


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

COLOURS = {
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
    """The material for a colour name, made once: matte, the lamps glowing."""
    if name not in MATS:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = srgb(COLOURS[name])
        bsdf.inputs["Roughness"].default_value = 0.3 if name == "Glass" else 0.4 if name in ("Rail", "Steel") else 0.85
        bsdf.inputs["Metallic"].default_value = 0.3 if name in ("Rail", "Steel") else 0.0
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

    def index(self, name: str) -> int:
        if name not in self.names:
            self.names.append(name)
        return self.names.index(name)

    def box(self, x0: float, x1: float, y0: float, y1: float, z0: float, z1: float, name: str) -> None:
        """An axis-aligned box between these bounds."""
        verts = bmesh.ops.create_cube(self.bm, size=1.0)["verts"]
        bmesh.ops.scale(self.bm, vec=Vector((x1 - x0, y1 - y0, z1 - z0)), verts=verts)
        bmesh.ops.translate(self.bm, vec=Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)), verts=verts)
        idx = self.index(name)
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


def deck(name: str, length: float, lip: bool) -> None:
    """A length of deck running back along −x from its origin: the slab, a pair of grooves for each lane, side walls with a rail, and the red lip at the table's edge."""
    m = Mesh()
    half = DECK_WIDTH / 2
    m.box(-length, 0, -half, half, DECK_DOWN, DECK_UP, "Deck")
    for lane in LANES:
        for side in (-1, 1):
            c = lane + side * GROOVE_OFF
            m.box(-length, 0, c - GROOVE_W / 2, c + GROOVE_W / 2, DECK_UP, DECK_UP + 0.03, "Track")
    for side in (-1, 1):
        y = side * (half + 0.08)
        m.box(-length, 0, y - 0.08, y + 0.08, DECK_DOWN, DECK_UP + WALL_UP, "Wall")
        m.box(-length, 0, y - 0.05, y + 0.05, DECK_UP + WALL_UP, DECK_UP + WALL_UP + 0.06, "Rail")
    if lip:
        m.box(-0.35, 0, -half, half, DECK_UP, DECK_UP + 0.035, "Lip")
    m.done(name)


def start_house() -> None:
    """The cabin over the top of the in-run, its front on the origin, the start bar in front of it."""
    m = Mesh()
    w = DECK_WIDTH / 2 + 1.0
    m.box(-4.5, 0, -w, w, 0, 3.2, "Cabin")
    m.box(-4.8, 0.3, -w - 0.3, w + 0.3, 3.2, 3.5, "Roof")
    # A window band facing down the in-run.
    m.box(-0.02, 0.04, -w + 0.4, w - 0.4, 1.4, 2.6, "Glass")
    # The start bar across the deck, a pair of posts and the teal bar.
    for y in (-DECK_WIDTH / 2, DECK_WIDTH / 2):
        m.box(0.6, 0.75, y - 0.07, y + 0.07, 0, 1.1, "Steel")
    m.box(0.6, 0.75, -DECK_WIDTH / 2, DECK_WIDTH / 2, 0.95, 1.05, "Accent")
    m.done("StartHouse")


def judges_tower() -> None:
    """Five judges' booths up a slim tower, glazed towards the slope (−y), on four legs."""
    m = Mesh()
    for x in (-2.0, 2.0):
        for y in (-1.5, 1.5):
            m.box(x - 0.15, x + 0.15, y - 0.15, y + 0.15, 0, 6.0, "Steel")
    m.box(-2.5, 2.5, -2.0, 2.0, 6.0, 15.0, "Cabin")
    for k in range(5):
        z = 6.4 + k * 1.7
        m.box(-2.3, 2.3, -2.03, -1.97, z, z + 1.1, "Glass")
    m.box(-2.8, 2.8, -2.3, 2.3, 15.0, 15.4, "Roof")
    # A stair up the back.
    for k in range(12):
        m.box(-0.6, 0.6, 2.0 + k * 0.35, 2.35 + k * 0.35, k * 0.5, k * 0.5 + 0.12, "Steel")
    m.done("JudgesTower")


def coach_stand() -> None:
    """The coaches' platform: a timber deck on legs with a rail along its front."""
    m = Mesh()
    for x in (-3.6, 0.0, 3.6):
        for y in (-1.0, 1.0):
            m.box(x - 0.1, x + 0.1, y - 0.1, y + 0.1, 0, 3.0, "Steel")
    m.box(-4.0, 4.0, -1.25, 1.25, 3.0, 3.2, "Timber")
    m.box(-4.0, 4.0, -1.3, -1.2, 3.2, 4.2, "Rail")
    m.box(-4.0, 4.0, 1.2, 1.3, 3.2, 4.2, "Rail")
    m.done("CoachStand")


def light_mast() -> None:
    """A floodlight mast: a tall steel pole with a bank of lamps turned to the slope."""
    m = Mesh()
    m.box(-0.2, 0.2, -0.2, 0.2, 0, 24.0, "Steel")
    m.box(-1.6, 1.6, -0.5, 0.0, 23.0, 25.4, "Steel")
    for i in range(3):
        for j in range(2):
            x = -1.05 + i * 1.05
            z = 23.5 + j * 1.1
            m.box(x - 0.4, x + 0.4, -0.56, -0.5, z, z + 0.8, "Lamp")
    m.done("LightMast")


def grandstand() -> None:
    """A stand at the outrun: eight rows stepping up and back from the slope (−y), with a roof on posts."""
    m = Mesh()
    length = 30.0
    row, step = 0.9, 0.5
    for r in range(8):
        y0 = r * row
        m.box(-length / 2, length / 2, y0, y0 + row, 0, 0.6 + r * step, "SeatsAlt" if r % 2 else "Seats")
    for x in (-length / 2, -length / 6, length / 6, length / 2):
        m.box(x - 0.15, x + 0.15, 8 * row - 0.3, 8 * row, 0, 7.5, "Steel")
    m.box(-length / 2 - 0.5, length / 2 + 0.5, -0.5, 8 * row + 0.3, 7.5, 7.8, "Roof")
    m.done("Grandstand")


def fence_panel() -> None:
    """One 5 m length of the slope's safety fence, along +x from its origin: two posts and the net between."""
    m = Mesh()
    for x in (0.0, 5.0):
        m.box(x - 0.05, x + 0.05, -0.05, 0.05, 0, 1.0, "Rail")
    m.box(0.0, 5.0, -0.02, 0.02, 0.1, 0.9, "Net")
    m.done("FencePanel")


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


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    deck("Inrun", INRUN, False)
    deck("Table", TABLE, True)
    start_house()
    judges_tower()
    coach_stand()
    light_mast()
    grandstand()
    fence_panel()

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
        preview_scene()
        print(f"wrote {PREVIEW}")
    MANIFEST.write_text(json.dumps({"inputHash": input_hash(), "blender": BLENDER}, indent=2) + "\n")
    print(f"wrote {MANIFEST}")


main()
