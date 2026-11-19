"""
The velodrome (PR 13k): the indoor 250 m track the cycling replays race on,
built headless in Blender from numbers. Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/velodrome/build.py -- [--preview]

Writes public/models/velodrome.glb and public/models/models.json (the hash of
every art script, the same as art/tunnel/build.py writes), and with --preview
also art/velodrome/preview.jpg (the broadcast camera's view) and
art/velodrome/preview-close.jpg (down the home straight).

The track follows the replay's own lap (TRACK in src/data/briefs.ts): two
50 m straights and two 75 m bends, ridden anticlockwise from the head of the
home straight. The replay lays each bend as eight short straight pieces; the
circle through their ends is the one used here, so the riders stay on the
boards. They ride low on the track, so the boards are flat where they ride
and bank up outside them, steepest at the middle of each bend.

The game's axes (three.js): the home straight starts at the origin and runs
along +x, and the oval lies to the left (−z), the way the riders turn. Blender
is z-up, so here x is the same, y is three.js −z (into the oval) and z is up;
the glTF exporter turns it round.

The whole hall keeps its daylight colours in both themes, like every field
scene (only the sky follows the phone). There is no roof: the broadcast
camera looks down from high over the west bend.

PR 13av filled the hall with the shared venue blocks (art/venuelib.py): a
seated crowd, thickest along the home straight with gaps for the stairs;
team pens with rollers, a mechanic, a tool chest and a spare wheel;
officials at the desk with their screens; a lap board and bell; a proper
photo-finish camera; a glass rail along the stands, floodlights along the
wall and a big screen on the east end wall.
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

# Import the shared blocks without leaving a __pycache__ folder for the art workflow to commit.
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import venuelib  # noqa: E402
from venuelib import Mesh as VMesh  # noqa: E402
from venuelib import chair, fan, person  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "public" / "models" / "models.json"
OUT = ROOT / "public" / "models" / "velodrome.glb"
PREVIEW = ROOT / "art" / "velodrome" / "preview.jpg"
PREVIEW_CLOSE = ROOT / "art" / "velodrome" / "preview-close.jpg"
# Pinned on purpose, the same as art/tunnel/build.py and .github/workflows/art.yml.
BLENDER = "4.5.15"


def input_hash() -> str:
    """Every art script, in path order, hashed: tests/models.test.ts works it out the same way."""
    h = hashlib.sha256()
    for path in sorted((ROOT / "art").rglob("*.py"), key=lambda p: p.relative_to(ROOT).as_posix().encode()):
        h.update(path.read_bytes())
    return h.hexdigest()[:16]


# The lap: the same numbers as TRACK in src/data/briefs.ts.
LAP = 250.0
STRAIGHT = LAP * 0.2
BEND = (LAP - 2 * STRAIGHT) / 2
PIECES = 8
# The circle through the ends of the replay's bend pieces, m.
RADIUS = (BEND / PIECES) / (2 * math.sin(math.pi / (2 * PIECES)))

# Across the track, metres out from the course's centre line (where the replay
# lays its path; your rider rides 1.1 m out, the old setup 2.5 m: REPLAY_SCENE).
APRON = -4.4  # the grey safety apron starts here
AZUR = -2.2  # the pale blue band below the track
EDGE = -1.2  # the track's inner edge
FLAT = 3.2  # the boards are flat to here, so the riders sit on them
RAIL = 8.0  # the track's outer edge and the barrier
# The banking's height at the outer edge, m, at the middle of a bend; the straights bank STRAIGHT_BANK of that.
BANK = 3.4
STRAIGHT_BANK = 0.3
# The painted lines, each (from, to) across the track: the black measuring line, the red sprinters' line and the blue stayers' line.
LINES = {"Black": (-1.0, -0.94), "Red": (-0.4, -0.34), "Blue": (1.9, 1.96)}
# The stands: their front at STANDS_IN, ROWS rows of seats each ROW deep and STEP higher, the first at STANDS_UP; the hall's wall at WALL_OUT.
STANDS_IN, STANDS_UP, ROWS, ROW, STEP = 10.0, 4.6, 16, 0.875, 0.5
WALL_OUT, WALL_UP = 24.5, 15.0
# The crowd: a seat every SEAT metres along a row, a stair every AISLE metres round the stands.
SEAT, AISLE = 0.6, 12.0
# The warm-up lane round the infield.
LANE = (-9.0, -7.8)

# Colours, sRGB hex. The pine and the infield match the code-drawn track (src/render/replayScene.ts COLOURS).
COLOURS = {
    "Boards": "C89F6A",
    "BoardsAlt": "BF9561",
    "Apron": "8E98A3",
    "Azur": "8DBBDD",
    "Black": "1D242B",
    "Red": "D23B2F",
    "Blue": "2F6FD0",
    "White": "F4F4F2",
    "Barrier": "EEF0F5",
    "Rail": "5D6873",
    "Concrete": "B9C0C8",
    "Seats": "3E4A7A",
    "SeatsAlt": "4A5788",
    "Riser": "2C3560",
    "HallWall": "D7DBE6",
    "Infield": "A9B8C6",
    "Lane": "93A3B4",
    "Desk": "E9ECF2",
    "Steel": "5D6873",
    # The team pens, one colour each.
    "PenCoral": "E0695D",
    "PenTeal": "2E9E95",
    "PenIndigo": "4F5BD5",
    "PenAmber": "E3A23B",
    "PenLilac": "A88BE0",
    "PenSlate": "6B7680",
    "Gold": "D9B44A",
    "Silver": "B9C0C8",
    "Bronze": "B9784A",
    # The crowd, the officials and the hall's kit (PR 13av).
    "Skin": "D9A88B",
    "Shirt1": "4F5BD5",
    "Shirt2": "E0695D",
    "Shirt3": "E3A23B",
    "Shirt4": "2E9E95",
    "Shirt5": "A88BE0",
    "Screen": "3D5BFF",
    "Glass": "2C3560",
    "Pane": "C9D6E6",
    "Lamp": "FFF4D6",
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
    """The material for a colour name, made once: matte, two-sided unless it's the hall's wall."""
    if name not in MATS:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = srgb(COLOURS[name])
        bsdf.inputs["Roughness"].default_value = 0.4 if name in ("Rail", "Steel", "Gold", "Silver", "Bronze") else 0.85
        bsdf.inputs["Metallic"].default_value = 0.3 if name in ("Rail", "Steel") else 0.0
        # The hall's wall faces in and is one-sided, so a low camera outside it sees through.
        m.use_backface_culling = name == "HallWall"
        if name == "Lamp":
            bsdf.inputs["Emission Color"].default_value = srgb(COLOURS[name])
            bsdf.inputs["Emission Strength"].default_value = 2.0
        MATS[name] = m
    return MATS[name]


# The shared blocks' pieces take this hall's colours and materials.
venuelib.COLOURS.update(COLOURS)
venuelib.mat = mat


class Mesh:
    """A bmesh that collects faces with named materials, then becomes one object."""

    def __init__(self) -> None:
        self.bm = bmesh.new()
        self.names: list[str] = []

    def index(self, name: str) -> int:
        if name not in self.names:
            self.names.append(name)
        return self.names.index(name)

    def quad(self, pts: list[tuple[float, float, float]], name: str, up: bool | None = None) -> None:
        """A face through these points; `up` turns it to face up (True) or leaves it as wound."""
        f = self.bm.faces.new([self.bm.verts.new(p) for p in pts])
        f.material_index = self.index(name)
        f.normal_update()
        if up is True and f.normal.z < 0:
            f.normal_flip()

    def box(self, centre: tuple[float, float, float], size: tuple[float, float, float], name: str) -> None:
        geom = bmesh.ops.create_cube(self.bm, size=1.0)
        verts = geom["verts"]
        bmesh.ops.scale(self.bm, vec=Vector(size), verts=verts)
        bmesh.ops.translate(self.bm, vec=Vector(centre), verts=verts)
        idx = self.index(name)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = idx

    def done(self, obj_name: str) -> bpy.types.Object:
        # Neighbouring quads share their edges: weld them, so the file stays small.
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-4)
        me = bpy.data.meshes.new(obj_name)
        self.bm.to_mesh(me)
        self.bm.free()
        for n in self.names:
            me.materials.append(mat(n))
        obj = bpy.data.objects.new(obj_name, me)
        bpy.context.collection.objects.link(obj)
        return obj


# --- The lap: stations round the course's centre line.


class Station:
    """A point on the centre line, the way out of the oval there, how much of the full banking it has, and what's painted from it to the next."""

    def __init__(self, x: float, y: float, nx: float, ny: float, bank: float, paint: str | None = None) -> None:
        self.x, self.y, self.nx, self.ny, self.bank, self.paint = x, y, nx, ny, bank, paint

    def at(self, d: float, z: float) -> tuple[float, float, float]:
        return (self.x + self.nx * d, self.y + self.ny * d, z)


