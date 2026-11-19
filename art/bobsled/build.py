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

PR 13aw polished it with the shared venue blocks (art/venuelib.py): a
gabled start house with board walls, framed windows, a start clock and
coaches on decks either side; truss gantries on tapered legs with lit
clocks, a photo-finish camera on the finish arch; gabled sun roofs; rounded
spectators in winter coats behind a rail on the terraces; tapered masts with
lamp frames; and past the line a finish house with a balcony of officials,
a braced scoreboard, a podium, advertising boards along the bank, a crowd in
the stand and pines on the snow.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

# Import the shared blocks without leaving a __pycache__ folder for the art workflow to commit.
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import venuelib  # noqa: E402
from kitlib import ROOT  # noqa: E402
from venuelib import Mesh, person, run, srgb, tree  # noqa: E402

OUT = ROOT / "public" / "models" / "bobsled.glb"
PREVIEW = ROOT / "art" / "bobsled" / "preview.jpg"

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

venuelib.COLOURS.update(
    {
        "Snow": "F4F7FA",
        "Ice": "DDE9F2",
        "Lip": "93A3B1",
        "Timber": "B98E62",
        "Batten": "9C7650",
        "Slate": "3E4A5C",
        "Roof": "5A6675",
        "Steel": "8D98A5",
        "Glass": "2C3560",
        "Teal": "2E9E95",
        "Coral": "E0695D",
        "White": "F4F4F2",
        "Black": "1D242B",
        # The clocks' figures glow amber; the floodlights white.
        "Lamp": "FFB347",
        "Flood": "FFF4D6",
        "Board": "222A36",
        "Gold": "D9B44A",
        "Silver": "C9CFD6",
        "Bronze": "B07A4F",
        "Trunk": "6B5A4A",
        "Pine": "4F6B55",
        "Skin": "E2B48F",
        # The crowd's coats and hats.
        "Coat1": "E0695D",
        "Coat2": "3E4A7A",
        "Coat3": "E3A23B",
        "Coat4": "B48CE8",
        "Coat5": "2E9E95",
        "Coat6": "F4F4F2",
    }
)
venuelib.EMISSIVE["Flood"] = 2.0
venuelib.GLOSSY["Ice"] = 0.25
COATS = ["Coat1", "Coat2", "Coat3", "Coat4", "Coat5", "Coat6"]


def spread(k: int, salt: float) -> float:
    """A fixed, even spread in 0..1 for the k-th spot: the same every build."""
    v = math.sin(k * 12.9898 + salt * 78.233) * 43758.5453
    return v - math.floor(v)


def grid(m: Mesh, rows: list[list[tuple[float, float, float]]], name: str) -> None:
    """A sheet through rows of points (each row across), as quads."""
    vs = [[m.vert(p) for p in row] for row in rows]
    for i in range(len(vs) - 1):
        for j in range(len(vs[i]) - 1):
            m.face([vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j]], name)


def fan_standing(m: Mesh, x: float, y: float, z: float, k: int, turn: float = 0.0) -> None:
    """A spectator standing on a floor at z, facing −y (or turned): a winter coat, a hat on most."""
    coat = COATS[int(spread(k, 3) * len(COATS))]
    hat = COATS[int(spread(k, 4) * len(COATS))] if spread(k, 5) < 0.7 else None
    with m.at(x, y, z, turn, 0.95 + 0.1 * spread(k, 6)):
        person(m, 0, 0, coat, coat=True, hat=hat)


