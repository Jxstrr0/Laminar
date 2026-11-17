"""
The people's body parts (PR 13q), built headless in Blender from numbers.
Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/body/build.py -- [--preview]

Writes public/models/body.glb and public/models/models.json (the hash of
every art script), and with --preview also art/body/preview.jpg.

Kelbo chose Blender parts that code still poses (17 November 2026): the
cyclist, skater, ski jumper and bobsled crew keep the joints the sim works
out for them (src/sim/pose.ts and friends), and src/render/riderFigure.ts
lays one of these smooth parts between each pair of joints instead of a
plain capsule. No materials here: the figure keeps its own colours (and the
tunnel's pressure paint), so only the shapes are exported.

Each limb and the torso run from its first joint at the origin up +z here
(three.js +y) to its second joint at `length`, round a reference `radius`;
both go into the file as extras, so the code scales a part to the joints
and thickness it is given. The front of every part is +x.

- Thigh, Shin, UpperArm, Forearm: tapered, with the muscles' shape.
- Torso: hips, a waist, the chest and rounded shoulders.
- Hand: a gloved hand, from its middle, pointing up +z.
- Head: a head with a jaw and a nose, radius 1.
- Shoe, Boot: a cycling shoe and a skating or jumping boot, nose at +x,
  their nominal box in `size` (the code's old box, so they fit the same).
- RoadHelmet: a vented road helmet with its tail, in the old helmet's unit
  space (a 0.5 m sphere cap), so the same scale fits it to the head.
- BobHelmet: a full-face sliding helmet with its chin bar, radius 1.

The game's axes (three.js): +x forward, y up, z to the right. Blender is
z-up, so here x is the same, y is three.js −z and z is up; the glTF
exporter turns it round.
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
OUT = ROOT / "public" / "models" / "body.glb"
PREVIEW = ROOT / "art" / "body" / "preview.jpg"
# Pinned on purpose, the same as the other art scripts and .github/workflows/art.yml.
BLENDER = "4.5.15"

# Round each ring this many times: smooth enough on a phone, small enough to load at once.
SIDES = 16


def input_hash() -> str:
    """Every art script, in path order, hashed: tests/models.test.ts works it out the same way."""
    h = hashlib.sha256()
    for path in sorted((ROOT / "art").rglob("*.py"), key=lambda p: p.relative_to(ROOT).as_posix().encode()):
        h.update(path.read_bytes())
    return h.hexdigest()[:16]


class Ring:
    """One cross-section: its height, its half-depth (x) and half-width (y), and how far forward its middle sits."""

    def __init__(self, z: float, rx: float, ry: float, cx: float = 0.0) -> None:
        self.z, self.rx, self.ry, self.cx = z, rx, ry, cx


def loft(bm: bmesh.types.BMesh, rings: list[Ring], sides: int = SIDES) -> None:
    """A smooth closed body through these rings, bottom to top, each end closed at a single point."""
    loops = []
    for r in rings:
        loops.append([bm.verts.new((r.cx + r.rx * math.cos(2 * math.pi * k / sides), r.ry * math.sin(2 * math.pi * k / sides), r.z)) for k in range(sides)])
    for a, b in zip(loops, loops[1:]):
        for k in range(sides):
            bm.faces.new([a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]])
    bottom = bm.verts.new((rings[0].cx, 0, rings[0].z - min(rings[0].rx, rings[0].ry) * 0.25))
    top = bm.verts.new((rings[-1].cx, 0, rings[-1].z + min(rings[-1].rx, rings[-1].ry) * 0.25))
    for k in range(sides):
        bm.faces.new([loops[0][(k + 1) % sides], loops[0][k], bottom])
        bm.faces.new([loops[-1][k], loops[-1][(k + 1) % sides], top])


def capped(profile: list[tuple[float, float, float, float]], length: float, radius: float) -> list[Ring]:
    """
    Rings for a limb: `profile` is (share of the length, depth, width, forward
    offset), all as multiples of the radius, and each end gets a rounded cap
    of its own size, so the ends meet the next part like a ball joint.
    """
    rings: list[Ring] = []
    t0, dx0, dy0, cx0 = profile[0]
    t1, dx1, dy1, cx1 = profile[-1]
    for k in range(4, 0, -1):
        a = (math.pi / 2) * k / 4
        rings.append(Ring(t0 * length - radius * min(dx0, dy0) * math.sin(a), radius * dx0 * math.cos(a), radius * dy0 * math.cos(a), radius * cx0))
    for t, dx, dy, cx in profile:
        rings.append(Ring(t * length, radius * dx, radius * dy, radius * cx))
    for k in range(1, 5):
        a = (math.pi / 2) * k / 4
        rings.append(Ring(t1 * length + radius * min(dx1, dy1) * math.sin(a), radius * dx1 * math.cos(a), radius * dy1 * math.cos(a), radius * cx1))
    # Drop the zero-size rings at the very tips: the loft closes each end at a point.
    return [r for r in rings if r.rx > 1e-4 and r.ry > 1e-4]


def finish(bm: bmesh.types.BMesh, name: str, flat: set | None = None, **extras: object) -> bpy.types.Object:
    """Weld, smooth-shade (but the `flat` faces, such as small blocks) and keep this part, with its sizes as extras for the code."""
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = not (flat and f in flat)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    for k, v in extras.items():
        obj[k] = v
    bpy.context.collection.objects.link(obj)
    return obj


# --- Limbs: lengths are SKELETON's in src/data/pose.ts (the code stretches to each sport's own), radii the capsules' old ones.


def limb(name: str, length: float, radius: float, profile: list[tuple[float, float, float, float]]) -> None:
    bm = bmesh.new()
    loft(bm, capped(profile, length, radius))
    finish(bm, name, length=length, radius=radius)


def torso() -> None:
    """Hips to shoulders: a waist, the ribcage and the shoulders rounding off, a little deeper at the chest."""
    length, radius = 0.6, 0.11
    profile = [
        (0.0, 0.95, 1.0, 0.0),
        (0.15, 0.92, 0.98, 0.0),
        (0.32, 0.82, 0.86, 0.0),
        (0.5, 0.9, 0.95, 0.04),
        (0.68, 1.02, 1.04, 0.08),
        (0.84, 0.98, 1.02, 0.05),
        (0.95, 0.85, 0.94, 0.0),
    ]
    bm = bmesh.new()
    loft(bm, capped(profile, length, radius), sides=20)
    finish(bm, "Torso", length=length, radius=radius)


def hand() -> None:
    """A gloved hand about its middle, fingers up +z, flat across y, the thumb forward."""
    radius = 0.04
    bm = bmesh.new()
    rings = [
        Ring(-0.05, 0.02, 0.025),
        Ring(-0.035, 0.026, 0.038),
        Ring(-0.005, 0.024, 0.044),
        Ring(0.025, 0.02, 0.042),
        Ring(0.045, 0.014, 0.032),
        Ring(0.056, 0.006, 0.016),
    ]
    loft(bm, rings, sides=12)
    thumb = [Ring(-0.02, 0.012, 0.012, 0.02), Ring(0.0, 0.011, 0.011, 0.034), Ring(0.018, 0.008, 0.008, 0.04)]
    loft(bm, thumb, sides=8)
    finish(bm, "Hand", radius=radius)


def head() -> None:
    """A head of radius 1 facing +x: a rounded skull, the jaw narrowing to the chin, a small nose."""
    bm = bmesh.new()
    rings = []
    for k in range(13):
        a = math.pi * k / 12
        z = -math.cos(a)
        r = math.sin(a)
        # The lower half narrows to the jaw and sits a little forward.
        jaw = 1.0 if z > -0.1 else 0.82 + 0.18 * (1 + z / 1.0)
        rings.append(Ring(z * 1.05, r * 1.0, r * 0.86 * jaw, 0.06 * max(0.0, -z)))
    loft(bm, [r for r in rings if r.rx > 1e-4], sides=20)
    nose = [Ring(-0.25, 0.08, 0.12, 0.92), Ring(-0.05, 0.12, 0.1, 0.98), Ring(0.1, 0.05, 0.08, 0.95)]
    loft(bm, nose, sides=8)
    finish(bm, "Head", radius=1.0)


def shoe() -> None:
    """A cycling shoe in the old box's room (0.24 × 0.05 × 0.08 m about its middle): a stiff sole, the upper rising behind."""
    bm = bmesh.new()
    rings = []
    # Built along +x as rings across x: each ring is a section of the shoe from heel to toe.
    stations = [(-0.12, 0.012, 0.03, 0.0), (-0.1, 0.035, 0.036, 0.008), (-0.04, 0.042, 0.04, 0.012), (0.03, 0.03, 0.04, 0.004), (0.09, 0.02, 0.034, -0.004), (0.12, 0.008, 0.02, -0.01)]
    # Lofted along z with the height across x, then turned so heel to toe runs along +x and the height is up
    # (a quarter turn about y sends a ring's −x offset up: hence −mid).
    for x, half_h, half_w, mid in stations:
        rings.append(Ring(x, half_h, half_w, -mid))
    loft(bm, rings, sides=12)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "Y"))
    for v in bm.verts:
        v.co.z = max(v.co.z, -0.025)
    finish(bm, "Shoe", size=[0.24, 0.05, 0.08])