def stations(straight_step: float, bend_steps: int, marks: bool) -> list[Station]:
    """Round the lap anticlockwise from the head of the home straight; with `marks`, the finish and the two pursuit lines get their own bands."""
    out: list[Station] = []
    # The home straight, along +x; outside is −y.
    bands = [(0.0, 0.25, "White"), (STRAIGHT / 2 - 0.125, STRAIGHT / 2 + 0.125, "Red")] if marks else []
    xs = {round(straight_step * i, 4) for i in range(int(STRAIGHT / straight_step))}
    xs = {x for x in xs if not any(lo < x < hi for lo, hi, _ in bands)} | {e for lo, hi, _ in bands for e in (lo, hi)}
    for x in sorted(xs):
        paint = next((n for lo, hi, n in bands if lo <= x < hi), None)
        out.append(Station(x, 0.0, 0.0, -1.0, STRAIGHT_BANK, paint))
    # The first bend, round (STRAIGHT, RADIUS): banked hardest at its middle.
    for k in range(bend_steps):
        t = k / bend_steps
        a = -math.pi / 2 + math.pi * t
        out.append(Station(STRAIGHT + RADIUS * math.cos(a), RADIUS + RADIUS * math.sin(a), math.cos(a), math.sin(a), bend_bank(t)))
    # The back straight, along −x; outside is +y. Its pursuit line faces the home straight's.
    bands = [(STRAIGHT / 2 - 0.125, STRAIGHT / 2 + 0.125, "Red")] if marks else []
    xs = {round(STRAIGHT - straight_step * i, 4) for i in range(int(STRAIGHT / straight_step))}
    xs = {x for x in xs if not any(lo < x < hi for lo, hi, _ in bands)} | {e for lo, hi, _ in bands for e in (lo, hi)}
    for x in sorted(xs, reverse=True):
        # Ridden the other way: a band runs from its high end down to its low end.
        paint = next((n for lo, hi, n in bands if lo < x <= hi), None)
        out.append(Station(x, 2 * RADIUS, 0.0, 1.0, STRAIGHT_BANK, paint))
    # The second bend, round (0, RADIUS).
    for k in range(bend_steps):
        t = k / bend_steps
        a = math.pi / 2 + math.pi * t
        out.append(Station(RADIUS * math.cos(a), RADIUS + RADIUS * math.sin(a), math.cos(a), math.sin(a), bend_bank(t)))
    return out