def stander(m: Mesh, x: float, y: float, z: float, k: int, turn: float = 0.0) -> None:
    """A spectator in a crowd, standing on a floor at z: dark legs, a winter coat, a head and on most a knitted hat, about thirty-five corners."""
    coat = COATS[int(spread(k, 3) * len(COATS))]
    tall = 0.95 + 0.1 * spread(k, 6)
    with m.at(x, y, z, turn, tall):
        m.cyl((0, 0, 0), (0, 0, 0.52), 0.13, "Black", 5, rb=0.16, cap=False)
        m.cyl((0, 0, 0.5), (0, 0, 1.42), 0.25, coat, 6, rb=0.17)
        c, r = (0.0, 0.0, 1.6), 0.13
        o = [m.vert((c[0] + dx * r, c[1] + dy * r, c[2] + dz * r)) for dx, dy, dz in ((1, 0, 0), (0, 1, 0), (-1, 0, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]
        for i in range(4):
            m.face((o[i], o[(i + 1) % 4], o[4]), "Skin", smooth=True)
            m.face((o[(i + 1) % 4], o[i], o[5]), "Skin", smooth=True)
        if spread(k, 5) < 0.7:
            m.cyl((0, 0, 1.66), (0, 0, 1.86), 0.14, COATS[int(spread(k, 4) * len(COATS))], 5, rb=0.04)


def bank_z(out: float) -> float:
    """The snow bank's height this far out from the centre line (the scene's bank, straight from lip to end)."""
    o = abs(out)
    if o <= LIP_OUT:
        return LIP_TOP
    if o >= BANK_OUT:
        return BANK_END
    return LIP_TOP - BANK_DROP * (o - LIP_OUT) / BANK


def rail(m: Mesh, x0: float, x1: float, y: float, z: float, every: float = 2.0, top: str = "Steel") -> None:
    """A handrail 1.1 m high along x at y on a floor at z, on posts."""
    m.rod((x0, y, z + 1.1), (x1, y, z + 1.1), 0.035, top, 6)
    n = max(1, round((x1 - x0) / every))
    for k in range(n + 1):
        x = x0 + (x1 - x0) * k / n
        m.rod((x, y, z), (x, y, z + 1.1), 0.025, "Steel")


def start_house() -> None:
    """The covered start: board walls each side of the channel, a gabled roof, open at the downhill end with the start clock over it, coaches on decks either side."""
    m = Mesh()
    x0, x1 = -8.0, 10.0
    wall = 5.4
    eave = 5.4
    for side in (-1, 1):
        y_in, y_out = side * wall, side * (wall + 0.4)
        lo, hi = min(y_in, y_out), max(y_in, y_out)
        m.box(x0, x1, lo, hi, -2.0, eave, "Timber")
        # Battens down the outside, so the walls read as boards.
        face = hi + 0.03 if side > 0 else lo - 0.03
        for k in range(10):
            x = x0 + 0.9 + k * (x1 - x0 - 1.8) / 9
            m.box(x - 0.06, x + 0.06, min(face, face - side * 0.06), max(face, face - side * 0.06), -0.5, eave, "Batten")
        # A band of windows along each wall, framed, with mullions.
        m.box(x0 + 1.4, x1 - 1.4, lo - 0.06, hi + 0.06, 2.7, 4.4, "White")
        m.box(x0 + 1.5, x1 - 1.5, lo - 0.08, hi + 0.08, 2.8, 4.3, "Glass")
        for k in range(1, 5):
            x = x0 + 1.5 + k * (x1 - x0 - 3.0) / 5
            m.box(x - 0.05, x + 0.05, lo - 0.1, hi + 0.1, 2.8, 4.3, "White")
        # The coaches' deck along the outside on posts, with its rail and stair.
        d_in, d_out = side * (wall + 0.4), side * (wall + 2.4)
        dlo, dhi = min(d_in, d_out), max(d_in, d_out)
        m.box(x0, x1, dlo, dhi, 2.2, 2.45, "Slate")
        for x in (x0 + 0.3, (x0 + x1) / 2, x1 - 0.3):
            m.cone(x, side * (wall + 2.2), -1.0, 2.2, 0.08, 0.08, 6, "Steel")
        rail(m, x0, x1, side * (wall + 2.35), 2.45, 3.0)
        m.rod((x1, side * (wall + 0.45), 3.55), (x1, side * (wall + 2.35), 3.55), 0.035, "Steel", 6)
    # The back wall.
    m.box(x0 - 0.4, x0, -wall - 0.4, wall + 0.4, -2.0, eave, "Timber")
    # The gabled roof with its eaves, the gable ends boarded.
    m.roof(x0 - 0.8, x1 + 0.8, -wall - 1.0, wall + 1.0, eave, 1.6, "Roof")
    for x in (x0 - 0.4, x1):
        m.poly([(x, -wall - 0.4, eave), (x, wall + 0.4, eave), (x, 0, eave + 1.5)], "Timber")
    # A teal fascia across the open end, the start lights under it and the start clock on the gable.
    m.box(x1 + 0.05, x1 + 0.3, -wall - 0.4, wall + 0.4, eave - 0.6, eave, "Teal")
    for k in range(5):
        y = -1.6 + k * 0.8
        m.box(x1 + 0.3, x1 + 0.42, y - 0.18, y + 0.18, eave - 1.1, eave - 0.75, "Lamp" if k == 4 else "Black")
    m.box(x1 + 0.05, x1 + 0.3, -1.4, 1.4, eave + 0.1, eave + 0.9, "Board")
    for k in range(4):
        y = -1.05 + k * 0.7
        m.box(x1 + 0.3, x1 + 0.33, y - 0.22, y + 0.22, eave + 0.25, eave + 0.75, "Lamp")
    # A flag on the ridge at the back.
    m.cone(x0 - 0.4, 0, eave + 1.5, eave + 4.5, 0.05, 0.035, 6, "Steel")
    m.box(x0 - 0.38, x0 + 0.9, -0.02, 0.02, eave + 3.7, eave + 4.4, "Coral")
    # The push track's start block: a bar across the ice the crew brace on.
    m.box(-0.3, 0.0, -1.2, 1.2, 0.0, 0.18, "Coral")
    # Coaches on the decks: three on the left, two on the right, facing the channel.
    for k, x in enumerate((-4.5, 0.5, 6.0)):
        fan_standing(m, x, wall + 1.6, 2.45, 100 + k)
    for k, x in enumerate((-2.5, 3.5)):
        fan_standing(m, x, -wall - 1.6, 2.45, 110 + k, math.pi)
    m.done("StartHouse")


def truss(m: Mesh, leg: float, top: float, depth: float = 0.6) -> None:
    """A box truss across the channel between the legs: four chords and zig-zag braces on each face."""
    zs = (top - depth, top)
    for x in (-0.2, 0.2):
        for z in zs:
            m.rod((x, -leg, z), (x, leg, z), 0.045, "Steel", 6)
        n = 10
        for k in range(n):
            y0 = -leg + 2 * leg * k / n
            y1 = -leg + 2 * leg * (k + 1) / n
            m.rod((x, y0, zs[k % 2]), (x, y1, zs[(k + 1) % 2]), 0.025, "Steel")


def arch(name: str, chequer: bool) -> None:
    """A gantry over the channel: tapered legs on the banks, a truss and a lit clock on top (or the chequered finish banner and the photo-finish camera)."""
    m = Mesh()
    leg = 4.4
    top = 5.6
    for side in (-1, 1):
        y = side * leg
        m.cone(0, y, -1.5, top, 0.24, 0.16, 8, "Steel")
        m.box(-0.5, 0.5, y - 0.5, y + 0.5, bank_z(leg) - 0.4, bank_z(leg) + 0.15, "Lip")
        # The timing eye on each leg, looking across the channel.
        m.box(-0.15, 0.15, y - side * 0.35 - 0.12, y - side * 0.35 + 0.12, LIP_TOP + 0.2, LIP_TOP + 0.5, "Black")
        m.cyl((0, y - side * 0.47, LIP_TOP + 0.35), (0, y - side * 0.52, LIP_TOP + 0.35), 0.06, "Lamp", 6)
    truss(m, leg, top)
    if chequer:
        sq = 0.55
        n = int((2 * leg + 0.4) / sq)
        for k in range(n):
            y0 = -leg - 0.2 + k * sq
            for row in range(2):
                colour = "Black" if (k + row) % 2 else "White"
                m.box(-0.12, 0.12, y0, y0 + sq, top - 1.1 - sq + row * sq, top - 1.1 + row * sq, colour)
        # Teal banners down each leg, and the photo-finish camera on the left one, looking across the line.
        for side in (-1, 1):
            y = side * leg
            m.box(-0.3, -0.26, y - 0.35, y + 0.35, LIP_TOP + 0.8, top - 1.4, "Teal")
            m.box(0.26, 0.3, y - 0.35, y + 0.35, LIP_TOP + 0.8, top - 1.4, "Teal")
        m.box(-0.25, 0.25, leg - 0.85, leg - 0.25, top - 1.4, top - 1.0, "Black")
        m.cyl((0, leg - 0.85, top - 1.2), (0, leg - 1.05, top - 1.2), 0.13, "Glass", 10)
    else:
        # The clock: a dark board with its glowing figures, a teal cap on top.
        m.box(-0.25, 0.25, -1.9, 1.9, top, top + 1.3, "Board")
        for k in range(5):
            y = -1.4 + k * 0.7
            m.box(-0.3, 0.3, y - 0.24, y + 0.24, top + 0.35, top + 0.95, "Lamp")
        m.box(-0.3, 0.3, -2.0, 2.0, top + 1.3, top + 1.45, "Teal")
    m.done(name)


def shade() -> None:
    """One bay of the sun roof: round posts on the banks and a shallow gabled roof, 8.6 m long so bays overlap on a curve."""
    m = Mesh()
    half = 4.3
    for side in (-1, 1):
        y = side * 4.8
        m.cone(0, y, -1.5, 5.0, 0.16, 0.12, 8, "Steel")
        m.box(-half, half, y - 0.12, y + 0.12, 4.75, 5.0, "Steel")
        m.rod((0, y, 3.9), (0, y - side * 1.6, 4.85), 0.05, "Steel")
    m.roof(-half, half, -5.4, 5.4, 5.0, 0.6, "Roof")
    m.box(-0.12, 0.12, -4.8, 4.8, 4.8, 5.0, "Steel")
    m.done("Shade")


def terrace() -> None:
    """Stepped standing room on the channel's left, a rail at the front, a crowd of about thirty in winter coats and a banner along the back."""
    m = Mesh()
    x0, x1 = -7.0, 7.0
    front = 4.8
    floor = bank_z(front) - 0.3
    m.box(x0, x1, front, 13.0, -3.0, floor, "Snow")
    rise, tread = 0.45, 1.4
    for k in range(5):
        y = front + 0.6 + k * tread
        m.box(x0, x1, y, 13.0, floor + k * rise, floor + (k + 1) * rise, "Timber" if k % 2 == 0 else "Slate")
    # The rail along the front, coral on top.
    rail(m, x0 + 0.2, x1 - 0.2, front + 0.25, floor, 1.75, "Coral")
    # A banner on posts along the back.
    for x in (x0 + 0.3, 0.0, x1 - 0.3):
        m.cone(x, 12.8, floor + 5 * rise, floor + 5 * rise + 2.4, 0.06, 0.06, 6, "Steel")
    m.box(x0 + 0.3, x1 - 0.3, 12.76, 12.84, floor + 5 * rise + 1.4, floor + 5 * rise + 2.3, "Teal")
    # The crowd: most at the rail, the rest along the steps.
    k = 0
    for j in range(12):
        k += 1
        if spread(k, 1) < 0.85:
            stander(m, x0 + 0.8 + j * 1.05 + (spread(k, 2) - 0.5) * 0.4, front + 0.55, floor, k)
    for r in range(1, 5):
        z = floor + (r + 1) * rise
        y = front + 0.6 + r * tread + 0.6
        for j in range(10):
            k += 1
            if spread(k, 1) < 0.45:
                stander(m, x0 + 0.7 + j * 1.4 + (spread(k, 2) - 0.5) * 0.6, y + (spread(k, 7) - 0.5) * 0.4, z, k)
    m.done("Terrace")


def light_mast() -> None:
    """A floodlight mast on the channel's left: a tapering pole and a frame of six lamps leaning over the ice."""
    m = Mesh()
    y = 7.6
    m.cone(0, y, -1.5, 12.0, 0.24, 0.12, 10, "Steel")
    m.cone(0, y, bank_z(y) - 0.4, bank_z(y) + 0.3, 0.5, 0.5, 10, "Lip")
    m.rod((0, y, 11.7), (0, y - 1.7, 11.7), 0.06, "Steel")
    # The frame, leaning in, with two rows of three lamps.
    with m.at(0, y - 1.9, 12.1, 0.0):
        m.box(-1.25, 1.25, -0.08, 0.08, -0.62, -0.54, "Steel")
        m.box(-1.25, 1.25, -0.08, 0.08, 0.54, 0.62, "Steel")
        for x in (-1.25, 1.25):
            m.box(x - 0.04, x + 0.04, -0.08, 0.08, -0.62, 0.62, "Steel")
        for i in range(3):
            for j in range(2):
                x, z = -0.8 + i * 0.8, -0.27 + j * 0.54
                m.box(x - 0.34, x + 0.34, -0.42, -0.08, z - 0.24, z + 0.24, "Slate")
                m.box(x - 0.28, x + 0.28, -0.44, -0.42, z - 0.19, z + 0.19, "Flood")
    m.done("LightMast")


def outrun_z(x: float) -> float:
    """The outrun's ice past the line: level at first, rising more and more to brake the sled."""
    if x <= 0:
        return -x * FINISH_GRADE
    t = min(1.0, x / OUTRUN)
    return OUTRUN_RISE * t * t


def finish_house(m: Mesh) -> None:
    """The finish house on the left: two storeys, framed glass facing the line, officials on a balcony, a stair up the end."""
    hx0, hx1, hy0, hy1 = 4.0, 22.0, 13.0, 22.0
    gz = BANK_END + outrun_z(hx0)
    m.box(hx0, hx1, hy0, hy1, gz - 2, gz + 7.0, "Timber")
    for z0, z1 in ((gz + 1.0, gz + 3.0), (gz + 4.2, gz + 6.2)):
        m.box(hx0 + 0.9, hx1 - 0.9, hy0 - 0.06, hy0 + 0.1, z0 - 0.1, z1 + 0.1, "White")
        m.box(hx0 + 1.0, hx1 - 1.0, hy0 - 0.08, hy0 + 0.1, z0, z1, "Glass")
        for k in range(1, 6):
            x = hx0 + 1.0 + k * (hx1 - hx0 - 2.0) / 6
            m.box(x - 0.06, x + 0.06, hy0 - 0.1, hy0 + 0.1, z0, z1, "White")
    m.roof(hx0 - 0.6, hx1 + 0.6, hy0 - 1.2, hy1 + 0.6, gz + 7.0, 1.4, "Roof")
    m.box(hx0, hx1, hy0 - 0.12, hy0, gz + 3.3, gz + 3.7, "Teal")
    # The balcony along the upper floor, with officials at its rail.
    m.box(hx0 + 0.5, hx1 - 0.5, hy0 - 1.8, hy0, gz + 3.7, gz + 3.95, "Slate")
    rail(m, hx0 + 0.5, hx1 - 0.5, hy0 - 1.75, gz + 3.95, 2.1)
    for k, x in enumerate((7.5, 11.0, 14.5, 18.0)):
        with m.at(x, hy0 - 1.0, gz + 3.95):
            person(m, 0, 0, ("White", "Coat2", "White", "Coat5")[k], coat=True, hat=None if k % 2 else "Coat1")
    # A door under the balcony and a stair up the downhill end to it.
    m.box(hx1 - 3.0, hx1 - 1.6, hy0 - 0.05, hy0, gz, gz + 2.3, "Slate")
    for k in range(9):
        m.box(hx1 + 0.1, hx1 + 1.2, hy0 + 0.2 + k * 0.45, hy0 + 0.65 + k * 0.45, gz + k * 0.43, gz + k * 0.43 + 0.1, "Steel")
    m.rod((hx1 + 1.2, hy0 + 0.2, gz + 1.0), (hx1 + 1.2, hy0 + 4.25, gz + 4.9), 0.03, "Steel")


def scoreboard(m: Mesh) -> None:
    """The scoreboard on two braced legs, facing the sleds coming down."""
    sx, sy = -6.0, 12.0
    sz = BANK_END + outrun_z(sx)
    for dx in (-2.6, 2.6):
        m.cone(sx + dx, sy, sz - 1.5, sz + 5.0, 0.18, 0.13, 8, "Steel")
    m.rod((sx - 2.6, sy, sz + 0.3), (sx + 2.6, sy, sz + 4.6), 0.05, "Steel")
    m.rod((sx + 2.6, sy, sz + 0.3), (sx - 2.6, sy, sz + 4.6), 0.05, "Steel")
    m.box(sx - 3.3, sx + 3.3, sy - 0.25, sy + 0.25, sz + 4.9, sz + 8.3, "Board")
    m.box(sx - 3.3, sx + 3.3, sy - 0.27, sy + 0.25, sz + 8.3, sz + 8.55, "Teal")
    for r in range(3):
        z = sz + 5.4 + r * 0.9
        m.box(sx - 2.9, sx - 2.4, sy - 0.3, sy - 0.25, z, z + 0.45, "Coral" if r == 2 else "White")
        m.box(sx - 2.2, sx + 0.6, sy - 0.3, sy - 0.25, z + 0.05, z + 0.4, "White")
        m.box(sx + 1.0, sx + 2.9, sy - 0.3, sy - 0.25, z + 0.05, z + 0.4, "Lamp")


def finish_stand(m: Mesh) -> None:
    """A small stand on the right, facing the line: four steps, a rail along the front, a crowd and a roof on posts."""
    tx0, tx1 = -4.0, 14.0
    front = -10.0
    floor = BANK_END + 0.1
    m.box(tx0, tx1, front - 8, front, floor - 2, floor, "Snow")
    for r in range(4):
        y = front - 0.8 - r * 1.6
        m.box(tx0, tx1, front - 8, y, floor + r * 0.5, floor + (r + 1) * 0.5, "Timber" if r % 2 == 0 else "Slate")
    m.rod((tx0, front - 0.25, floor + 1.1), (tx1, front - 0.25, floor + 1.1), 0.04, "Coral", 6)
    for k in range(10):
        x = tx0 + k * (tx1 - tx0) / 9
        m.rod((x, front - 0.25, floor), (x, front - 0.25, floor + 1.1), 0.025, "Steel")
    k = 200
    for r in range(4):
        z = floor + (r * 0.5 + 0.5 if r else 0.0)
        # Each row back stands well onto its step, clear of the riser in front.
        y = front - 0.5 - r * 1.6 - (0.7 if r else 0)
        for j in range(12):
            k += 1
            if spread(k, 1) < 0.6:
                stander(m, tx0 + 0.8 + j * 1.45 + (spread(k, 2) - 0.5) * 0.6, y, z, k, math.pi)
    # A roof over the back rows on four posts.
    top = floor + 6.0
    for x in (tx0 + 0.3, tx1 - 0.3):
        # The back posts stand on the top step, the front ones on the second.
        for y, z0 in ((front - 7.7, floor + 2.0), (front - 3.5, floor + 1.0)):
            m.cone(x, y, z0, top, 0.1, 0.08, 6, "Steel")
    m.box(tx0 - 0.3, tx1 + 0.3, front - 8.2, front - 1.8, top, top + 0.2, "Roof")
    m.box(tx0 - 0.3, tx1 + 0.3, front - 1.85, front - 1.8, top - 0.5, top, "Teal")


def finish_area() -> None:
    """Past the line: the outrun channel, snow either side reaching back up the finish straight, the finish house, the scoreboard, the stand, a podium, boards along the bank and pines."""
    m = Mesh()
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
    grid(m, ice, "Ice")
    grid(m, lip_l, "Lip")
    grid(m, lip_r, "Lip")
    grid(m, bank_l, "Snow")
    grid(m, bank_r, "Snow")
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
        grid(m, rows, "Snow")
    finish_house(m)
    scoreboard(m)
    finish_stand(m)
    # The podium beside the finish house, its back board in teal.
    px, py = 26.0, 15.0
    pz = BANK_END + outrun_z(px)
    for dx, h, colour in ((-1.3, 0.5, "Silver"), (0.0, 0.8, "Gold"), (1.3, 0.35, "Bronze")):
        m.box(px + dx - 0.6, px + dx + 0.6, py - 0.6, py + 0.6, pz - 0.5, pz + h, colour)
    m.box(px - 2.2, px + 2.2, py + 1.0, py + 1.1, pz - 0.5, pz + 2.6, "Teal")
    # Advertising boards along the foot of the left bank, back up the finish straight, stepping with the slope.
    for k in range(8):
        bx = -34.0 + k * 4.0
        bz = BANK_END + outrun_z(bx + 2.0)
        m.box(bx + 0.05, bx + 3.95, BANK_OUT + 0.4, BANK_OUT + 0.5, bz - 0.2, bz + 0.9, ("Teal", "White", "Coral")[k % 3])
    # Pines on the snow either side.
    for k in range(12):
        tx = -55.0 + k * 11.0 + spread(k, 8) * 5.0
        side = 1 if k % 2 else -1
        ty = side * (28.0 + spread(k, 9) * 12.0)
        with m.at(tx, ty, BANK_END + outrun_z(min(max(tx, -60.0), OUTRUN))):
            tree(m, 0, 0, 7.0 + spread(k, 10) * 5.0, "pine")
    m.done("FinishArea")


def preview_scene(path: Path) -> None:
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
    grid(m, ice, "Ice")
    grid(m, bank_l, "Snow")
    grid(m, bank_r, "Snow")
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
    o["StartHouse"].location = (-150, 0, 150 * FINISH_GRADE)
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


def build() -> None:
    start_house()
    arch("TimingArch", chequer=False)
    arch("FinishArch", chequer=True)
    shade()
    terrace()
    light_mast()
    finish_area()


def preview(path: Path) -> None:
    preview_scene(path)


run(OUT, PREVIEW, build, preview)