def boot() -> None:
    """A skating or jumping boot in the old box's room (0.26 × 0.11 × 0.09 m about its middle): the foot, then the cuff up the shin."""
    bm = bmesh.new()
    rot = Matrix.Rotation(math.pi / 2, 3, "Y")
    foot = [Ring(-0.13, 0.02, 0.035, 0.0), Ring(-0.11, 0.04, 0.042, 0.0), Ring(-0.02, 0.038, 0.045, 0.0), Ring(0.07, 0.03, 0.042, 0.0), Ring(0.12, 0.02, 0.03, 0.0), Ring(0.13, 0.008, 0.016, 0.0)]
    loft(bm, foot, sides=12)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
    for v in bm.verts:
        v.co.z = max(v.co.z, -0.04) - 0.015
    cuff = bmesh.new()
    loft(cuff, [Ring(-0.03, 0.04, 0.045, -0.06), Ring(0.02, 0.045, 0.047, -0.065), Ring(0.055, 0.044, 0.046, -0.07)], sides=12)
    me = bpy.data.meshes.new("cuff")
    cuff.to_mesh(me)
    cuff.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    finish(bm, "Boot", size=[0.26, 0.11, 0.09])


def road_helmet() -> None:
    """A road helmet in the old one's unit space (inside a 0.5 sphere, cut below), with raised ribs between vents and a short tail."""
    bm = bmesh.new()
    rings = []
    n = 10
    for k in range(n + 1):
        # From the brim (a little below the middle) to the crown.
        a = -0.6 + (math.pi / 2 + 0.6) * k / n
        z = 0.5 * math.sin(a)
        r = 0.5 * math.cos(a)
        rings.append(Ring(z, r * 1.06, r, -0.04 * math.cos(a)))
    loft(bm, [r for r in rings if r.rx > 1e-4], sides=24)
    # Five ribs over the top, front to back, standing a little proud: chains of thin blocks along the shell.
    ribs: set = set()
    for y in (-0.3, -0.15, 0.0, 0.15, 0.3):
        reach = math.sqrt(0.25 - y * y) + 0.012
        pts = []
        for k in range(9):
            a = 0.3 + (math.pi - 0.6) * k / 8
            pts.append(Vector((reach * math.cos(a) * 1.06, y, reach * math.sin(a))))
        for p0, p1 in zip(pts, pts[1:]):
            seg = p1 - p0
            verts = bmesh.ops.create_cube(bm, size=1.0)["verts"]
            ribs.update(f for v in verts for f in v.link_faces)
            bmesh.ops.scale(bm, vec=Vector((seg.length * 1.15, 0.035, 0.03)), verts=verts)
            bmesh.ops.rotate(bm, verts=verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.atan2(seg.z, seg.x), 3, "Y"))
            bmesh.ops.translate(bm, vec=(p0 + p1) / 2, verts=verts)
    # The tail: a short wedge off the back, low.
    tail = [Ring(-0.12, 0.05, 0.12, -0.38), Ring(-0.02, 0.07, 0.16, -0.42), Ring(0.08, 0.04, 0.1, -0.44)]
    loft(bm, tail, sides=12)
    finish(bm, "RoadHelmet", flat=ribs)