def bend_bank(t: float) -> float:
    """The share of the full banking a bend has `t` of the way round it: the straights' at each end, all of it at the middle."""
    return STRAIGHT_BANK + (1 - STRAIGHT_BANK) * math.sin(math.pi * t)


def height(d: float, bank: float) -> float:
    """The boards' height `d` metres out: flat where the riders ride, then curving up to the rail."""
    if d <= FLAT:
        return 0.0
    u = (d - FLAT) / (RAIL - FLAT)
    return BANK * bank * u**1.5


def track_profile() -> list[tuple[float, str]]:
    """The breaks across the track, each with the colour from it to the next: apron, the blue band, then pine in two tones with the lines painted on."""
    cuts: list[tuple[float, str]] = [(APRON, "Apron"), (AZUR, "Azur")]
    d = EDGE
    tone = 0
    marks = sorted((a, b, n) for n, (a, b) in LINES.items())
    while d < RAIL - 1e-6:
        line = next(((a, b, n) for a, b, n in marks if a <= d + 1e-6 < b), None)
        if line:
            cuts.append((d, line[2]))
            d = line[1]
            continue
        # Pine to the next 0.8 m step, the next line, or the rail, whichever is first.
        nxt = min([d + 0.8, RAIL] + [a for a, _, _ in marks if a > d + 1e-6])
        cuts.append((d, "BoardsAlt" if tone % 2 else "Boards"))
        tone += 1
        d = nxt
    cuts.append((RAIL, ""))
    return cuts


