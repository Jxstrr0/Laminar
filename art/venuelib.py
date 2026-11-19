"""
Shared building blocks for the venues' kits (PR 13as): the airfield
(art/airfield/build.py), the salt flat (art/saltflat/build.py) and the venues
polished after them. Not a build script itself: each venue's build.py
imports it.

Unlike the kits of parts (kitlib.py), a venue keeps its own colours, and
every point here is in Blender's axes: x along the course, y to the left
(three.js −z), z up. The glTF exporter turns it round.

A `Mesh` collects shapes, each with a named colour, into one object. Shapes
can be placed in a local frame (`with m.at(x, y, z, turn):`), so a parked
car or a plane can face any way. Boxes stay flat-shaded; round things
(wheels, tanks, roofs, bodies) are smooth.
"""

from __future__ import annotations

import json
import math
import sys
from contextlib import contextmanager
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

from kitlib import BLENDER, MANIFEST, input_hash

COLOURS: dict[str, str] = {
    "Tyre": "1D242B",
    "Hub": "B9C0C8",
    "Glass": "2C3560",
    "Steel": "5D6873",
    "Chrome": "C9CFD6",
    "Trunk": "6B5A4A",
    "Leaf": "7E9B6A",
    "LeafDark": "5F7D55",
    "Pine": "4F6B55",
    "Lamp": "FFF4D6",
    "Black": "1D242B",
    "White": "F4F4F2",
}
EMISSIVE = {"Lamp": 2.0}
GLOSSY = {"Glass": 0.25, "Chrome": 0.3}
METAL = {"Steel": 0.4, "Chrome": 0.7, "Rail": 0.4}


