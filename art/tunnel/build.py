"""
The two tunnels' test sections, built headless in Blender: the university's
(PR 13b) and your own (PR 13d). Nobody opens the Blender UI: this script
makes every piece from numbers.

    ~/blender/blender --background --factory-startup --python art/tunnel/build.py -- [--preview]

Writes public/models/tunnel-university.glb, public/models/tunnel-own.glb and
public/models/models.json (the hash of every art script, so a test can tell
the models are out of date), and with --preview also art/tunnel/preview.jpg
and art/tunnel/preview-own.jpg (committed, so the look can be checked on
GitHub).

Both sections are the same size, because the sim gives your tunnel the
university's section and fan (src/data/tunnel.ts). Your own is newer and
brighter: one long panoramic window, light panels across the ceiling, a
cobalt trim line, yaw marks round the turntable and a nine-blade fan. The art workflow (.github/workflows/art.yml) runs this
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
    # The control room behind the far wall's windows (PR 13ar): lit walls, a darker floor, the desk, kit in dark grey,
    # the wall displays' dark glass and the lines drawn on them in the lab's data colours (cp-lo blue, teal, coral).
    "RoomWall": "E6E9F2",
    "RoomFloor": "7D8496",
    "Desk": "D5DAE3",
    "Kit": "2E3448",
    "Display": "141A33",
    "ChartTeal": "2ED3C6",
    "ChartCoral": "FF7A6E",
    "ChartBlue": "7189FF",
    "Led": "5BE38F",
}

# The two tunnels: what differs between them. Everything else is shared.
VARIANTS = {
    "university": {
        "out": ROOT / "public" / "models" / "tunnel-university.glb",
        "preview": ROOT / "art" / "tunnel" / "preview.jpg",
        "colours": {},
        # Three framed windows, each (centre along the flow, width), with a mullion each.
        "windows": [(-1.6, 1.3), (0.0, 1.3), (1.6, 1.3)],
        "window_height": 0.85,
        "lights": "troughs",
        "trim": False,
        "blades": 7,
    },
    "own": {
        "out": ROOT / "public" / "models" / "tunnel-own.glb",
        "preview": ROOT / "art" / "tunnel" / "preview-own.jpg",
        # Whiter walls, a cooler floor, and the lab's cobalt (--accent in src/style.css) on the trim and the fan ring.
        "colours": {"Wall": "F8F9FB", "Floor": "C3CCD4", "Frame": "6B7680", "FanRing": "2456E8", "Trim": "2456E8"},
        # One long panoramic window, split by slim mullions.
        "windows": [(0.0, 5.2)],
        "window_height": 0.72,
        "lights": "panels",
        "trim": True,
        "blades": 9,
    },
}

# The colours in use: the shared set with the current tunnel's changes on top (set in build()).
PALETTE: dict[str, str] = dict(COLOURS)


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
    bsdf.inputs["Base Color"].default_value = srgb(PALETTE[name])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit > 0:
        bsdf.inputs["Emission Color"].default_value = srgb(PALETTE[name])
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
    """The section's skin: the profile swept along the flow, faces inwards. The floor face gets its own material; the far wall (side 3) is left out for build_far_wall to cut the windows through."""
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
            if i == 3:
                continue
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


def build_windows(frame: bpy.types.Material, glass: bpy.types.Material, windows: list[tuple[float, float]], hgt: float) -> None:
    """Observation windows in the far wall: a frame proud of the wall, mullions about every 1.3 m, and the glass just behind."""
    bm = bmesh.new()
    gm = bmesh.new()
    y = WIDTH / 2
    for x, wdt in windows:
        bar, depth = 0.05, 0.03
        zc = 0.05
        # Four bars round the glass.
        box(bm, (x, y - depth / 2, zc + hgt / 2 - bar / 2), (wdt, depth, bar))
        box(bm, (x, y - depth / 2, zc - hgt / 2 + bar / 2), (wdt, depth, bar))
        box(bm, (x - wdt / 2 + bar / 2, y - depth / 2, zc), (bar, depth, hgt))
        box(bm, (x + wdt / 2 - bar / 2, y - depth / 2, zc), (bar, depth, hgt))
        # Mullions: one down the middle of a short window, more along a long one.
        panes = max(2, round(wdt / 1.3))
        for k in range(1, panes):
            box(bm, (x - wdt / 2 + wdt * k / panes, y - depth / 2, zc), (0.025, depth * 0.8, hgt - 2 * bar))
        g = [(x - wdt / 2 + bar, y - 0.004, zc - hgt / 2 + bar), (x + wdt / 2 - bar, y - 0.004, zc - hgt / 2 + bar), (x + wdt / 2 - bar, y - 0.004, zc + hgt / 2 - bar), (x - wdt / 2 + bar, y - 0.004, zc + hgt / 2 - bar)]
        f = gm.faces.new([gm.verts.new(p) for p in g])
        f.normal_update()
        if f.normal.y > 0:
            f.normal_flip()
    mesh_object("WindowFrames", bm, [frame])
    mesh_object("WindowGlass", gm, [glass])


