"""
The Belogor sliding track's buildings (PR 13p), built headless in Blender
from numbers. Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/bobsled/build.py -- [--preview]

Writes public/models/bobsled.glb and public/models/models.json (the hash of
every art script), and with --preview also art/bobsled/preview.jpg.

The ice channel stays in code: the sim lays the track out from its
stretches (src/sim/sledReplay.ts) and the sled scene sweeps the channel
along it (src/render/sledScene.ts). These are the pieces the scene stands
along it, each with its origin on the channel's centre line, on the ice at
the bottom, built along +x (the way the sled runs). Every clearance from the
channel is built in here, so the scene only says where along the track:

- StartHouse: the covered start the crew push out of, over the channel.
- TimingArch: a gantry over the channel with its clock, at the start's
  timing line and each split.
- FinishArch: the chequered gantry on the finish line.
- Shade: one bay of the sun roof over the channel (the scene tilts it with
  the slope).
- Terrace: a stepped spectator terrace with its crowd, on the channel's left
  (the scene turns it round for the right), for the outside of a curve.
- LightMast: a floodlight mast on the channel's left.
- FinishArea: everything past the line: the outrun where the sled stops,
  the snow either side, the finish house with its scoreboard and a small
  stand.

The game's axes (three.js): +x along, y up, z to the right. Blender is z-up,
so here x is the same, y is three.js −z (the left) and z is up; the glTF
exporter turns it round. Every piece keeps its daylight colours.
"""

from __future__ import annotations

import hashlib
import json
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "public" / "models" / "models.json"
OUT = ROOT / "public" / "models" / "bobsled.glb"
PREVIEW = ROOT / "art" / "bobsled" / "preview.jpg"
# Pinned on purpose, the same as the other art scripts and .github/workflows/art.yml.
BLENDER = "4.5.15"


def input_hash() -> str:
    """Every art script, in path order, hashed: tests/models.test.ts works it out the same way."""
    h = hashlib.sha256()
    for path in sorted((ROOT / "art").rglob("*.py"), key=lambda p: p.relative_to(ROOT).as_posix().encode()):
        h.update(path.read_bytes())
    return h.hexdigest()[:16]


# The channel as the sled scene sweeps it (SLED_SCENE in src/data/replay.ts):
# a half pipe this wide in radius, walls this far round from the bottom, a lip
# on top, and a snow bank stepping out and down from it.
TROUGH = 1.7
WALL_DEG = 105.0
LIP = 0.12
BANK = 7.0
BANK_DROP = 1.5
LIP_OUT = TROUGH * math.sin(math.radians(WALL_DEG))
LIP_TOP = TROUGH * (1 - math.cos(math.radians(WALL_DEG))) + LIP
# Where the snow bank ends, out from the centre line and up from the ice.
BANK_OUT = LIP_OUT + BANK
BANK_END = LIP_TOP - BANK_DROP
# The finish straight's slope (TRACKS.belogor's last stretch, 6 per cent).
FINISH_GRADE = 0.06
# The outrun: this long past the line, rising this much as it brakes the sled.
OUTRUN = 70.0
OUTRUN_RISE = 3.0

COLOURS = {
    "Snow": "F4F7FA",
    "Ice": "DDE9F2",
    "Lip": "93A3B1",
    "Timber": "B98E62",
    "Slate": "3E4A5C",
    "Roof": "5A6675",
    "Steel": "8D98A5",
    "Glass": "2C3560",
    "Teal": "2E9E95",
    "Coral": "E0695D",
    "White": "F4F4F2",
    "Black": "1D242B",
    "Lamp": "FFB347",
    "Board": "222A36",
    # The crowd's coats and hats, and their faces.
    "Coat1": "E0695D",
    "Coat2": "3E4A7A",
    "Coat3": "E3A23B",
    "Coat4": "B48CE8",
    "Coat5": "2E9E95",
    "Coat6": "F4F4F2",
    "Face1": "E2B48F",
    "Face2": "A9775A",
    "Face3": "6E4A35",
}
COATS = ["Coat1", "Coat2", "Coat3", "Coat4", "Coat5", "Coat6"]
FACES = ["Face1", "Face2", "Face3"]


