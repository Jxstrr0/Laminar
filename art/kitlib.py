"""
Shared building blocks for the kits of parts (PR 13ao): the bike
(art/bike/build.py), the winter kit (art/winter/build.py) and the kits to
come. Not a build script itself: each kit's build.py imports it.

Every point is written in three.js terms (x forward, y up, z right) and
turned into Blender's z-up axes by `B()`; the glTF exporter turns it back.
Parts have no materials: the game gives each its colour, the same as the
body parts.
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

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "public" / "models" / "models.json"
# Pinned on purpose, the same as the other art scripts and .github/workflows/art.yml.
BLENDER = "4.5.15"


def input_hash() -> str:
    """Every art script, in path order, hashed: tests/models.test.ts works it out the same way."""
    h = hashlib.sha256()
    for path in sorted((ROOT / "art").rglob("*.py"), key=lambda p: p.relative_to(ROOT).as_posix().encode()):
        h.update(path.read_bytes())
    return h.hexdigest()[:16]


def B(p) -> tuple[float, float, float]:
    """A three.js point (x forward, y up, z right) in Blender's axes (x, y = −z, z up)."""
    return (p[0], -p[2], p[1])


def v(x: float, y: float, z: float = 0.0) -> Vector:
    return Vector((x, y, z))


# --- Building blocks ---------------------------------------------------------


def ring_verts(bm, centre: Vector, u: Vector, w: Vector, section: list[tuple[float, float]]) -> list:
    """One cross-section's vertices: each (a, b) of the section at centre + a·u + b·w."""
    return [bm.verts.new(B(centre + u * a + w * b)) for a, b in section]


def bridge(bm, loops: list[list], cap_start: bool = True, cap_end: bool = True) -> None:
    """Faces between successive loops of equal size, and a fan to close each end."""
    for la, lb in zip(loops, loops[1:]):
        n = len(la)
        for k in range(n):
            bm.faces.new((la[k], la[(k + 1) % n], lb[(k + 1) % n], lb[k]))
    for loop, cap in ((loops[0], cap_start), (loops[-1], cap_end)):
        if not cap:
            continue
        mid = Vector((0, 0, 0))
        for vert in loop:
            mid += vert.co
        c = bm.verts.new(mid / len(loop))
        n = len(loop)
        for k in range(n):
            bm.faces.new((loop[k], loop[(k + 1) % n], c))


def circle(r: float, n: int = 16) -> list[tuple[float, float]]:
    return [(r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n)) for k in range(n)]


def kamm(r: float) -> list[tuple[float, float]]:
    """A Kamm-tail tube's section, nose to +a: as deep as the code's old squashed capsule (2.2×) and as thin (0.75×), its tail cut short and rounded."""
    w = 0.75 * r
    depth = 4.4 * r
    tail = 0.5 * w
    length = depth - w - tail
    pts: list[tuple[float, float]] = []
    for k in range(9):  # the nose, a half circle
        t = -math.pi / 2 + math.pi * k / 8
        pts.append((w * math.cos(t), w * math.sin(t)))
    for k in range(1, 4):  # the top side, tapering back
        f = k / 4
        pts.append((-length * f, w + (tail - w) * f))
    for k in range(9):  # the cut tail, a small half circle
        t = math.pi / 2 + math.pi * k / 8
        pts.append((-length + tail * math.cos(t), tail * math.sin(t)))
    for k in range(3, 0, -1):
        f = k / 4
        pts.append((-length * f, -(w + (tail - w) * f)))
    shift = (length + tail - w) / 2
    return [(a + shift, b) for a, b in pts]


def side_frame(d: Vector) -> tuple[Vector, Vector]:
    """For a tube along d in the side view: u across it in the side view, facing forward (or up), and w out to the right (+z)."""
    u = v(-d.y, d.x)
    if u.x < -1e-6 or (abs(u.x) < 1e-6 and u.y < 0):
        u = -u
    return u.normalized(), v(0, 0, 1)