def facing_quad(bm: bmesh.types.BMesh, pts: list[tuple[float, float, float]], facing: tuple[float, float, float]):
    """A quad (or any flat polygon) turned to face the given way."""
    f = bm.faces.new([bm.verts.new(p) for p in pts])
    f.normal_update()
    if f.normal.dot(Vector(facing)) < 0:
        f.normal_flip()
    return f


def openings(windows: list[tuple[float, float]], hgt: float) -> list[tuple[float, float]]:
    """The holes the windows need in the far wall, each (x0, x1) along the flow; they all share one height band."""
    return [(x - wdt / 2 + 0.02, x + wdt / 2 - 0.02) for x, wdt in windows]


WINDOW_ZC = 0.05


def build_far_wall(wall: bpy.types.Material, frame: bpy.types.Material, windows: list[tuple[float, float]], hgt: float) -> None:
    """The far wall (PR 13ar), with the windows cut through it so the control room shows, and a reveal round each hole the wall's thickness deep."""
    bm = bmesh.new()
    w, h, c = WIDTH / 2, HEIGHT / 2, CHAMFER
    z0, z1 = WINDOW_ZC - hgt / 2 + 0.02, WINDOW_ZC + hgt / 2 - 0.02
    holes = openings(windows, hgt)
    inward = (0, -1, 0)
    steps = 8
    # Full-length strips below and above the windows, split along the flow for the lighting.
    for k in range(steps):
        xa, xb = -LENGTH / 2 + LENGTH * k / steps, -LENGTH / 2 + LENGTH * (k + 1) / steps
        facing_quad(bm, [(xa, w, -h + c), (xb, w, -h + c), (xb, w, z0), (xa, w, z0)], inward)
        facing_quad(bm, [(xa, w, z1), (xb, w, z1), (xb, w, h - c), (xa, w, h - c)], inward)
    # The band between, everywhere the windows aren't.
    edges = [-LENGTH / 2] + [e for hole in holes for e in hole] + [LENGTH / 2]
    for k in range(0, len(edges), 2):
        xa, xb = edges[k], edges[k + 1]
        if xb - xa > 1e-4:
            facing_quad(bm, [(xa, w, z0), (xb, w, z0), (xb, w, z1), (xa, w, z1)], inward)
    mesh_object("FarWall", bm, [wall])
    # The reveals: the hole's four sides, back to the room's face of the wall.
    rm = bmesh.new()
    d = WALL_DEPTH
    for xa, xb in holes:
        facing_quad(rm, [(xa, w, z0), (xb, w, z0), (xb, w + d, z0), (xa, w + d, z0)], (0, 0, 1))
        facing_quad(rm, [(xa, w, z1), (xb, w, z1), (xb, w + d, z1), (xa, w + d, z1)], (0, 0, -1))
        facing_quad(rm, [(xa, w, z0), (xa, w, z1), (xa, w + d, z1), (xa, w + d, z0)], (1, 0, 0))
        facing_quad(rm, [(xb, w, z0), (xb, w, z1), (xb, w + d, z1), (xb, w + d, z0)], (-1, 0, 0))
    mesh_object("WindowReveals", rm, [frame])


# The control room behind the far wall: how deep the wall is, how far back the room goes, and its floor and ceiling.
WALL_DEPTH = 0.18
ROOM_DEPTH = 2.6
ROOM_FLOOR = -1.2
ROOM_CEILING = 1.35