def srgb(hex_: str) -> tuple[float, float, float, float]:
    """An sRGB hex colour as Blender's linear RGBA."""
    out = []
    for i in (0, 2, 4):
        c = int(hex_[i : i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


MATS: dict[str, bpy.types.Material] = {}


def mat(name: str) -> bpy.types.Material:
    """The material for a colour name, made once: matte, the ice a little glossy, the clocks glowing."""
    if name not in MATS:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = srgb(COLOURS[name])
        bsdf.inputs["Roughness"].default_value = 0.25 if name in ("Ice", "Glass") else 0.5 if name == "Steel" else 0.85
        bsdf.inputs["Metallic"].default_value = 0.4 if name == "Steel" else 0.0
        if name == "Lamp":
            bsdf.inputs["Emission Color"].default_value = srgb(COLOURS[name])
            bsdf.inputs["Emission Strength"].default_value = 2.0
        MATS[name] = m
    return MATS[name]


class Mesh:
    """A bmesh that collects boxes, faces and small round shapes with named materials, then becomes one object."""

    def __init__(self) -> None:
        self.bm = bmesh.new()
        self.names: list[str] = []

    def index(self, name: str) -> int:
        if name not in self.names:
            self.names.append(name)
        return self.names.index(name)

    def paint(self, verts: list, name: str) -> None:
        idx = self.index(name)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = idx

    def box(self, x0: float, x1: float, y0: float, y1: float, z0: float, z1: float, name: str) -> None:
        """An axis-aligned box between these bounds."""
        verts = bmesh.ops.create_cube(self.bm, size=1.0)["verts"]
        bmesh.ops.scale(self.bm, vec=Vector((x1 - x0, y1 - y0, z1 - z0)), verts=verts)
        bmesh.ops.translate(self.bm, vec=Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)), verts=verts)
        self.paint(verts, name)

    def grid(self, rows: list[list[tuple[float, float, float]]], name: str) -> None:
        """A sheet through rows of points (each row across), as quads facing up."""
        vs = [[self.bm.verts.new(p) for p in row] for row in rows]
        idx = self.index(name)
        for i in range(len(vs) - 1):
            for j in range(len(vs[i]) - 1):
                f = self.bm.faces.new([vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j]])
                f.material_index = idx
                f.normal_update()
                if f.normal.z < 0:
                    f.normal_flip()

    def person(self, x: float, y: float, z: float, rnd: random.Random) -> None:
        """A spectator standing at (x, y) on a floor at z: a coat, a face and a hat."""
        coat = rnd.choice(COATS)
        body = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=5, radius1=0.26, radius2=0.18, depth=1.25)["verts"]
        bmesh.ops.translate(self.bm, vec=Vector((x, y, z + 0.625)), verts=body)
        self.paint(body, coat)
        # Low-poly on purpose: a face and a hat as two small blocks (the crowd is the bulk of the file).
        self.box(x - 0.11, x + 0.11, y - 0.11, y + 0.11, z + 1.27, z + 1.5, rnd.choice(FACES))
        self.box(x - 0.13, x + 0.13, y - 0.13, y + 0.13, z + 1.5, z + 1.62, coat if rnd.random() < 0.3 else rnd.choice(COATS))

    def done(self, obj_name: str) -> bpy.types.Object:
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-4)
        me = bpy.data.meshes.new(obj_name)
        self.bm.to_mesh(me)
        self.bm.free()
        for n in self.names:
            me.materials.append(mat(n))
        obj = bpy.data.objects.new(obj_name, me)
        bpy.context.collection.objects.link(obj)
        return obj


def bank_z(out: float) -> float:
    """The snow bank's height this far out from the centre line (the scene's bank, straight from lip to end)."""
    o = abs(out)
    if o <= LIP_OUT:
        return LIP_TOP
    if o >= BANK_OUT:
        return BANK_END
    return LIP_TOP - BANK_DROP * (o - LIP_OUT) / BANK