def tube(bm, a: Vector, b: Vector, ra: float, rb: float, shape: str = "round", rings: int = 3) -> None:
    """A straight tube from a to b, its radius running ra to rb, round or Kamm-tailed, closed at both ends."""
    d = (b - a).normalized()
    u, w = side_frame(d)
    if abs(d.z) > 0.5:  # a tube across the bike (an axle): any square frame will do
        u, w = v(1, 0), d.cross(v(1, 0)).normalized()
    loops = []
    for k in range(rings):
        f = k / (rings - 1)
        r = ra + (rb - ra) * f
        loops.append(ring_verts(bm, a.lerp(b, f), u, w, kamm(r) if shape == "kamm" else circle(r)))
    bridge(bm, loops)


def sweep(bm, path: list[Vector], radius, sides: int = 12, cap: bool = True) -> None:
    """A round tube along a path; `radius` is a number or a function of the share along it. Frames carried along so it never twists."""
    n = len(path)
    tangents = []
    for k in range(n):
        t = path[min(k + 1, n - 1)] - path[max(k - 1, 0)]
        tangents.append(t.normalized())
    ref = v(0, 0, 1) if abs(tangents[0].z) < 0.9 else v(1, 0, 0)
    u = (ref - tangents[0] * ref.dot(tangents[0])).normalized()
    loops = []
    for k in range(n):
        t = tangents[k]
        u = (u - t * u.dot(t)).normalized()
        w = t.cross(u)
        r = radius(k / (n - 1)) if callable(radius) else radius
        loops.append(ring_verts(bm, path[k], u, w, circle(r, sides)))
    bridge(bm, loops, cap, cap)


def revolve(bm, profile: list[tuple[float, float]], segments: int = 48, centre: Vector | None = None) -> None:
    """A solid of revolution round the three.js z axis (an axle) through `profile`, a closed loop of (radius, z)."""
    c = centre or v(0, 0)
    loops = []
    for s in range(segments):
        phi = 2 * math.pi * s / segments
        cs, sn = math.cos(phi), math.sin(phi)
        loops.append([bm.verts.new(B(c + v(r * cs, r * sn, z))) for r, z in profile])
    m = len(profile)
    for s in range(segments):
        la, lb = loops[s], loops[(s + 1) % segments]
        for k in range(m):
            bm.faces.new((la[k], la[(k + 1) % m], lb[(k + 1) % m], lb[k]))


def disc(bm, centre: Vector, r: float, z0: float, z1: float, segments: int = 24, inner: float = 0.0) -> None:
    """A flat disc (or ring, with `inner`) across the axle from z0 to z1."""
    if inner > 0:
        revolve(bm, [(inner, z0), (r, z0), (r, z1), (inner, z1)], segments, centre)
    else:
        revolve(bm, [(1e-4, z0), (r, z0), (r, z1), (1e-4, z1)], segments, centre)


def box(bm, centre: Vector, size: tuple[float, float, float]) -> None:
    res = bmesh.ops.create_cube(bm, size=1.0)
    for vert in res["verts"]:
        x, y, z = vert.co.x * size[0], vert.co.z * size[1], -vert.co.y * size[2]
        vert.co = Vector(B(centre + v(x, y, z)))


def finish(bm, name: str, smooth: bool = True, **extras: object) -> bpy.types.Object:
    """Weld, shade and keep this part, with any sizes the code needs as extras."""
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = smooth
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        # Smooth, but keep creases sharp where faces meet at more than 50 degrees (rim edges, cogs, the saddle's rails).
        me.set_sharp_from_angle(angle=math.radians(50))
    obj = bpy.data.objects.new(name, me)
    for k, val in extras.items():
        obj[k] = val
    bpy.context.collection.objects.link(obj)
    return obj


# --- Running a kit's script ----------------------------------------------------


def export(out: Path) -> None:
    """Every part in the scene to one .glb: shapes, normals and extras only."""
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(out),
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
    print(f"wrote {out} ({out.stat().st_size} bytes)")


def run(out: Path, preview_path: Path, build, preview) -> None:
    """Build the parts, write the .glb, the preview (with --preview) and the manifest's hash."""
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build()
    export(out)
    if "--preview" in argv:
        preview(preview_path)
        print(f"wrote {preview_path}")
    MANIFEST.write_text(json.dumps({"inputHash": input_hash(), "blender": BLENDER}, indent=2) + "\n")
    print(f"wrote {MANIFEST}")