def build_track() -> None:
    """The boards, the apron and the blue band, swept round the lap, with the finish and pursuit lines across the boards."""
    m = Mesh()
    st = stations(2.5, 36, True)
    prof = track_profile()
    n = len(st)
    for i in range(n):
        a, b = st[i], st[(i + 1) % n]
        for k in range(len(prof) - 1):
            d0, name = prof[k]
            d1 = prof[k + 1][0]
            # A line across the track covers the boards, not the apron or the blue band.
            if a.paint and d0 >= EDGE - 1e-6:
                name = a.paint
            m.quad([a.at(d0, height(d0, a.bank)), b.at(d0, height(d0, b.bank)), b.at(d1, height(d1, b.bank)), a.at(d1, height(d1, a.bank))], name, up=True)
    obj = m.done("Track")
    for p in obj.data.polygons:
        p.use_smooth = True


def build_infield() -> None:
    """The infield floor inside the apron, with the warm-up lane round it."""
    m = Mesh()
    st = stations(5.0, 32, False)
    n = len(st)
    bands = [(LANE[1], APRON, "Infield"), (LANE[0], LANE[1], "Lane")]
    for i in range(n):
        a, b = st[i], st[(i + 1) % n]
        for d0, d1, name in bands:
            m.quad([a.at(d0, 0), b.at(d0, 0), b.at(d1, 0), a.at(d1, 0)], name, up=True)
    # Everything inside the lane: one floor (the oval is convex, so a single face holds).
    m.quad([s.at(LANE[0], 0) for s in st], "Infield", up=True)
    m.done("Infield")


def build_barrier() -> None:
    """The barrier at the top of the boards: a white wall a metre high with a rail along it, and the floor behind."""
    m = Mesh()
    st = stations(2.5, 36, False)
    n = len(st)
    for i in range(n):
        a, b = st[i], st[(i + 1) % n]
        za, zb = height(RAIL, a.bank), height(RAIL, b.bank)
        # The wall, from the boards' edge (and from the floor, so no gap shows below it).
        m.quad([a.at(RAIL, 0), b.at(RAIL, 0), b.at(RAIL, zb + 1.0), a.at(RAIL, za + 1.0)], "Barrier")
        # The rail on top.
        m.quad([a.at(RAIL, za + 1.0), b.at(RAIL, zb + 1.0), b.at(RAIL + 0.15, zb + 1.05), a.at(RAIL + 0.15, za + 1.05)], "Rail", up=True)
        # The concourse floor between the barrier and the stands.
        m.quad([a.at(RAIL, 0), b.at(RAIL, 0), b.at(STANDS_IN, 0), a.at(STANDS_IN, 0)], "Concrete", up=True)
    m.done("Barrier")