def bob_helmet() -> None:
    """A full-face sliding helmet of radius 1: the shell, and the chin bar forward and low."""
    bm = bmesh.new()
    rings = []
    for k in range(13):
        a = math.pi * k / 12
        z = -math.cos(a)
        r = math.sin(a)
        rings.append(Ring(z, r, r * 0.96, 0.0))
    loft(bm, [r for r in rings if r.rx > 1e-4], sides=24)
    chin = [Ring(-0.75, 0.22, 0.55, 0.62), Ring(-0.6, 0.3, 0.7, 0.66), Ring(-0.42, 0.24, 0.62, 0.66)]
    loft(bm, chin, sides=16)
    finish(bm, "BobHelmet", radius=1.0)


def build() -> None:
    #                 share  depth width forward
    limb("Thigh", 0.46, 0.07, [(0.0, 1.05, 1.05, 0.0), (0.25, 1.12, 1.08, 0.08), (0.55, 1.0, 0.98, 0.06), (0.85, 0.82, 0.86, 0.0), (1.0, 0.8, 0.84, 0.0)])
    limb("Shin", 0.47, 0.05, [(0.0, 1.1, 1.05, 0.0), (0.12, 1.08, 1.05, 0.0), (0.3, 1.28, 1.1, -0.22), (0.6, 0.98, 0.9, -0.08), (0.88, 0.7, 0.72, 0.0), (1.0, 0.72, 0.74, 0.0)])
    limb("UpperArm", 0.3, 0.05, [(0.0, 1.15, 1.2, 0.0), (0.2, 1.12, 1.1, 0.0), (0.55, 1.0, 0.94, 0.0), (0.9, 0.86, 0.86, 0.0), (1.0, 0.86, 0.86, 0.0)])
    limb("Forearm", 0.34, 0.045, [(0.0, 0.98, 0.98, 0.0), (0.22, 1.14, 1.12, 0.0), (0.6, 0.92, 0.9, 0.0), (0.92, 0.7, 0.78, 0.0), (1.0, 0.68, 0.76, 0.0)])
    torso()
    hand()
    head()
    shoe()
    boot()
    road_helmet()
    bob_helmet()