def build_room(mats: dict, windows: list[tuple[float, float]], hgt: float) -> None:
    """The control room (PR 13ar), seen through the glass: its walls facing in, the desk along the windows with the
    monitors' backs and the chairs, a server rack, ceiling lights, and the big displays on its back wall drawing a
    drag polar, a yaw sweep and a pressure trace."""
    y0 = WIDTH / 2 + WALL_DEPTH
    y1 = y0 + ROOM_DEPTH
    xa, xb = -LENGTH / 2, LENGTH / 2
    zf, zc = ROOM_FLOOR, ROOM_CEILING
    bm = bmesh.new()
    # Back wall, the two ends and the room's side of the window wall, all facing into the room.
    facing_quad(bm, [(xa, y1, zf), (xb, y1, zf), (xb, y1, zc), (xa, y1, zc)], (0, -1, 0))
    facing_quad(bm, [(xa, y0, zf), (xa, y1, zf), (xa, y1, zc), (xa, y0, zc)], (1, 0, 0))
    facing_quad(bm, [(xb, y0, zf), (xb, y1, zf), (xb, y1, zc), (xb, y0, zc)], (-1, 0, 0))
    facing_quad(bm, [(xa, y0, zc), (xb, y0, zc), (xb, y1, zc), (xa, y1, zc)], (0, 0, -1))
    mesh_object("RoomWalls", bm, [mats["RoomWall"]])
    fm = bmesh.new()
    facing_quad(fm, [(xa, y0, zf), (xb, y0, zf), (xb, y1, zf), (xa, y1, zf)], (0, 0, 1))
    mesh_object("RoomFloor", fm, [mats["RoomFloor"]])

    # The desk: one long top under the windows, on a modesty panel, as long as the glass.
    left = min(x - wdt / 2 for x, wdt in windows) + 0.1
    right = max(x + wdt / 2 for x, wdt in windows) - 0.1
    top = WINDOW_ZC - hgt / 2 - 0.12
    dm = bmesh.new()
    box(dm, ((left + right) / 2, y0 + 0.45, top - 0.02), (right - left, 0.7, 0.04))
    box(dm, ((left + right) / 2, y0 + 0.12, (top + zf) / 2), (right - left, 0.03, top - zf))
    mesh_object("Desk", dm, [mats["Desk"]])

    # Monitors (their backs to us: the operators face the glass), their stands, and a chair at each pair.
    km = bmesh.new()
    seats = max(2, round((right - left) / 1.1))
    for k in range(seats):
        x = left + (right - left) * (k + 0.5) / seats
        for dx in (-0.29, 0.29):
            box(km, (x + dx, y0 + 0.3, top + 0.24), (0.54, 0.035, 0.32))
            box(km, (x + dx, y0 + 0.33, top + 0.05), (0.05, 0.03, 0.1))
            box(km, (x + dx, y0 + 0.33, top + 0.005), (0.2, 0.14, 0.01))
        # The chair: a seat, its back towards the room's back wall, the column and a five-arm base.
        cy = y0 + 1.1
        box(km, (x, cy, zf + 0.5), (0.46, 0.44, 0.07))
        box(km, (x, cy + 0.24, zf + 0.85), (0.44, 0.06, 0.58))
        box(km, (x, cy, zf + 0.28), (0.05, 0.05, 0.4))
        for a in range(5):
            t = 2 * math.pi * a / 5
            box(km, (x + 0.16 * math.cos(t), cy + 0.16 * math.sin(t), zf + 0.05), (0.06 + 0.26 * abs(math.cos(t)), 0.06 + 0.26 * abs(math.sin(t)), 0.03))
    # The server rack in the corner, and the displays' frames on the back wall.
    rack_x = xb - 0.6
    box(km, (rack_x, y1 - 0.45, (zf + 0.9) / 2 + 0.0), (0.62, 0.85, 0.9 - zf))
    displays = [(-1.7, 1.5), (0.0, 1.5), (1.7, 1.5)]
    dz0, dz1 = 0.0, 0.85
    for x, wdt in displays:
        box(km, (x, y1 - 0.025, (dz0 + dz1) / 2), (wdt + 0.06, 0.05, dz1 - dz0 + 0.06))
    mesh_object("RoomKit", km, [mats["Kit"]])

    # The displays' dark glass, a hair in front of their frames.
    sm = bmesh.new()
    for x, wdt in displays:
        facing_quad(sm, [(x - wdt / 2, y1 - 0.052, dz0), (x + wdt / 2, y1 - 0.052, dz0), (x + wdt / 2, y1 - 0.052, dz1), (x - wdt / 2, y1 - 0.052, dz1)], (0, -1, 0))
    mesh_object("RoomDisplays", sm, [mats["Display"]])

    # What they draw: thin glowing lines a hair in front of the glass. A drag polar, a yaw sweep (two lines), a pressure trace.
    def trace(bm2, x: float, wdt: float, f, n: int = 24, thick: float = 0.012) -> None:
        yy = y1 - 0.056
        pts = []
        for i in range(n + 1):
            u = i / n
            pts.append((x - wdt / 2 + 0.1 + (wdt - 0.2) * u, dz0 + 0.1 + (dz1 - dz0 - 0.2) * f(u)))
        for (ax_, az_), (bx_, bz_) in zip(pts, pts[1:]):
            facing_quad(bm2, [(ax_, yy, az_ - thick / 2), (bx_, yy, bz_ - thick / 2), (bx_, yy, bz_ + thick / 2), (ax_, yy, az_ + thick / 2)], (0, -1, 0))

    teal, coral, blue = bmesh.new(), bmesh.new(), bmesh.new()
    trace(teal, -1.7, 1.5, lambda u: 0.1 + 0.8 * u * u)
    trace(blue, 0.0, 1.5, lambda u: 0.2 + 0.6 * (2 * u - 1) ** 2)
    trace(coral, 0.0, 1.5, lambda u: 0.75 - 0.5 * math.sin(math.pi * u))
    trace(coral, 1.7, 1.5, lambda u: 0.5 + 0.35 * math.sin(6 * math.pi * u) * math.exp(-2.5 * u), n=48)
    # Axes on each display, dim teal.
    for x, wdt in displays:
        yy = y1 - 0.056
        facing_quad(teal, [(x - wdt / 2 + 0.1, yy, dz0 + 0.095), (x + wdt / 2 - 0.1, yy, dz0 + 0.095), (x + wdt / 2 - 0.1, yy, dz0 + 0.103), (x - wdt / 2 + 0.1, yy, dz0 + 0.103)], (0, -1, 0))
        facing_quad(teal, [(x - wdt / 2 + 0.095, yy, dz0 + 0.1), (x - wdt / 2 + 0.103, yy, dz0 + 0.1), (x - wdt / 2 + 0.103, yy, dz1 - 0.1), (x - wdt / 2 + 0.095, yy, dz1 - 0.1)], (0, -1, 0))
    mesh_object("ChartTeal", teal, [mats["ChartTeal"]])
    mesh_object("ChartCoral", coral, [mats["ChartCoral"]])
    mesh_object("ChartBlue", blue, [mats["ChartBlue"]])

    # The rack's lights, and the room's ceiling panels.
    lm = bmesh.new()
    for row in range(14):
        for col in range(3):
            zz = zf + 0.15 + row * 0.13
            xx = rack_x - 0.2 + col * 0.06
            facing_quad(lm, [(xx, y1 - 0.88, zz), (xx + 0.025, y1 - 0.88, zz), (xx + 0.025, y1 - 0.88, zz + 0.015), (xx, y1 - 0.88, zz + 0.015)], (0, -1, 0))
    mesh_object("RackLeds", lm, [mats["Led"]])
    pm = bmesh.new()
    for x in (-2.4, -0.8, 0.8, 2.4):
        facing_quad(pm, [(x - 0.5, y0 + 0.9, zc - 0.005), (x + 0.5, y0 + 0.9, zc - 0.005), (x + 0.5, y0 + 1.5, zc - 0.005), (x - 0.5, y0 + 1.5, zc - 0.005)], (0, 0, -1))
    mesh_object("RoomLights", pm, [mats["Light"]])