def build_stands() -> None:
    """The stands all round: a concrete front, rows of seats stepping up and back, and the hall's wall behind."""
    m = Mesh()
    st = stations(5.0, 20, False)
    n = len(st)
    for i in range(n):
        a, b = st[i], st[(i + 1) % n]
        m.quad([a.at(STANDS_IN, 0), b.at(STANDS_IN, 0), b.at(STANDS_IN, STANDS_UP), a.at(STANDS_IN, STANDS_UP)], "Concrete")
        for r in range(ROWS):
            d0, d1 = STANDS_IN + ROW * r, STANDS_IN + ROW * (r + 1)
            z = STANDS_UP + STEP * r
            m.quad([a.at(d0, z), b.at(d0, z), b.at(d1, z), a.at(d1, z)], "SeatsAlt" if r % 2 else "Seats", up=True)
            m.quad([a.at(d1, z), b.at(d1, z), b.at(d1, z + STEP), a.at(d1, z + STEP)], "Riser")
        top = STANDS_UP + STEP * ROWS
        d_top = STANDS_IN + ROW * ROWS
        m.quad([a.at(d_top, top), b.at(d_top, top), b.at(WALL_OUT, top), a.at(WALL_OUT, top)], "Concrete", up=True)
    m.done("Stands")
    # The hall's wall: one-sided, facing in, so it never hides the oval from a camera outside it.
    w = Mesh()
    for i in range(n):
        a, b = st[i], st[(i + 1) % n]
        pts = [a.at(WALL_OUT, 0), a.at(WALL_OUT, WALL_UP), b.at(WALL_OUT, WALL_UP), b.at(WALL_OUT, 0)]
        w.quad(pts, "HallWall")
        w.bm.faces.ensure_lookup_table()
        f = w.bm.faces[-1]
        # Face in: towards the oval's middle.
        mid = f.calc_center_median()
        if f.normal.dot(Vector((STRAIGHT / 2 - mid.x, RADIUS - mid.y, 0))) < 0:
            f.normal_flip()
    w.done("HallWall")


def seat_fill(st: Station, r: int) -> float:
    """How full a stand is here: the home straight (outside is −y) fullest, the back straight less, the bends thin; the lower rows fuller."""
    base = 0.15 if st.ny < -0.99 else 0.06 if st.ny > 0.99 else 0.022
    return base * (1.25 - 0.6 * r / ROWS)


def spread(k: int, salt: float) -> float:
    """A fixed, even spread in 0..1 for the k-th seat: the same every build."""
    v = math.sin(k * 12.9898 + salt * 78.233) * 43758.5453
    return v - math.floor(v)


def build_crowd() -> None:
    """People dotted through the stands, seated, thickest along the home straight, with gaps for the stairs."""
    m = VMesh()
    st = stations(5.0, 20, False)
    n = len(st)
    shirts = ("Shirt1", "Shirt2", "Shirt3", "Shirt4", "Shirt5", "White")
    k = 0
    along = 0.0
    for i in range(n):
        a, b = st[i], st[(i + 1) % n]
        for r in range(ROWS):
            d = STANDS_IN + ROW * r + 0.45
            z = STANDS_UP + STEP * r
            pa, pb = Vector(a.at(d, z)), Vector(b.at(d, z))
            seats = max(1, int((pb - pa).length / SEAT))
            for j in range(seats):
                k += 1
                # A stair every AISLE metres round the stands.
                if (along + (j + 0.5) * SEAT) % AISLE < 1.2:
                    continue
                if spread(k, 1) > seat_fill(a, r):
                    continue
                p = pa.lerp(pb, (j + 0.5) / seats)
                fan(m, p.x, p.y, z, shirts[int(spread(k, 2) * len(shirts))])
        along += (Vector(b.at(STANDS_IN, 0)) - Vector(a.at(STANDS_IN, 0))).length
    m.done("Crowd")