def preview(path: Path) -> None:
    """The parts in a row on a light floor, to look over."""
    scene = bpy.context.scene
    grey = bpy.data.materials.new("Grey")
    grey.use_nodes = True
    grey.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.25, 0.3, 0.55, 1)
    x = 0.0
    for ob in list(scene.objects):
        if ob.type != "MESH":
            continue
        ob.data.materials.append(grey)
        dims = ob.dimensions
        scale = 0.3 if ob.name in ("Head", "BobHelmet") else 1.0
        ob.scale = (scale, scale, scale)
        ob.location = (x, 0, 0.1)
        x += max(dims.x, dims.y) * scale + 0.15
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.device = "CPU"
    scene.render.image_settings.file_format = "JPEG"
    scene.render.resolution_x, scene.render.resolution_y = 1200, 500
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.85, 0.87, 0.95, 1)
    scene.world = world
    sun = bpy.data.lights.new("Key", "SUN")
    sun.energy = 3.0
    sun_obj = bpy.data.objects.new("Key", sun)
    sun_obj.rotation_euler = (0.6, 0.3, -0.8)
    scene.collection.objects.link(sun_obj)
    cam = bpy.data.cameras.new("Cam")
    cam.type = "ORTHO"
    cam.ortho_scale = x + 0.2
    cam_obj = bpy.data.objects.new("Cam", cam)
    cam_obj.location = (x / 2 - 0.1, -3, 0.45)
    cam_obj.rotation_euler = (math.radians(85), 0, 0)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT),
        export_format="GLB",
        use_selection=False,
        export_extras=True,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_materials="NONE",
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