def build_instruments(steel: bpy.types.Material, kit: bpy.types.Material) -> None:
    """Two instruments on the ceiling (PR 13ar): the pitot-static probe upstream that reads the air speed, and the smoke camera downstream of the turntable."""
    bm = bmesh.new()
    h = HEIGHT / 2
    px, py = -2.9, 0.55
    # The probe: a stem down from the ceiling, and the tube pointing into the oncoming air.
    for k in range(12):
        t0, t1 = 2 * math.pi * k / 12, 2 * math.pi * (k + 1) / 12
        r = 0.008
        a0, a1 = (r * math.cos(t0), r * math.sin(t0)), (r * math.cos(t1), r * math.sin(t1))
        facing_quad(bm, [(px + a0[0], py + a0[1], h), (px + a1[0], py + a1[1], h), (px + a1[0], py + a1[1], h - 0.32), (px + a0[0], py + a0[1], h - 0.32)], (a0[0] + a1[0], a0[1] + a1[1], 0))
        r = 0.006
        b0, b1 = (r * math.cos(t0), r * math.sin(t0)), (r * math.cos(t1), r * math.sin(t1))
        zz = h - 0.32
        facing_quad(bm, [(px + 0.01, py + b0[0], zz + b0[1]), (px + 0.01, py + b1[0], zz + b1[1]), (px - 0.2, py + b1[0], zz + b1[1]), (px - 0.2, py + b0[0], zz + b0[1])], (0, b0[0] + b1[0], b0[1] + b1[1]))
    box(bm, (px, py, h - 0.01), (0.06, 0.06, 0.02))
    mesh_object("PitotProbe", bm, [steel])
    km = bmesh.new()
    cx, cy = 1.4, 0.3
    box(km, (cx, cy, h - 0.06), (0.05, 0.05, 0.12))
    box(km, (cx - 0.02, cy, h - 0.16), (0.16, 0.09, 0.09))
    box(km, (cx - 0.12, cy, h - 0.17), (0.05, 0.06, 0.06))
    mesh_object("SmokeCamera", km, [kit])