# --- Previews ------------------------------------------------------------------


class Stage:
    """A preview: copies of the parts, coloured and placed as the game puts them together, on a pale floor."""

    COLOURS = {
        "frame": ((0.12, 0.16, 0.45, 1), 0.1),
        "black": ((0.03, 0.03, 0.035, 1), 0.1),
        "metal": ((0.45, 0.48, 0.52, 1), 0.6),
        "steel": ((0.7, 0.73, 0.76, 1), 0.85),
        "disc": ((0.2, 0.22, 0.26, 1), 0.1),
        "white": ((0.85, 0.87, 0.9, 1), 0.05),
        "teal": ((0.0, 0.45, 0.43, 1), 0.05),
        "shell": ((0.22, 0.3, 0.75, 1), 0.1),
    }

    def __init__(self) -> None:
        self.scene = bpy.context.scene
        self.mats = {}
        for k, (c, metal) in self.COLOURS.items():
            m = bpy.data.materials.new(k)
            m.use_nodes = True
            bsdf = m.node_tree.nodes["Principled BSDF"]
            bsdf.inputs["Base Color"].default_value = c
            bsdf.inputs["Roughness"].default_value = 0.4
            bsdf.inputs["Metallic"].default_value = metal
            self.mats[k] = m
        self.parts = {o.name: o for o in self.scene.objects if o.type == "MESH"}

    def place(self, name: str, colour: str, at=(0.0, 0.0, 0.0), dx: float = 0.0, rot=None, scale=None) -> bpy.types.Object:
        """A copy of a part, at a three.js point (plus dx along Blender's x), turned by Blender Euler angles."""
        src = self.parts[name]
        o = src.copy()
        o.data = src.data.copy()
        o.data.materials.clear()
        o.data.materials.append(self.mats[colour])
        o.location = Vector(B(at)) + Vector((dx, 0, 0))
        if rot is not None:
            o.rotation_euler = rot
        if scale is not None:
            o.scale = scale
        self.scene.collection.objects.link(o)
        return o

    def render(self, path: Path, centre: tuple[float, float, float], ortho: float, size: tuple[int, int], tilt: float = 84, turn: float = 6) -> None:
        """Hide the loose parts, add the floor, sun and an orthographic camera looking at `centre` (Blender axes), and render."""
        for o in list(self.parts.values()):
            bpy.data.objects.remove(o)
        floor = bpy.data.meshes.new("Floor")
        bmf = bmesh.new()
        bmesh.ops.create_grid(bmf, x_segments=1, y_segments=1, size=12)
        bmf.to_mesh(floor)
        pale = bpy.data.materials.new("Pale")
        pale.use_nodes = True
        pale.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.82, 0.84, 0.92, 1)
        floor.materials.append(pale)
        self.scene.collection.objects.link(bpy.data.objects.new("Floor", floor))
        scene = self.scene
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 48
        scene.cycles.device = "CPU"
        scene.render.image_settings.file_format = "JPEG"
        scene.render.resolution_x, scene.render.resolution_y = size
        world = bpy.data.worlds.new("World")
        world.use_nodes = True
        world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.85, 0.87, 0.95, 1)
        world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
        scene.world = world
        sun = bpy.data.lights.new("Key", "SUN")
        sun.energy = 3.5
        sun_obj = bpy.data.objects.new("Key", sun)
        sun_obj.rotation_euler = (0.7, 0.2, -0.9)
        scene.collection.objects.link(sun_obj)
        cam = bpy.data.cameras.new("Cam")
        cam.type = "ORTHO"
        cam.ortho_scale = ortho
        cam_obj = bpy.data.objects.new("Cam", cam)
        t, r = math.radians(tilt), math.radians(turn)
        back = Vector((math.sin(r) * math.sin(t), -math.cos(r) * math.sin(t), math.cos(t))) * 6
        cam_obj.location = Vector(centre) + back
        cam_obj.rotation_euler = (t, 0, r)
        scene.collection.objects.link(cam_obj)
        scene.camera = cam_obj
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