def build_hall_kit() -> None:
    """The hall round the track: a rail along the stands' front, floodlights along the top of the wall and the big screen on the east end wall."""
    m = Mesh()
    st = stations(5.0, 20, False)
    n = len(st)
    for i in range(n):
        a, b = st[i], st[(i + 1) % n]
        m.quad([a.at(STANDS_IN, STANDS_UP), b.at(STANDS_IN, STANDS_UP), b.at(STANDS_IN, STANDS_UP + 1.0), a.at(STANDS_IN, STANDS_UP + 1.0)], "Pane")
        m.quad([a.at(STANDS_IN, STANDS_UP + 1.0), b.at(STANDS_IN, STANDS_UP + 1.0), b.at(STANDS_IN + 0.1, STANDS_UP + 1.05), a.at(STANDS_IN + 0.1, STANDS_UP + 1.05)], "Rail", up=True)
    m.done("StandRail")
    v = VMesh()
    # Floodlights on brackets along the top of the wall, every fourth station, tilted down at the track.
    ex = STRAIGHT + RADIUS + WALL_OUT - 0.6
    for i in range(0, n, 4):
        s = st[i]
        x, y, _ = s.at(WALL_OUT - 0.4, 0)
        # None in front of the big screen.
        if x > ex - 8 and abs(y - RADIUS) < 9:
            continue
        with v.at(x, y, WALL_UP - 0.6, math.atan2(-s.ny, -s.nx)):
            v.box(-0.4, 0.0, -0.1, 0.1, -0.1, 0.1, "Steel")
            v.box(0.0, 0.25, -0.6, 0.6, -0.35, 0.35, "Black")
            v.box(0.25, 0.27, -0.5, 0.5, -0.28, 0.28, "Lamp")
    # The big screen on the east end wall, facing back down the hall (−x), over the top row.
    v.box(ex, ex + 0.5, RADIUS - 5.2, RADIUS + 5.2, 12.9, 18.1, "Black")
    v.box(ex - 0.03, ex, RADIUS - 4.9, RADIUS + 4.9, 13.2, 17.8, "Screen")
    for y in (RADIUS - 3.0, RADIUS + 3.0):
        v.box(ex + 0.1, ex + 0.4, y - 0.15, y + 0.15, 9.0, 12.9, "Steel")
    v.done("HallKit")


def build_infield_kit() -> None:
    """The infield's furniture: six team pens along the home straight, the officials' desk at the line, the podium, the lap board and bell, and the photo-finish mast."""
    m = VMesh()
    pens = ["PenCoral", "PenTeal", "PenIndigo", "PenAmber", "PenLilac", "PenSlate"]
    staff = ("Shirt1", "Shirt2", "Shirt3", "Shirt4", "Shirt5", "White")
    for k, colour in enumerate(pens):
        x = 8.0 + k * 6.2
        y = 12.5
        # The pen's mat, its bench along the back, a team board behind it.
        m.box(x - 2.5, x + 2.5, y - 1.8, y + 1.8, 0, 0.08, colour)
        m.box(x - 2.1, x + 2.1, y + 1.3, y + 1.75, 0.08, 0.5, "Desk")
        m.box(x - 2.3, x + 2.3, y + 2.0, y + 2.08, 1.3, 2.1, colour)
        m.cone(x, y + 2.04, 0, 1.3, 0.05, 0.05, 4, "Steel")
        # Two sets of rollers: a frame and three drums each.
        for rx in (x - 1.2, x + 0.4):
            for side in (-0.28, 0.28):
                m.box(rx - 0.75, rx + 0.75, y - 0.3 + side - 0.03, y - 0.3 + side + 0.03, 0.08, 0.16, "Steel")
            for dx in (-0.55, 0.0, 0.55):
                m.cyl((rx + dx, y - 0.58, 0.2), (rx + dx, y - 0.02, 0.2), 0.06, "Silver", 6, cap=False)
        # A mechanic on the bench, a tool chest and two spare wheels against it.
        person(m, x - 0.8 + 0.3 * (k % 2), y + 1.52, staff[k % 6], sitting=True)
        m.box(x + 1.55, x + 2.05, y + 0.05, y + 0.55, 0.08, 0.68, "Rail")
        m.poly([(x + 1.8 + 0.34 * math.cos(a), y + 0.75, 0.42 + 0.34 * math.sin(a)) for a in (2 * math.pi * k / 12 for k in range(12))], "Black")
    # The officials' desk inside the apron, level with the finish line: three officials on chairs behind it, screens on top.
    m.box(-1.1, 2.3, 5.1, 6.1, 0, 0.9, "Desk")
    m.box(-1.1, 2.3, 5.05, 5.1, 0.1, 0.8, "PenIndigo")
    for k, ox in enumerate((-0.3, 0.6, 1.5)):
        chair(m, ox, 6.7, "Black")
        person(m, ox, 6.7, ("White", "Shirt5", "White")[k], sitting=True)
        m.box(ox - 0.25, ox + 0.25, 5.5, 5.55, 0.9, 1.25, "Black")
        m.box(ox - 0.22, ox + 0.22, 5.49, 5.5, 0.93, 1.22, "Screen")
    # The podium behind it: second, first, third, the sponsors' board behind.
    for dx, h, colour in ((-1.3, 0.5, "Silver"), (0.0, 0.8, "Gold"), (1.3, 0.35, "Bronze")):
        m.box(0.6 + dx - 0.6, 0.6 + dx + 0.6, 8.4, 9.6, 0, h, colour)
    m.box(-1.6, 2.8, 10.0, 10.1, 0.0, 2.4, "PenIndigo")
    m.box(-1.4, 2.6, 9.98, 10.0, 1.6, 2.2, "White")
    # The lap board and its bell at the line's infield end, facing the track.
    for lx in (-3.6, -1.6):
        m.cone(lx, 4.4, 0, 1.8, 0.05, 0.05, 6, "Steel")
    m.box(-3.8, -1.4, 4.3, 4.4, 1.8, 2.8, "Black")
    for j in range(2):
        m.box(-3.4 + j * 1.0, -2.8 + j * 1.0, 4.28, 4.3, 1.95, 2.65, "Gold")
    m.cone(-0.9, 4.4, 0, 2.2, 0.04, 0.04, 6, "Steel")
    m.cone(-0.9, 4.4, 2.0, 2.3, 0.16, 0.06, 10, "Gold")
    # The photo-finish mast outside the barrier, on the line, its camera looking across it.
    m.cone(0.0, -(RAIL + 0.9), 0, 6.0, 0.12, 0.09, 8, "Steel")
    m.box(-0.3, 0.3, -(RAIL + 0.95), -(RAIL + 0.2), 5.6, 6.1, "Black")
    m.cyl((0.0, -(RAIL + 0.2), 5.85), (0.0, -(RAIL + 0.05), 5.85), 0.12, "Glass", 10)
    m.done("InfieldKit")