def build_lights(light: bpy.types.Material, frame: bpy.types.Material, kind: str) -> None:
    """The ceiling lights: two long troughs along the flow (the university), or short panels across it (your own)."""
    bm = bmesh.new()
    lm = bmesh.new()
    h = HEIGHT / 2

    def diffuser(x0: float, x1: float, y0: float, y1: float) -> None:
        q = [(x0, y0, h - 0.0245), (x0, y1, h - 0.0245), (x1, y1, h - 0.0245), (x1, y0, h - 0.0245)]
        f = lm.faces.new([lm.verts.new(p) for p in q])
        f.normal_update()
        if f.normal.z > 0:
            f.normal_flip()

    if kind == "troughs":
        for y in (-WIDTH / 4, WIDTH / 4):
            box(bm, (0, y, h - 0.012), (LENGTH * 0.82, 0.17, 0.024))
            diffuser(-LENGTH * 0.4, LENGTH * 0.4, y - 0.06, y + 0.06)
    else:
        # Seven panels across the ceiling, a metre apart, clear of the chamfers.
        span = WIDTH - 2 * CHAMFER - 0.2
        for k in range(-3, 4):
            x = k * 1.0
            box(bm, (x, 0, h - 0.012), (0.26, span, 0.024))
            diffuser(x - 0.1, x + 0.1, -span / 2 + 0.04, span / 2 - 0.04)
    mesh_object("LightHousings", bm, [frame])
    mesh_object("LightPanels", lm, [light])


def build_trim(trim: bpy.types.Material) -> None:
    """Your own tunnel's cobalt: a line along the far wall under the window, and one round the inlet's mouth."""
    bm = bmesh.new()
    w, h = WIDTH / 2, HEIGHT / 2
    off = 0.003
    z0, z1 = -0.42, -0.36
    q = [(-LENGTH / 2, w - off, z0), (-LENGTH / 2, w - off, z1), (LENGTH / 2, w - off, z1), (LENGTH / 2, w - off, z0)]
    f = bm.faces.new([bm.verts.new(p) for p in q])
    f.normal_update()
    if f.normal.y > 0:
        f.normal_flip()
    # A band round the inside of the section, just downstream of the inlet.
    prof = section_profile(off)
    x0, x1 = -LENGTH / 2 + 0.2, -LENGTH / 2 + 0.28
    a = [bm.verts.new((x0, y, z)) for (y, z) in prof]
    b = [bm.verts.new((x1, y, z)) for (y, z) in prof]
    band = []
    for i in range(len(prof)):
        j = (i + 1) % len(prof)
        band.append(bm.faces.new((a[i], a[j], b[j], b[i])))
    for f in band:
        f.normal_update()
        # Face in, towards the section's axis.
        centre = f.calc_center_median()
        if f.normal.dot(Vector((0, -centre.y, -centre.z))) < 0:
            f.normal_flip()
    mesh_object("Trim", bm, [trim])


