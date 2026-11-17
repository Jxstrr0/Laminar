"""
The university tunnel's test section, built headless in Blender (PR 13b).
Nobody opens the Blender UI: this script makes every piece from numbers.

    ~/blender/blender --background --factory-startup --python art/tunnel/build.py -- [--preview]

Writes public/models/tunnel-university.glb and public/models/models.json
(the hash of every art script, so a test can tell the model is out of date),
and with --preview also art/tunnel/preview.jpg (committed, so the look can be
checked on GitHub). The art workflow (.github/workflows/art.yml) runs this
in GitHub Actions, so a change to the script can be made from a phone.

The game's axes (three.js): the air flows along +x, y is up, z across; the
section is centred on the origin. Blender is z-up, so here x is along the
flow, y across (three.js −z) and z up; the glTF exporter turns it round.

Every surface of the shell faces inwards and is one-sided, so from outside
the near wall vanishes and the camera looks in as if through glass (the
same cutaway the code-drawn tunnel used). Pieces the game moves or recolours
are named: FanRotor spins, and the Wall and Floor materials darken for the
dark backdrop. The turntable, the sting and the models stay in code.
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
OUT = ROOT / "public" / "models" / "tunnel-university.glb"
PREVIEW = ROOT / "art" / "tunnel" / "preview.jpg"
MANIFEST = ROOT / "public" / "models" / "models.json"
# Pinned on purpose (the same as Lombard's), and the same in .github/workflows/art.yml.
BLENDER = "4.5.15"


def input_hash() -> str:
    """Every art script, in path order, hashed: tests/models.test.ts works it out the same way."""
    h = hashlib.sha256()
    for path in sorted((ROOT / "art").rglob("*.py"), key=lambda p: p.relative_to(ROOT).as_posix().encode()):
        h.update(path.read_bytes())
    return h.hexdigest()[:16]

# Test section, metres: the same numbers as UNIVERSITY_TUNNEL.section in src/data/tunnel.ts.
LENGTH, WIDTH, HEIGHT = 8.0, 2.4, 1.8
# The corner fillets: real test sections chamfer their corners to keep the flow clean.
CHAMFER = 0.16

# Colours, sRGB hex, matching the code-drawn lab (src/render/tunnelScene.ts COLOURS).
COLOURS = {
    "Wall": "F3F5F7",
    "Floor": "C9D0D6",
    "Seam": "AEB8C1",
    "Frame": "8C97A1",
    "Glass": "9FB4C6",
    "Light": "FFFFFF",
    "Screen": "B7C1C9",
    "FanRing": "6B7680",
    "FanBlade": "3C4650",
    "Steel": "5D6873",
    "Turntable": "B3BCC4",
}


def srgb(hex_: str) -> tuple[float, float, float, float]:
    """An sRGB hex colour as Blender's linear RGBA."""
    out = []
    for i in (0, 2, 4):
        c = int(hex_[i : i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


def material(name: str, rough: float, metal: float = 0.0, emit: float = 0.0, one_sided: bool = True) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = srgb(COLOURS[name])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit > 0:
        bsdf.inputs["Emission Color"].default_value = srgb(COLOURS[name])
        bsdf.inputs["Emission Strength"].default_value = emit
    # One-sided: exported as doubleSided false, so the shell is a cutaway.
    mat.use_backface_culling = one_sided
    return mat


def mesh_object(name: str, bm: bmesh.types.BMesh, mats: list[bpy.types.Material]) -> bpy.types.Object:
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    return obj


def section_profile(inset: float = 0.0) -> list[tuple[float, float]]:
    """The section's outline across the flow (y across, z up), corners chamfered, going round anticlockwise seen from upstream."""
    w = WIDTH / 2 - inset
    h = HEIGHT / 2 - inset
    c = CHAMFER
    return [(-w, -h + c), (-w + c, -h), (w - c, -h), (w, -h + c), (w, h - c), (w - c, h), (-w + c, h), (-w, h - c)]


def build_shell(wall: bpy.types.Material, floor: bpy.types.Material) -> None:
    """The section's skin: the profile swept along the flow, faces inwards. The floor face gets its own material."""
    bm = bmesh.new()
    prof = section_profile()
    n = len(prof)
    # Split along the length so lighting has vertices to work with.
    steps = 8
    rings = []
    for k in range(steps + 1):
        x = -LENGTH / 2 + LENGTH * k / steps
        rings.append([bm.verts.new((x, y, z)) for (y, z) in prof])
    for k in range(steps):
        a, b = rings[k], rings[k + 1]
        for i in range(n):
            j = (i + 1) % n
            # Wound so the normal points into the section.
            f = bm.faces.new((a[i], a[j], b[j], b[i]))
            # Side 1 of the profile (from (-w+c,-h) to (w-c,-h)) is the floor.
            f.material_index = 1 if i == 1 else 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # recalc points normals outwards for a closed-ish tube: flip them in.
    for f in bm.faces:
        f.normal_flip()
    mesh_object("Shell", bm, [wall, floor])


def box(bm: bmesh.types.BMesh, centre: tuple[float, float, float], size: tuple[float, float, float]) -> list[bmesh.types.BMVert]:
    """Add a box to a bmesh; returns its corners."""
    geom = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    bmesh.ops.scale(bm, vec=Vector(size), verts=geom)
    bmesh.ops.translate(bm, vec=Vector(centre), verts=geom)
    return geom


def build_seams(seam: bpy.types.Material) -> None:
    """Panel seams on the floor, the far wall and the ceiling: thin strips just proud of the skin, one-sided facing in."""
    bm = bmesh.new()
    t = 0.012
    off = 0.0025
    w, h = WIDTH / 2, HEIGHT / 2
    for k in range(17):
        x = -LENGTH / 2 + LENGTH * k / 16
        # Floor (z up), far wall (y = +w in Blender is three.js −z, the far side), ceiling.
        quads = [
            [(x - t, -w + CHAMFER, -h + off), (x + t, -w + CHAMFER, -h + off), (x + t, w - CHAMFER, -h + off), (x - t, w - CHAMFER, -h + off)],
            [(x - t, w - off, -h + CHAMFER), (x - t, w - off, h - CHAMFER), (x + t, w - off, h - CHAMFER), (x + t, w - off, -h + CHAMFER)],
            [(x - t, w - CHAMFER, h - off), (x + t, w - CHAMFER, h - off), (x + t, -w + CHAMFER, h - off), (x - t, -w + CHAMFER, h - off)],
        ]
        for q in quads:
            bm.faces.new([bm.verts.new(p) for p in q])
    # One line along the floor's middle, so the flow's direction reads.
    q = [(-LENGTH / 2, -t, -h + off), (LENGTH / 2, -t, -h + off), (LENGTH / 2, t, -h + off), (-LENGTH / 2, t, -h + off)]
    bm.faces.new([bm.verts.new(p) for p in q])
    mesh_object("Seams", bm, [seam])


def build_windows(frame: bpy.types.Material, glass: bpy.types.Material) -> None:
    """Three observation windows in the far wall: a frame proud of the wall and the glass just behind it."""
    bm = bmesh.new()
    gm = bmesh.new()
    y = WIDTH / 2
    for x in (-1.6, 0.0, 1.6):
        wdt, hgt, bar, depth = 1.3, 0.85, 0.05, 0.03
        zc = 0.05
        # Four bars round the glass.
        box(bm, (x, y - depth / 2, zc + hgt / 2 - bar / 2), (wdt, depth, bar))
        box(bm, (x, y - depth / 2, zc - hgt / 2 + bar / 2), (wdt, depth, bar))
        box(bm, (x - wdt / 2 + bar / 2, y - depth / 2, zc), (bar, depth, hgt))
        box(bm, (x + wdt / 2 - bar / 2, y - depth / 2, zc), (bar, depth, hgt))
        # A mullion down the middle.
        box(bm, (x, y - depth / 2, zc), (0.025, depth * 0.8, hgt - 2 * bar))
        g = [(x - wdt / 2 + bar, y - 0.004, zc - hgt / 2 + bar), (x + wdt / 2 - bar, y - 0.004, zc - hgt / 2 + bar), (x + wdt / 2 - bar, y - 0.004, zc + hgt / 2 - bar), (x - wdt / 2 + bar, y - 0.004, zc + hgt / 2 - bar)]
        f = gm.faces.new([gm.verts.new(p) for p in g])
        f.normal_update()
        if f.normal.y > 0:
            f.normal_flip()
    mesh_object("WindowFrames", bm, [frame])
    mesh_object("WindowGlass", gm, [glass])


def build_lights(light: bpy.types.Material, frame: bpy.types.Material) -> None:
    """Two light troughs in the ceiling: a housing and a bright diffuser facing down."""
    bm = bmesh.new()
    lm = bmesh.new()
    h = HEIGHT / 2
    for y in (-WIDTH / 4, WIDTH / 4):
        box(bm, (0, y, h - 0.012), (LENGTH * 0.82, 0.17, 0.024))
        q = [(-LENGTH * 0.4, y - 0.06, h - 0.0245), (-LENGTH * 0.4, y + 0.06, h - 0.0245), (LENGTH * 0.4, y + 0.06, h - 0.0245), (LENGTH * 0.4, y - 0.06, h - 0.0245)]
        f = lm.faces.new([lm.verts.new(p) for p in q])
        f.normal_update()
        if f.normal.z > 0:
            f.normal_flip()
    mesh_object("LightHousings", bm, [frame])
    mesh_object("LightPanels", lm, [light])


def build_inlet(screen: bpy.types.Material, frame: bpy.types.Material) -> None:
    """The upstream end: the contraction's lip round the section, and the flow-straightening screen across it."""
    bm = bmesh.new()
    x0 = -LENGTH / 2
    prof = section_profile()
    outer = section_profile(-0.12)
    # A flange: the section's outline to a slightly larger one, a short way upstream.
    a = [bm.verts.new((x0 + 0.002, y, z)) for (y, z) in prof]
    b = [bm.verts.new((x0 + 0.002, y, z)) for (y, z) in outer]
    for i in range(len(prof)):
        j = (i + 1) % len(prof)
        bm.faces.new((a[i], a[j], b[j], b[i]))
    for f in bm.faces:
        f.normal_update()
        if f.normal.x < 0:
            f.normal_flip()
    mesh_object("InletLip", bm, [frame])

    # The screen: a grid of thin flat bars, like a honeycomb seen end-on.
    sm = bmesh.new()
    x = x0 + 0.03
    bar = 0.006
    cells = 24
    pitch = max(WIDTH, HEIGHT) / cells
    w, h = WIDTH / 2, HEIGHT / 2
    k = -cells
    while k <= cells:
        y = k * pitch / 2
        if -w < y < w:
            box(sm, (x, y, 0), (0.02, bar, HEIGHT))
        z = k * pitch / 2
        if -h < z < h:
            box(sm, (x, 0, z), (0.02, WIDTH, bar))
        k += 2
    mesh_object("Screen", sm, [screen])


def build_fan(ring_mat: bpy.types.Material, blade: bpy.types.Material, steel: bpy.types.Material) -> None:
    """The fan at the downstream end: a ring, a nacelle on stator vanes, and the rotor (spun by the game)."""
    x = LENGTH / 2 - 0.05
    radius = min(WIDTH, HEIGHT) * 0.45
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=0.035, major_segments=72, minor_segments=12, location=(x, 0, 0), rotation=(0, math.pi / 2, 0))
    ring = bpy.context.active_object
    ring.name = "FanRing"
    ring.data.materials.append(ring_mat)

    # The nacelle: a rounded pod behind the rotor, and four stator vanes out to the ring.
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.15, segments=32, ring_count=16, location=(x + 0.12, 0, 0))
    nacelle = bpy.context.active_object
    nacelle.name = "FanNacelle"
    nacelle.scale = (1.8, 1, 1)
    nacelle.data.materials.append(steel)
    vanes = bmesh.new()
    for i in range(4):
        ang = i * math.pi / 2 + math.pi / 4
        mid = (radius + 0.15) / 2
        geom = box(vanes, (0, 0, 0), (0.12, 0.015, radius - 0.15))
        bmesh.ops.translate(vanes, vec=Vector((x + 0.16, 0, mid)), verts=geom)
        bmesh.ops.rotate(vanes, cent=Vector((x + 0.16, 0, 0)), matrix=Matrix.Rotation(ang, 3, "X"), verts=geom)
    mesh_object("FanStators", vanes, [steel])

    # The rotor, at the origin of its own object so the game spins it about x.
    rm = bmesh.new()
    hub = bmesh.ops.create_uvsphere(rm, u_segments=24, v_segments=12, radius=0.12)["verts"]
    bmesh.ops.scale(rm, vec=Vector((0.9, 1, 1)), verts=hub)
    blades = 7
    for i in range(blades):
        span = radius * 0.86
        chord = 0.16
        geom = bmesh.ops.create_cube(rm, size=1.0)["verts"]
        bmesh.ops.scale(rm, vec=Vector((0.02, chord, span)), verts=geom)
        # Twist the blade: more pitch at the root than the tip.
        for v in geom:
            frac = (v.co.z + 0.5 * span) / span
            twist = 0.75 - 0.4 * frac
            co = v.co.copy()
            v.co.x = co.x * math.cos(twist) - co.y * math.sin(twist)
            v.co.y = co.x * math.sin(twist) + co.y * math.cos(twist)
        bmesh.ops.translate(rm, vec=Vector((0, 0, 0.1 + span / 2)), verts=geom)
        bmesh.ops.rotate(rm, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(i * 2 * math.pi / blades, 3, "X"), verts=geom)
    rotor = mesh_object("FanRotor", rm, [blade])
    rotor.location = (x, 0, 0)