def start_house() -> None:
    """The covered start: timber walls each side of the channel, a slate roof over it, open at the downhill end."""
    m = Mesh()
    x0, x1 = -8.0, 10.0
    wall = 5.4
    roof = 5.4
    for side in (-1, 1):
        y_in, y_out = side * wall, side * (wall + 0.4)
        lo, hi = min(y_in, y_out), max(y_in, y_out)
        m.box(x0, x1, lo, hi, -2.0, roof, "Timber")
        # A band of windows along each wall, on the inside and the outside.
        m.box(x0 + 1.5, x1 - 1.5, lo - 0.04, hi + 0.04, 2.8, 4.3, "Glass")
        # The coaches' viewing deck along the outside, with its rail.
        m.box(x0, x1, side * (wall + 0.4) if side > 0 else -(wall + 2.4), side * (wall + 2.4) if side > 0 else -(wall + 0.4), 2.2, 2.45, "Slate")
    m.box(x0 - 0.4, x0, -wall - 0.4, wall + 0.4, -2.0, roof, "Timber")
    # The roof, with eaves, and a teal fascia on the open end with the start's lights under it.
    m.box(x0 - 0.8, x1 + 0.8, -wall - 1.0, wall + 1.0, roof, roof + 0.45, "Roof")
    m.box(x1 + 0.6, x1 + 0.9, -wall - 1.0, wall + 1.0, roof - 0.7, roof + 0.45, "Teal")
    for k in range(5):
        y = -1.6 + k * 0.8
        m.box(x1 + 0.5, x1 + 0.62, y - 0.18, y + 0.18, roof - 1.15, roof - 0.8, "Lamp" if k == 4 else "Black")
    # The push track's start block: a bar across the ice the crew brace on.
    m.box(-0.3, 0.0, -1.2, 1.2, 0.0, 0.18, "Coral")
    m.done("StartHouse")


def arch(name: str, chequer: bool) -> None:
    """A gantry over the channel: legs on the banks, a beam and a clock on top (or the chequered finish banner)."""
    m = Mesh()
    leg = 4.4
    top = 5.6
    for side in (-1, 1):
        y = side * leg
        m.box(-0.2, 0.2, y - 0.2, y + 0.2, -1.5, top, "Steel")
        # The timing eye on each leg, looking across the channel.
        m.box(-0.15, 0.15, y - side * 0.35 - 0.12, y - side * 0.35 + 0.12, LIP_TOP + 0.2, LIP_TOP + 0.5, "Black")
    if chequer:
        sq = 0.55
        n = int((2 * leg + 0.4) / sq)
        for k in range(n):
            y0 = -leg - 0.2 + k * sq
            for row in range(2):
                colour = "Black" if (k + row) % 2 else "White"
                m.box(-0.12, 0.12, y0, y0 + sq, top - 1.1 + row * sq, top - 1.1 + (row + 1) * sq, colour)
        m.box(-0.2, 0.2, -leg - 0.2, leg + 0.2, top, top + 0.3, "Steel")
    else:
        m.box(-0.2, 0.2, -leg - 0.2, leg + 0.2, top - 0.5, top, "Steel")
        # The clock: a dark board with its glowing figures.
        m.box(-0.25, 0.25, -1.9, 1.9, top, top + 1.3, "Board")
        m.box(-0.3, 0.3, -1.5, 1.5, top + 0.45, top + 0.85, "Lamp")
        m.box(-0.26, 0.26, -1.9, 1.9, top + 1.3, top + 1.45, "Teal")
    m.done(name)


def shade() -> None:
    """One bay of the sun roof: posts on the banks and a shallow roof, 8.6 m long so bays overlap on a curve."""
    m = Mesh()
    half = 4.3
    for side in (-1, 1):
        y = side * 4.8
        m.box(-0.15, 0.15, y - 0.15, y + 0.15, -1.5, 5.0, "Steel")
        m.box(-half, half, y - 0.12, y + 0.12, 4.75, 5.0, "Steel")
    m.box(-half, half, -5.4, 5.4, 5.0, 5.2, "Roof")
    m.box(-0.12, 0.12, -4.8, 4.8, 4.8, 5.0, "Steel")
    m.done("Shade")


def terrace() -> None:
    """Stepped standing room on the channel's left, a rail at the front and a crowd of about thirty."""
    m = Mesh()
    rnd = random.Random(13)
    x0, x1 = -7.0, 7.0
    front = 4.8
    floor = bank_z(front) - 0.3
    m.box(x0, x1, front, 13.0, -3.0, floor, "Snow")
    rise, tread = 0.45, 1.4
    for k in range(5):
        y = front + 0.6 + k * tread
        m.box(x0, x1, y, 13.0, floor + k * rise, floor + (k + 1) * rise, "Timber" if k % 2 == 0 else "Slate")
    # The rail along the front.
    for k in range(9):
        x = x0 + 0.2 + k * (x1 - x0 - 0.4) / 8
        m.box(x - 0.05, x + 0.05, front + 0.2, front + 0.3, floor, floor + 1.1, "Steel")
    m.box(x0, x1, front + 0.18, front + 0.32, floor + 1.0, floor + 1.1, "Coral")
    # The crowd: some at the rail, the rest along the steps.
    for x in [x0 + 0.8 + k * 1.05 for k in range(12)]:
        if rnd.random() < 0.85:
            m.person(x + rnd.uniform(-0.2, 0.2), front + 0.5 + rnd.uniform(-0.05, 0.05), floor, rnd)
    for k in range(1, 5):
        z = floor + (k + 1) * rise
        y = front + 0.6 + k * tread + 0.6
        for x in [x0 + 0.7 + j * 1.4 for j in range(10)]:
            if rnd.random() < 0.45:
                m.person(x + rnd.uniform(-0.3, 0.3), y + rnd.uniform(-0.2, 0.2), z, rnd)
    m.done("Terrace")