def srgb(hex_: str) -> tuple[float, float, float, float]:
    """An sRGB hex colour as Blender's linear RGBA."""
    out = []
    for i in (0, 2, 4):
        c = int(hex_[i : i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


MATS: dict[str, bpy.types.Material] = {}


def mat(name: str) -> bpy.types.Material:
    """The material for a colour name, made once: matte, glass and metal a little glossy, lamps glowing."""
    if name not in MATS:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = srgb(COLOURS[name])
        bsdf.inputs["Roughness"].default_value = GLOSSY.get(name, 0.45 if name in METAL else 0.85)
        bsdf.inputs["Metallic"].default_value = METAL.get(name, 0.0)
        if name in EMISSIVE:
            bsdf.inputs["Emission Color"].default_value = srgb(COLOURS[name])
            bsdf.inputs["Emission Strength"].default_value = EMISSIVE[name]
        MATS[name] = m
    return MATS[name]


def v(x: float, y: float, z: float = 0.0) -> Vector:
    return Vector((x, y, z))


class Mesh:
    """A bmesh that collects shapes with named colours, then becomes one object."""

    def __init__(self) -> None:
        self.bm = bmesh.new()
        self.names: list[str] = []
        self.frames: list[Matrix] = [Matrix.Identity(4)]

    # --- Frames ---------------------------------------------------------------

    @contextmanager
    def at(self, x: float = 0.0, y: float = 0.0, z: float = 0.0, turn: float = 0.0, scale: float = 1.0):
        """Build the shapes inside in a frame moved to (x, y, z), turned `turn` radians about z (from +x towards +y) and scaled."""
        local = Matrix.Translation((x, y, z)) @ Matrix.Rotation(turn, 4, "Z") @ Matrix.Scale(scale, 4)
        self.frames.append(self.frames[-1] @ local)
        try:
            yield
        finally:
            self.frames.pop()

    def vert(self, p) -> bmesh.types.BMVert:
        return self.bm.verts.new(self.frames[-1] @ Vector(p))

    def _index(self, name: str) -> int:
        if name not in self.names:
            self.names.append(name)
        return self.names.index(name)

    def face(self, verts, name: str, smooth: bool = False):
        f = self.bm.faces.new(verts)
        f.material_index = self._index(name)
        f.smooth = smooth
        return f

    # --- Shapes ---------------------------------------------------------------

    def box(self, x0: float, x1: float, y0: float, y1: float, z0: float, z1: float, name: str) -> None:
        """An axis-aligned box (in the current frame) between these bounds."""
        c = [self.vert((x, y, z)) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
        for idx in ((0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)):
            self.face([c[i] for i in idx], name)

    def poly(self, pts, name: str, smooth: bool = False) -> None:
        """One flat face through these points."""
        self.face([self.vert(p) for p in pts], name, smooth)

    def prism(self, outline: list[tuple[float, float]], z0: float, z1: float, name: str, top: str | None = None, smooth: bool = False) -> None:
        """A polygon (x, y, anticlockwise from above) raised from z0 to z1, its top in `top` if given."""
        lo = [self.vert((x, y, z0)) for x, y in outline]
        hi = [self.vert((x, y, z1)) for x, y in outline]
        n = len(outline)
        for k in range(n):
            self.face((lo[k], lo[(k + 1) % n], hi[(k + 1) % n], hi[k]), name, smooth)
        self.face(list(reversed(lo)), name)
        self.face(hi, top or name)

    def loft(self, rings: list[list], name: str, cap_start: bool = True, cap_end: bool = True, closed: bool = True, smooth: bool = True) -> None:
        """Faces between successive rings of points (equal sizes), each end closed with a flat face."""
        loops = [[self.vert(p) for p in ring] for ring in rings]
        n = len(loops[0])
        span = n if closed else n - 1
        for la, lb in zip(loops, loops[1:]):
            for k in range(span):
                self.face((la[k], la[(k + 1) % n], lb[(k + 1) % n], lb[k]), name, smooth)
        # Each end closed with one flat face (cheaper than a fan: its corners are shared).
        for loop, cap, flip in ((loops[0], cap_start, True), (loops[-1], cap_end, False)):
            if cap:
                self.face(list(reversed(loop)) if flip else loop, name)

    def cyl(self, a, b, r: float, name: str, n: int = 12, rb: float | None = None, cap: bool = True) -> None:
        """A cylinder (or cone, to radius rb) from point a to point b."""
        a, b = Vector(a), Vector(b)
        d = (b - a).normalized()
        u = d.orthogonal().normalized()
        w = d.cross(u)
        rb = r if rb is None else rb
        ring = lambda c, rr: [c + (u * math.cos(2 * math.pi * k / n) + w * math.sin(2 * math.pi * k / n)) * rr for k in range(n)]
        self.loft([ring(a, r), ring(b, rb)], name, cap, cap)

    def sphere(self, c, r: float, name: str, n: int = 8, squash: tuple[float, float, float] = (1, 1, 1)) -> None:
        """A sphere (or blob, squashed per axis) of rings from pole to pole."""
        c = Vector(c)
        rings = []
        for i in range(1, n // 2):
            t = math.pi * i / (n // 2)
            rings.append([c + Vector((math.sin(t) * math.cos(2 * math.pi * k / n) * r * squash[0], math.sin(t) * math.sin(2 * math.pi * k / n) * r * squash[1], -math.cos(t) * r * squash[2])) for k in range(n)])
        self.loft(rings, name)

    def done(self, obj_name: str) -> bpy.types.Object:
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(obj_name)
        self.bm.to_mesh(me)
        self.bm.free()
        for n in self.names:
            me.materials.append(mat(n))
        obj = bpy.data.objects.new(obj_name, me)
        bpy.context.collection.objects.link(obj)
        return obj


# --- Things a venue has many of -------------------------------------------------


def rounded(w: float, h: float, r: float, n: int = 3) -> list[tuple[float, float]]:
    """A rounded rectangle's outline, w across (y) and h high (z), centred, corners of radius r."""
    pts = []
    for cy, cz, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cy + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def wheel(m: Mesh, x: float, y: float, r: float, w: float, hub: str = "Hub", n: int = 10) -> None:
    """A wheel standing on the ground at (x, y), its axle along y: the tyre and a flat hub on each face."""
    m.cyl((x, y - w / 2, r), (x, y + w / 2, r), r, "Tyre", n)
    for s in (-1, 1):
        yy = y + s * (w / 2 + 0.005)
        ring = [(x + r * 0.55 * math.cos(2 * math.pi * k / 8), yy, r + r * 0.55 * math.sin(2 * math.pi * k / 8)) for k in range(8)]
        m.poly(ring if s < 0 else list(reversed(ring)), hub)


def car(m: Mesh, colour: str, length: float = 4.3, width: float = 1.8) -> None:
    """A parked hatchback along +x, centred on the origin: a rounded body, the glasshouse and four wheels."""
    hw = width / 2
    # Body: sections along x as (x, half-width, z bottom, z top).
    body = [(-0.5, 0.86, 0.32, 0.8), (-0.47, 0.9, 0.3, 0.95), (-0.3, 0.92, 0.28, 1.0), (0.3, 0.92, 0.28, 1.0), (0.45, 0.9, 0.3, 0.88), (0.5, 0.84, 0.34, 0.72)]
    rings = []
    for fx, hy, z0, z1 in body:
        x = fx * length
        rings.append([(x, hw * hy * cy / (width / 2), z0 + (z1 - z0) * (cz + 0.5)) for cy, cz in rounded(width, 1.0, 0.18, 2)])
    m.loft(rings, colour)
    # The glasshouse: tapering in from the waist to the roof, raked at both ends.
    glass = [(-0.42, 0.8, 1.0, 1.02), (-0.33, 0.78, 1.0, 1.42), (0.08, 0.74, 1.0, 1.45), (0.27, 0.8, 1.0, 1.02)]
    rings = []
    for fx, hy, z0, z1 in glass:
        x = fx * length
        rings.append([(x, hw * hy * (1 if k < 2 else -1) * (0.82 if k in (1, 2) else 1), z1 if k in (1, 2) else z0) for k in range(4)])
    m.loft(rings, "Glass", smooth=False)
    m.box(-0.33 * length, 0.08 * length, -hw * 0.6, hw * 0.6, 1.44, 1.47, colour)
    for wx in (-0.32 * length, 0.31 * length):
        for wy in (-hw + 0.12, hw - 0.12):
            wheel(m, wx, wy, 0.31, 0.2)


def tree(m: Mesh, x: float, y: float, h: float, kind: str = "round", leaf: str = "Leaf") -> None:
    """A tree standing at (x, y), h tall: a round broadleaf (two blobs) or a pine (stacked cones)."""
    if kind == "pine":
        m.cyl((x, y, 0), (x, y, h * 0.25), h * 0.04, "Trunk", 6)
        for k, (z0, r) in enumerate(((0.18, 0.3), (0.42, 0.24), (0.64, 0.17))):
            m.cyl((x, y, h * z0), (x, y, h * (z0 + 0.36)), h * r, "Pine", 7, rb=0.0)
        return
    m.cyl((x, y, 0), (x, y, h * 0.45), h * 0.05, "Trunk", 6)
    m.sphere((x, y, h * 0.62), h * 0.3, leaf, 8, (1, 1, 0.85))
    m.sphere((x + h * 0.12, y - h * 0.08, h * 0.8), h * 0.2, leaf, 6)


def lorry_cab(m: Mesh, x0: float, width: float, height: float, colour: str, length: float = 2.4) -> None:
    """A lorry's cab from x0 forward (+x), centred on y = 0: a rounded box, the windscreen, a grille, mirrors and the front wheels."""
    hw = width / 2
    rings = []
    for fx, top in ((0.0, height), (0.75, height), (0.92, height * 0.94), (1.0, height * 0.8)):
        rings.append([(x0 + fx * length, cy, 0.7 + (top - 0.7) * (cz + 0.5)) for cy, cz in rounded(width, 1.0, 0.12, 2)])
    m.loft(rings, colour)
    # The windscreen across the rounded upper front, the grille below.
    m.poly([(x0 + length * 0.97, -hw * 0.86, height * 0.62), (x0 + length * 0.97, hw * 0.86, height * 0.62), (x0 + length * 0.91, hw * 0.84, height * 0.9), (x0 + length * 0.91, -hw * 0.84, height * 0.9)], "Glass")
    m.box(x0 + length - 0.01, x0 + length + 0.04, -hw * 0.6, hw * 0.6, 0.9, height * 0.48, "Steel")
    # Side windows and mirrors.
    for s in (-1, 1):
        m.poly([(x0 + length * 0.55, s * (hw + 0.005), height * 0.62), (x0 + length * 0.88, s * (hw + 0.005), height * 0.62), (x0 + length * 0.86, s * (hw + 0.005), height * 0.88), (x0 + length * 0.55, s * (hw + 0.005), height * 0.88)], "Glass")
        m.box(x0 + length * 0.86, x0 + length * 0.9, s * (hw + 0.05), s * (hw + 0.3), height * 0.6, height * 0.8, "Black")
    m.box(x0 - 0.05, x0 + length + 0.08, -hw - 0.02, hw + 0.02, 0.45, 0.72, "Black")
    for s in (-1, 1):
        wheel(m, x0 + length * 0.55, s * (hw - 0.3), 0.5, 0.36)


def light_plane(m: Mesh, colour: str, trim: str = "White") -> None:
    """A parked high-wing light plane, nose along +x, on its main wheels and nose wheel: a lofted fuselage, a tapered strut-braced wing, the tail and a two-bladed prop."""
    sections = [(3.4, 0.25, 1.3, 0.1), (3.0, 0.5, 1.35, 0.5), (2.2, 0.58, 1.4, 0.75), (0.6, 0.58, 1.5, 0.82), (-0.5, 0.45, 1.55, 0.6), (-2.5, 0.22, 1.6, 0.3), (-3.6, 0.08, 1.75, 0.12)]
    rings = []
    for x, hw, zc, hh in sections:
        rings.append([(x, hw * cy / 0.5, zc + hh * cz) for cy, cz in rounded(1.0, 2.0, 0.35, 2)])
    m.loft(rings, colour)
    # The cabin's windows: windscreen and side panes.
    m.poly([(2.12, -0.36, 2.19), (2.12, 0.36, 2.19), (1.5, 0.42, 2.3), (1.5, -0.42, 2.3)], "Glass")
    for s in (-1, 1):
        side = [(1.5, s * 0.59, 1.55), (0.1, s * 0.59, 1.6), (0.1, s * 0.59, 1.98), (1.5, s * 0.59, 1.95)]
        m.poly(side if s < 0 else list(reversed(side)), "Glass")
    # The wing: on top of the cabin, tapering at the tips, with a trim stripe at each tip.
    for s in (-1, 1):
        m.loft([[(1.6, 0, 2.38), (0.0, 0, 2.43), (0.0, 0, 2.31), (1.6, 0, 2.31)], [(1.45, s * 4.6, 2.48), (0.15, s * 4.6, 2.52), (0.15, s * 4.6, 2.43), (1.45, s * 4.6, 2.43)]], colour, smooth=False)
        m.loft([[(1.45, s * 4.6, 2.48), (0.15, s * 4.6, 2.52), (0.15, s * 4.6, 2.43), (1.45, s * 4.6, 2.43)], [(1.3, s * 5.5, 2.5), (0.3, s * 5.5, 2.53), (0.3, s * 5.5, 2.46), (1.3, s * 5.5, 2.46)]], trim, smooth=False)
        m.cyl((0.9, s * 0.55, 1.0), (0.85, s * 2.8, 2.4), 0.04, "Steel", 6)
        # Main gear: a spring leg and a spatted wheel.
        m.cyl((0.4, s * 0.5, 0.9), (0.4, s * 1.2, 0.3), 0.04, "Steel", 6)
        wheel(m, 0.4, s * 1.25, 0.28, 0.16)
    # The tail: a fin and a tailplane.
    m.loft([[(-2.6, -0.05, 1.85), (-3.6, -0.05, 1.85), (-3.6, 0.05, 1.85), (-2.6, 0.05, 1.85)], [(-3.3, -0.03, 3.0), (-3.85, -0.03, 3.0), (-3.85, 0.03, 3.0), (-3.3, 0.03, 3.0)]], colour, smooth=False)
    m.box(-3.75, -3.0, -1.7, 1.7, 1.7, 1.76, colour)
    # Nose wheel, spinner and prop.
    m.cyl((3.0, 0, 0.9), (3.0, 0, 0.3), 0.04, "Steel", 6)
    wheel(m, 3.0, 0, 0.22, 0.12)
    m.cyl((3.4, 0, 1.3), (3.75, 0, 1.3), 0.22, trim, 10, rb=0.02)
    m.box(3.42, 3.48, -0.08, 0.08, 0.35, 2.25, "Black")


def fence(m: Mesh, x0: float, x1: float, y: float, h: float = 1.8, every: float = 3.0, post: str = "Steel", wire: str = "Steel") -> None:
    """A wire fence along x at y: posts every few metres and three wires."""
    k = 0
    while x0 + k * every <= x1 + 1e-6:
        x = x0 + k * every
        m.box(x - 0.04, x + 0.04, y - 0.04, y + 0.04, 0, h, post)
        k += 1
    for z in (h * 0.35, h * 0.65, h * 0.95):
        m.box(x0, x1, y - 0.01, y + 0.01, z - 0.01, z + 0.01, wire)


def lamp_mast(m: Mesh, x: float, y: float, h: float, facing: float, heads: int = 2) -> None:
    """A floodlight mast at (x, y), h tall, its heads facing `facing` radians about z."""
    m.cyl((x, y, 0), (x, y, h), 0.14, "Steel", 8, rb=0.08)
    with m.at(x, y, h, facing):
        m.box(-0.1, 0.1, -0.8, 0.8, -0.05, 0.05, "Steel")
        for k in range(heads):
            yy = -0.5 + (k / max(1, heads - 1))
            m.box(0.0, 0.25, yy - 0.25, yy + 0.25, -0.3, 0.2, "Steel")
            m.box(0.25, 0.27, yy - 0.2, yy + 0.2, -0.25, 0.15, "Lamp")


# --- Running a venue's script -----------------------------------------------------


def export(out: Path) -> None:
    """Every piece in the scene to one .glb, with its colours."""
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(out),
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
    print(f"wrote {out} ({out.stat().st_size} bytes)")


def run(out: Path, preview_path: Path, build, preview) -> None:
    """Build the pieces, write the .glb, the preview (with --preview) and the manifest's hash."""
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    build()
    export(out)
    if "--preview" in argv:
        preview(preview_path)
        print(f"wrote {preview_path}")
    MANIFEST.write_text(json.dumps({"inputHash": input_hash(), "blender": BLENDER}, indent=2) + "\n")
    print(f"wrote {MANIFEST}")