def build_floor_ring(turntable: bpy.types.Material) -> None:
    """The ring in the floor the yaw table sits in (the table itself turns in code)."""
    bm = bmesh.new()
    zf = -HEIGHT / 2 + 0.002
    segs = 96
    r0, r1 = 0.56, 0.6
    inner = [bm.verts.new((r0 * math.cos(2 * math.pi * i / segs), r0 * math.sin(2 * math.pi * i / segs), zf)) for i in range(segs)]
    outer = [bm.verts.new((r1 * math.cos(2 * math.pi * i / segs), r1 * math.sin(2 * math.pi * i / segs), zf)) for i in range(segs)]
    for i in range(segs):
        j = (i + 1) % segs
        f = bm.faces.new((inner[i], inner[j], outer[j], outer[i]))
        f.normal_update()
        if f.normal.z < 0:
            f.normal_flip()
    mesh_object("TableRing", bm, [turntable])


def shade_smooth_by_angle() -> None:
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            for p in obj.data.polygons:
                p.use_smooth = obj.name in ("FanRing", "FanNacelle", "FanRotor")


def preview() -> None:
    """A quick Eevee render from the game's starting view, for review."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.device = "CPU"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 600
    scene.render.image_settings.file_format = "JPEG"
    scene.render.filepath = str(PREVIEW)
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = srgb("E9EDF0")
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    scene.world = world
    sun = bpy.data.lights.new("Key", "SUN")
    sun.energy = 3.0
    sun_obj = bpy.data.objects.new("Key", sun)
    sun_obj.rotation_euler = (0.9, 0.3, 0.6)
    scene.collection.objects.link(sun_obj)
    cam = bpy.data.cameras.new("Cam")
    cam.lens = 14
    cam_obj = bpy.data.objects.new("Cam", cam)
    # Just inside the near wall (three.js +z is Blender -y), looking across and downstream.
    cam_obj.location = (-2.6, -1.1, 0.25)
    scene.collection.objects.link(cam_obj)
    target = Vector((1.2, 1.2, -0.2))
    direction = target - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    bpy.ops.render.render(write_still=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {n: material(n, 0.85) for n in ("Wall", "Floor")}
    mats["Floor"].node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    mats["Seam"] = material("Seam", 0.8)
    mats["Frame"] = material("Frame", 0.5, 0.3, one_sided=False)
    mats["Glass"] = material("Glass", 0.15, 0.2)
    mats["Light"] = material("Light", 1.0, 0.0, emit=2.0)
    mats["Screen"] = material("Screen", 0.6, 0.2, one_sided=False)
    mats["FanRing"] = material("FanRing", 0.5, 0.4, one_sided=False)
    mats["FanBlade"] = material("FanBlade", 0.6, 0.3, one_sided=False)
    mats["Steel"] = material("Steel", 0.4, 0.6, one_sided=False)
    mats["Turntable"] = material("Turntable", 0.6, 0.1)

    build_shell(mats["Wall"], mats["Floor"])
    build_seams(mats["Seam"])
    build_windows(mats["Frame"], mats["Glass"])
    build_lights(mats["Light"], mats["Frame"])
    build_inlet(mats["Screen"], mats["Frame"])
    build_fan(mats["FanRing"], mats["FanBlade"], mats["Steel"])
    build_floor_ring(mats["Turntable"])
    shade_smooth_by_angle()

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
    MANIFEST.write_text(json.dumps({"inputHash": input_hash(), "blender": BLENDER}, indent=2) + "\n")
    print(f"wrote {MANIFEST}")
    if "--preview" in argv:
        preview()
        print(f"wrote {PREVIEW}")


main()