def build_yaw_marks(seam: bpy.types.Material) -> None:
    """Your own tunnel's yaw scale: a tick every 5° round the turntable ring, a longer one every 15°."""
    bm = bmesh.new()
    zf = -HEIGHT / 2 + 0.0025
    r0 = 0.61
    for deg in range(0, 360, 5):
        long = deg % 15 == 0
        r1 = r0 + (0.07 if long else 0.035)
        a = math.radians(deg)
        half = 0.006 if long else 0.004
        ca, sa = math.cos(a), math.sin(a)
        # A thin quad from r0 to r1, half wide each side of the ray.
        pts = [(r0 * ca - half * sa, r0 * sa + half * ca), (r1 * ca - half * sa, r1 * sa + half * ca), (r1 * ca + half * sa, r1 * sa - half * ca), (r0 * ca + half * sa, r0 * sa - half * ca)]
        f = bm.faces.new([bm.verts.new((x, y, zf)) for (x, y) in pts])
        f.normal_update()
        if f.normal.z < 0:
            f.normal_flip()
    mesh_object("YawMarks", bm, [seam])


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


def build_fan(ring_mat: bpy.types.Material, blade: bpy.types.Material, steel: bpy.types.Material, blades: int) -> None:
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


def preview(path: Path) -> None:
    """A quick Eevee render from the game's starting view, for review."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.device = "CPU"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 600
    scene.render.image_settings.file_format = "JPEG"
    scene.render.filepath = str(path)
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


def build(name: str, v: dict, with_preview: bool) -> None:
    """Build one tunnel from an empty scene, export it, and render its preview if asked."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    PALETTE.clear()
    PALETTE.update(COLOURS, **v["colours"])
    mats = {n: material(n, 0.85) for n in ("Wall", "Floor")}
    mats["Floor"].node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    mats["Seam"] = material("Seam", 0.8)
    mats["Frame"] = material("Frame", 0.5, 0.3, one_sided=False)
    mats["Glass"] = material("Glass", 0.1, 0.2)
    # See-through (PR 13ar), so the control room behind it shows: exported as a blended material.
    glass_bsdf = mats["Glass"].node_tree.nodes["Principled BSDF"]
    glass_bsdf.inputs["Alpha"].default_value = 0.22
    mats["Glass"].surface_render_method = "BLENDED"
    for n, rough, emit in (("RoomWall", 0.8, 0.0), ("RoomFloor", 0.85, 0.0), ("Desk", 0.5, 0.0), ("Kit", 0.5, 0.0), ("Display", 0.2, 0.0),
                           ("ChartTeal", 0.5, 2.5), ("ChartCoral", 0.5, 2.5), ("ChartBlue", 0.5, 2.5), ("Led", 0.5, 3.0)):
        mats[n] = material(n, rough, emit=emit)
    mats["Light"] = material("Light", 1.0, 0.0, emit=2.0)
    mats["Screen"] = material("Screen", 0.6, 0.2, one_sided=False)
    mats["FanRing"] = material("FanRing", 0.5, 0.4, one_sided=False)
    mats["FanBlade"] = material("FanBlade", 0.6, 0.3, one_sided=False)
    mats["Steel"] = material("Steel", 0.4, 0.6, one_sided=False)
    mats["Turntable"] = material("Turntable", 0.6, 0.1)

    build_shell(mats["Wall"], mats["Floor"])
    build_seams(mats["Seam"])
    build_far_wall(mats["Wall"], mats["Frame"], v["windows"], v["window_height"])
    build_windows(mats["Frame"], mats["Glass"], v["windows"], v["window_height"])
    build_room(mats, v["windows"], v["window_height"])
    build_instruments(mats["Steel"], mats["Kit"])
    build_lights(mats["Light"], mats["Frame"], v["lights"])
    build_inlet(mats["Screen"], mats["Frame"])
    build_fan(mats["FanRing"], mats["FanBlade"], mats["Steel"], v["blades"])
    build_floor_ring(mats["Turntable"])
    if v["trim"]:
        build_trim(material("Trim", 0.45, 0.1))
        build_yaw_marks(mats["Seam"])
    shade_smooth_by_angle()

    out: Path = v["out"]
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
    if with_preview:
        preview(v["preview"])
        print(f"wrote {v['preview']}")


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    for name, v in VARIANTS.items():
        build(name, v, "--preview" in argv)
    MANIFEST.write_text(json.dumps({"inputHash": input_hash(), "blender": BLENDER}, indent=2) + "\n")
    print(f"wrote {MANIFEST}")


main()