def light_mast() -> None:
    """A floodlight mast on the channel's left, its three lamps leaning over the ice."""
    m = Mesh()
    y = 7.6
    m.box(-0.18, 0.18, y - 0.18, y + 0.18, -1.5, 12.0, "Steel")
    m.box(-0.1, 0.1, y - 2.2, y + 0.2, 11.6, 11.8, "Steel")
    for k, x in enumerate((-0.7, 0.0, 0.7)):
        m.box(x - 0.3, x + 0.3, y - 2.4, y - 1.9, 11.9 - 0.25 * (k % 2), 12.4 - 0.25 * (k % 2), "Slate")
        m.box(x - 0.24, x + 0.24, y - 2.45, y - 2.38, 11.95 - 0.25 * (k % 2), 12.35 - 0.25 * (k % 2), "Lamp")
    m.done("LightMast")


def outrun_z(x: float) -> float:
    """The outrun's ice past the line: level at first, rising more and more to brake the sled."""
    if x <= 0:
        return -x * FINISH_GRADE
    t = min(1.0, x / OUTRUN)
    return OUTRUN_RISE * t * t


def finish_area() -> None:
    """Past the line: the outrun channel, snow either side reaching back up the finish straight, the finish house and a small stand."""
    m = Mesh()
    rnd = random.Random(29)
    steps = 12
    xs = [x * 5.0 for x in range(0, int(OUTRUN / 5) + 1)]
    ice, lip_l, lip_r, bank_l, bank_r = [], [], [], [], []
    for x in xs:
        z = outrun_z(x)
        row = []
        for k in range(steps + 1):
            a = math.radians(-WALL_DEG + 2 * WALL_DEG * k / steps)
            row.append((x, -TROUGH * math.sin(a), z + TROUGH * (1 - math.cos(a))))
        ice.append(row)
        lip_l.append([(x, LIP_OUT, z + LIP_TOP - LIP), (x, LIP_OUT, z + LIP_TOP)])
        lip_r.append([(x, -LIP_OUT, z + LIP_TOP - LIP), (x, -LIP_OUT, z + LIP_TOP)])
        bank_l.append([(x, LIP_OUT, z + LIP_TOP), (x, BANK_OUT, z + BANK_END)])
        bank_r.append([(x, -LIP_OUT, z + LIP_TOP), (x, -BANK_OUT, z + BANK_END)])
    m.grid(ice, "Ice")
    m.grid(lip_l, "Lip")
    m.grid(lip_r, "Lip")
    m.grid(bank_l, "Snow")
    m.grid(bank_r, "Snow")
    # A snow berm across the end of the outrun.
    end = outrun_z(OUTRUN)
    m.box(OUTRUN, OUTRUN + 6, -BANK_OUT, BANK_OUT, end - 1, end + LIP_TOP + 0.6, "Snow")
    # The ground either side, from back up the finish straight to past the berm, at the bank's foot.
    gx = [-60.0, -40.0, -20.0, 0.0] + xs[1:] + [OUTRUN + 30]
    for side in (-1, 1):
        rows = []
        for x in gx:
            z = outrun_z(min(x, OUTRUN)) + BANK_END
            rows.append([(x, side * BANK_OUT, z), (x, side * 45.0, z)])
        m.grid(rows, "Snow")
    # The finish house on the left: two storeys, its glass front facing the line.
    hx0, hx1, hy0, hy1 = 4.0, 22.0, 13.0, 22.0
    gz = BANK_END + outrun_z(hx0)
    m.box(hx0, hx1, hy0, hy1, gz - 2, gz + 7.0, "Timber")
    m.box(hx0 + 1, hx1 - 1, hy0 - 0.05, hy0 + 0.1, gz + 1.0, gz + 3.0, "Glass")
    m.box(hx0 + 1, hx1 - 1, hy0 - 0.05, hy0 + 0.1, gz + 4.2, gz + 6.2, "Glass")
    m.box(hx0 - 0.6, hx1 + 0.6, hy0 - 1.2, hy1 + 0.6, gz + 7.0, gz + 7.5, "Roof")
    m.box(hx0, hx1, hy0 - 0.08, hy0, gz + 3.4, gz + 3.8, "Teal")
    # The scoreboard on two legs, angled to the sleds coming down.
    sx, sy = -6.0, 12.0
    sz = BANK_END + outrun_z(sx)
    for dx in (-2.6, 2.6):
        m.box(sx + dx - 0.15, sx + dx + 0.15, sy - 0.15, sy + 0.15, sz - 1.5, sz + 5.0, "Steel")
    m.box(sx - 3.2, sx + 3.2, sy - 0.25, sy + 0.25, sz + 5.0, sz + 8.2, "Board")
    for r in range(3):
        m.box(sx - 2.6, sx + 2.6, sy - 0.3, sy - 0.25, sz + 5.5 + r * 0.85, sz + 5.9 + r * 0.85, "Lamp" if r == 2 else "White")
    # A small stand on the right, facing the line, with its crowd.
    tx0, tx1 = -4.0, 14.0
    front = -10.0
    floor = BANK_END + 0.1
    m.box(tx0, tx1, front - 8, front, floor - 2, floor, "Snow")
    for k in range(4):
        y = front - 0.8 - k * 1.6
        m.box(tx0, tx1, front - 8, y, floor + k * 0.5, floor + (k + 1) * 0.5, "Timber" if k % 2 == 0 else "Slate")
    m.box(tx0, tx1, front - 0.3, front - 0.15, floor, floor + 1.1, "Coral")
    for k in range(4):
        z = floor + k * 0.5 if k else floor
        y = front - 0.5 - k * 1.6 - (0.3 if k else 0)
        for j in range(12):
            if rnd.random() < 0.6:
                m.person(tx0 + 0.8 + j * 1.45 + rnd.uniform(-0.3, 0.3), y, z + (0.5 if k else 0), rnd)
    m.done("FinishArea")