# --- Previews.


def preview_scene() -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.device = "CPU"
    scene.render.image_settings.file_format = "JPEG"
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = srgb("DDE6F0")
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    scene.world = world
    sun = bpy.data.lights.new("Key", "SUN")
    sun.energy = 3.0
    sun_obj = bpy.data.objects.new("Key", sun)
    sun_obj.rotation_euler = (0.6, 0.3, 0.6)
    scene.collection.objects.link(sun_obj)


def shoot(path: Path, at: tuple[float, float, float], look: tuple[float, float, float], fov_deg: float, size: tuple[int, int]) -> None:
    scene = bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = size
    cam = bpy.data.cameras.new("Cam")
    cam.sensor_fit = "VERTICAL" if size[1] > size[0] else "HORIZONTAL"
    cam.angle = math.radians(fov_deg)
    cam_obj = bpy.data.objects.new("Cam", cam)
    cam_obj.location = at
    scene.collection.objects.link(cam_obj)
    cam_obj.rotation_euler = (Vector(look) - Vector(at)).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build_track()
    build_infield()
    build_barrier()
    build_stands()
    build_infield_kit()
    build_crowd()
    build_hall_kit()

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
        # The replay's broadcast camera (REPLAY_SCENE.track.camera): high over the west bend, looking along the oval.
        cx, cy = STRAIGHT / 2, RADIUS
        shoot(PREVIEW, (cx - 26, cy, 108), (cx + 4, cy, 0), 70, (600, 960))
        shoot(PREVIEW_CLOSE, (-8, 14, 6), (40, -4, 0), 55, (960, 600))
        print(f"wrote {PREVIEW} and {PREVIEW_CLOSE}")
    MANIFEST.write_text(json.dumps({"inputHash": input_hash(), "blender": BLENDER}, indent=2) + "\n")
    print(f"wrote {MANIFEST}")


main()