def preview(path: Path) -> None:
    """Lay the pieces along a straight stretch of channel as the scene would, and shoot it from behind the sled."""
    scene = bpy.context.scene
    o = {ob.name: ob for ob in scene.objects}
    # A plain channel 160 m long down a 6 per cent slope ending at the finish line (x = 0).
    m = Mesh()
    xs = [-160.0 + 4 * k for k in range(41)]
    ice, bank_l, bank_r = [], [], []
    for x in xs:
        z = -x * FINISH_GRADE
        row = []
        for k in range(13):
            a = math.radians(-WALL_DEG + 2 * WALL_DEG * k / 12)
            row.append((x, -TROUGH * math.sin(a), z + TROUGH * (1 - math.cos(a))))
        ice.append(row)
        bank_l.append([(x, LIP_OUT, z + LIP_TOP), (x, BANK_OUT, z + BANK_END)])
        bank_r.append([(x, -LIP_OUT, z + LIP_TOP), (x, -BANK_OUT, z + BANK_END)])
    m.grid(ice, "Ice")
    m.grid(bank_l, "Snow")
    m.grid(bank_r, "Snow")
    m.done("Channel")

    def at(name: str, x: float, turned: bool = False) -> None:
        c = o[name].copy()
        c.location = (x, 0, -x * FINISH_GRADE if x < 0 else 0)
        if turned:
            c.rotation_euler = (0, 0, math.pi)
        scene.collection.objects.link(c)

    at("Terrace", -120)
    at("Terrace", -85, True)
    at("LightMast", -100)
    at("LightMast", -60, True)
    at("TimingArch", -95)
    for k in range(5):
        at("Shade", -70 + k * 8)
    for name in ("StartHouse",):
        o[name].location = (-150, 0, 150 * FINISH_GRADE)
    for name in ("TimingArch", "Terrace", "LightMast", "Shade"):
        o[name].location = (0, 0, -200)
    o["FinishArch"].location = (0, 0, 0)
    o["FinishArea"].location = (0, 0, 0)
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
    cam_obj.location = (-135, -2, 135 * FINISH_GRADE + 5)
    scene.collection.objects.link(cam_obj)
    cam_obj.rotation_euler = (Vector((-60, 1, 2)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    start_house()
    arch("TimingArch", chequer=False)
    arch("FinishArch", chequer=True)
    shade()
    terrace()
    light_mast()
    finish_area()

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
