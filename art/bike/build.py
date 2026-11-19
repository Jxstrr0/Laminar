"""
The bike (PR 13an), built headless in Blender from numbers. Nobody opens the
Blender UI.

    ~/blender/blender --background --factory-startup --python art/bike/build.py -- [--preview]

Writes public/models/bike.glb and public/models/models.json (the hash of
every art script), and with --preview also art/bike/preview.jpg.

The bike's own parts, which no slider reshapes: the two frames (round tubes
and Kamm-tail tubes), the wheels (tyre, shallow and deep rims, the disc, the
hub and the spokes), the saddle, the drivetrain (chainring, crank arm, pedal,
bottom-bracket axle, cassette, chain, both derailleurs), the stem, the
headset, the aero base bar with its arm pads, and drop bars with their
hoods. src/render/riderFigure.ts gives each its colour (no materials here,
the same as the body parts) and still draws in code what follows the rider:
the aero extensions run to the hands, the stem reaches the drop bars, the
crank arms turn to the feet.

Where the frame's joints and wheels sit are the numbers in src/data/pose.ts
(FRAME and SKELETON); they go into the file as extras on Frame, and
tests/models.test.ts checks they still match.

The game's axes (three.js): +x forward, y up (ground at 0), z to the right
(the chain side). Blender is z-up, so every point here is written in
three.js terms and turned by `B()`; the glTF exporter turns it back. The
building blocks are shared with the other kits in art/kitlib.py (PR 13ao).
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bmesh
from mathutils import Vector

# Import the shared blocks without leaving a __pycache__ folder for the art workflow to commit.
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from kitlib import ROOT, B, Stage, bridge, box, circle, disc, finish, revolve, ring_verts, run, side_frame, sweep, tube, v  # noqa: E402

OUT = ROOT / "public" / "models" / "bike.glb"
PREVIEW = ROOT / "art" / "bike" / "preview.jpg"

# FRAME and SKELETON in src/data/pose.ts (tests/models.test.ts checks these against it).
BB = (0.0, 0.27)
SEAT_TOP = (-0.13, 0.83)
HEAD_TOP = (0.5, 0.82)
HEAD_BOTTOM = (0.54, 0.66)
REAR_AXLE_X, FRONT_AXLE_X, WHEEL_R = -0.41, 0.59, 0.335
TUBE_R = 0.018
SADDLE = (BB[0] - 0.17, BB[1] + 0.72)
CRANK = 0.17
# Deep rims: BIKE.wheelDiameter × BIKE.deepChord × 0.5 in src/data/cyclist.ts. Spokes: BIKE.wheels.
DEEP = 0.67 * 0.18 * 0.5
SPOKES_FRONT, SPOKES_REAR = 20, 24
# The stem the aero bars hang off: the code's headTop + (0.08, 0.02).
STEM = (HEAD_TOP[0] + 0.08, HEAD_TOP[1] + 0.02)


# --- The frames --------------------------------------------------------------


def frame(name: str, shape: str) -> None:
    """The whole frame, fork and seat post where they sit on the bike: tubes round or Kamm-tailed (`shape`)."""
    bm = bmesh.new()
    bb, st, ht, hb = v(*BB), v(*SEAT_TOP), v(*HEAD_TOP), v(*HEAD_BOTTOM)
    rear, front = v(REAR_AXLE_X, WHEEL_R), v(FRONT_AXLE_X, WHEEL_R)
    head = (ht - hb).normalized()
    # The main triangle. The down tube is the fattest; the top tube slopes a little.
    tube(bm, bb, hb - head * 0.01, TUBE_R * 1.15, TUBE_R * 1.05, shape)
    tube(bm, st + v(0, -0.02), ht - head * 0.025, TUBE_R * 0.9, TUBE_R * 0.85, shape)
    tube(bm, bb, st, TUBE_R * 0.95, TUBE_R * 0.9, shape)
    # The head tube, a little proud of both joints, wider at the bottom.
    tube(bm, hb - head * 0.035, ht + head * 0.012, 0.025, 0.021, "round", 4)
    # The seat post up to the saddle and its clamp.
    sad = v(*SADDLE)
    tube(bm, st - (sad - st).normalized() * 0.02, sad + v(0, -0.012), TUBE_R * 0.75, TUBE_R * 0.75, shape)
    tube(bm, st - (sad - st).normalized() * 0.012, st + (sad - st).normalized() * 0.012, TUBE_R * 1.15, TUBE_R * 1.15, "round")
    # Stays: chain stays from the bottom bracket, seat stays from the seat cluster, out to the dropouts.
    for side in (-1, 1):
        tube(bm, bb + v(-0.01, 0, side * 0.035), rear + v(0.01, 0, side * 0.064), TUBE_R * 0.62, TUBE_R * 0.42)
        tube(bm, st + v(0.005, -0.03, side * 0.018), rear + v(0.012, 0.012, side * 0.064), TUBE_R * 0.5, TUBE_R * 0.38)
        # The rear dropouts: small plates round the axle.
        disc(bm, rear, 0.014, side * 0.066 - 0.003, side * 0.066 + 0.003, 16)
    # The fork: a crown under the head tube, then two legs down to the front axle.
    crown = hb - head * 0.045
    tube(bm, crown + v(0, 0, -0.055), crown + v(0, 0, 0.055), 0.018, 0.018, "round")
    for side in (-1, 1):
        tube(bm, crown + v(0.004, -0.004, side * 0.045), front + v(0, 0.012, side * 0.052), TUBE_R * 0.85, TUBE_R * 0.5, shape)
        disc(bm, front, 0.012, side * 0.054 - 0.003, side * 0.054 + 0.003, 16)
    # The bottom-bracket shell across the frame.
    tube(bm, bb + v(0, 0, -0.035), bb + v(0, 0, 0.035), 0.022, 0.022, "round")
    # Two bottle bosses on the down tube, and a little brake bridge between the seat stays.
    down = (hb - bb).normalized()
    up = side_frame(down)[0]
    for f in (0.42, 0.55):
        p = bb.lerp(hb, f) + up * TUBE_R * 1.1
        tube(bm, p - up * 0.004, p + up * 0.006, 0.004, 0.004, "round")
    bridge_at = st.lerp(rear, 0.28)
    tube(bm, bridge_at + v(0.005, 0, -0.03), bridge_at + v(0.005, 0, 0.03), 0.006, 0.006, "round")
    finish(
        bm,
        name,
        bottomBracket=list(BB),
        seatTop=list(SEAT_TOP),
        headTop=list(HEAD_TOP),
        headBottom=list(HEAD_BOTTOM),
        axles=[REAR_AXLE_X, FRONT_AXLE_X, WHEEL_R],
        saddle=list(SADDLE),
    )


# --- The wheels: each centred on its axle, in the side view ----------------


def tyre() -> None:
    bm = bmesh.new()
    rc, rt = WHEEL_R - 0.012, 0.0128
    # A round tyre, a touch flatter where it meets the rim, with a faint tread ridge.
    prof = []
    for k in range(14):
        t = 2 * math.pi * k / 14
        rr = rt * (1.0 if math.cos(t) > -0.3 else 0.9)
        prof.append((rc + rr * math.cos(t), rt * 0.95 * math.sin(t)))
    revolve(bm, prof, 56)
    finish(bm, "Tyre")


def rim(name: str, depth: float, width: float) -> None:
    """A rim from the tyre bed in to `depth`: a box section for shallow rims, a blunt U for deep ones."""
    bm = bmesh.new()
    outer = WHEEL_R - 0.02
    inner = outer - depth
    if depth < 0.03:
        prof = [(outer + 0.002, -width * 0.5), (outer + 0.002, width * 0.5), (outer - depth * 0.4, width * 0.52), (inner + 0.003, width * 0.4), (inner, width * 0.25), (inner, -width * 0.25), (inner + 0.003, -width * 0.4), (outer - depth * 0.4, -width * 0.52)]
    else:
        # Wide at the brake track, bulging a little below it, then a rounded inner edge.
        prof = [(outer + 0.002, -width * 0.48), (outer + 0.002, width * 0.48), (outer - depth * 0.15, width * 0.52), (outer - depth * 0.45, width * 0.54), (outer - depth * 0.75, width * 0.46), (inner + depth * 0.08, width * 0.28), (inner, width * 0.1), (inner, -width * 0.1), (inner + depth * 0.08, -width * 0.28), (outer - depth * 0.75, -width * 0.46), (outer - depth * 0.45, -width * 0.54), (outer - depth * 0.15, -width * 0.52)]
    revolve(bm, prof, 64)
    # The valve, just inside the rim at the top.
    tube(bm, v(0, inner + 0.002), v(0, inner - 0.022), 0.0025, 0.002, "round")
    finish(bm, name)


def disc_wheel() -> None:
    """A lenticular disc: fattest at the hub (BIKE.discThickness), thinning to the rim, with the hub's caps."""
    bm = bmesh.new()
    outer = WHEEL_R - 0.018
    half = 0.02
    prof = [(0.02, -half * 0.9), (0.02, half * 0.9)]
    for k in range(1, 9):
        f = k / 8
        prof.append((0.02 + (outer - 0.02) * f, half * (1 - 0.62 * f * f)))
    prof += [(outer + 0.002, half * 0.36), (outer + 0.002, -half * 0.36)]
    for k in range(8, 0, -1):
        f = k / 8
        prof.append((0.02 + (outer - 0.02) * f, -half * (1 - 0.62 * f * f)))
    revolve(bm, prof, 48)
    # A valve hatch: a small disc on the drive side, two-thirds out.
    disc(bm, v(0, outer * 0.62), 0.012, half * 0.6, half * 0.62, 16)
    finish(bm, "Disc")


def hub() -> None:
    bm = bmesh.new()
    prof = [(0.006, -0.052), (0.009, -0.052), (0.009, -0.034), (0.027, -0.033), (0.027, -0.028), (0.015, -0.025), (0.014, 0.0), (0.015, 0.025), (0.027, 0.028), (0.027, 0.033), (0.009, 0.034), (0.009, 0.052), (0.006, 0.052)]
    revolve(bm, prof, 20)
    finish(bm, "Hub")


def spokes(name: str, count: int, depth: float, crossed: bool) -> None:
    """Thin bladed spokes from the hub's flanges (alternate sides) to the rim, radial or crossed twice."""
    bm = bmesh.new()
    rim_in = WHEEL_R - 0.02 - depth + 0.002
    step = 2 * math.pi / count
    for k in range(count):
        a = k * step
        side = 1 if k % 2 == 0 else -1
        lead = (1 if (k // 2) % 2 == 0 else -1) * (2 * step if crossed else 0)
        h = v(0.024 * math.cos(a + lead), 0.024 * math.sin(a + lead), side * 0.03)
        r = v(rim_in * math.cos(a), rim_in * math.sin(a), 0)
        d = (r - h).normalized()
        w = v(0, 0, 1).cross(d).normalized()
        n = d.cross(w)
        # A flat blade, 2.2 mm by 0.9 mm: four long faces, enough to catch the light.
        sec = [(0.0011, 0.00045), (-0.0011, 0.00045), (-0.0011, -0.00045), (0.0011, -0.00045)]
        loops = [[bm.verts.new(B(p + w * x + n * y)) for x, y in sec] for p in (h, r)]
        bridge(bm, loops, False, False)
    finish(bm, name, smooth=False)


# --- Saddle, drivetrain ------------------------------------------------------


def saddle() -> None:
    """A time-trial saddle with its nose cut short, from the saddle point (its underside), the nose forward."""
    bm = bmesh.new()
    # Stations along the saddle: x, half-width, top height. The top dips a little in the middle.
    stations = [(-0.11, 0.045, 0.028), (-0.095, 0.064, 0.036), (-0.06, 0.066, 0.034), (-0.02, 0.05, 0.031), (0.03, 0.03, 0.032), (0.08, 0.026, 0.034), (0.13, 0.022, 0.03), (0.145, 0.016, 0.022)]
    loops = []
    for x, hw, top in stations:
        sec = []
        for k in range(12):
            t = 2 * math.pi * k / 12
            c, s = math.cos(t), math.sin(t)
            y = 0.012 + (top - 0.012) * max(0.0, s) ** 0.6 if s >= 0 else 0.012 + 0.008 * s
            sec.append((x, y, hw * (abs(c) ** 0.7) * (1 if c >= 0 else -1)))
        loops.append([bm.verts.new(B(v(*p))) for p in sec])
    bridge(bm, loops)
    # The rails down to the post's clamp.
    for side in (-1, 1):
        sweep(bm, [v(-0.085, 0.012, side * 0.035), v(-0.05, -0.006, side * 0.022), v(0.04, -0.006, side * 0.02), v(0.1, 0.012, side * 0.012)], 0.0035, 8)
    box(bm, v(0.0, -0.012), (0.05, 0.016, 0.05))
    finish(bm, "Saddle")


def chainring() -> None:
    """A 54-tooth ring and its four-arm spider on the chain side (+z) of the bottom bracket, and the axle through it."""
    bm = bmesh.new()
    teeth = 54
    r = teeth * 0.0127 / (2 * math.pi)
    z0, z1 = 0.058, 0.062
    centre = v(*BB)
    outer = []
    for k in range(teeth * 2):
        a = math.pi * k / teeth
        rr = r + (0.004 if k % 2 == 0 else -0.002)
        outer.append((rr * math.cos(a), rr * math.sin(a)))
    inner = [(r * 0.86 * math.cos(math.pi * k / teeth), r * 0.86 * math.sin(math.pi * k / teeth)) for k in range(teeth * 2)]
    loops = []
    for z in (z0, z1):
        loops.append([bm.verts.new(B(centre + v(x, y, z))) for x, y in outer])
        loops.append([bm.verts.new(B(centre + v(x, y, z))) for x, y in inner])
    o0, i0, o1, i1 = loops
    n = len(outer)
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((o0[k], o0[j], i0[j], i0[k]))
        bm.faces.new((o1[k], i1[k], i1[j], o1[j]))
        bm.faces.new((o0[k], o1[k], o1[j], o0[j]))
        bm.faces.new((i0[k], i0[j], i1[j], i1[k]))
    # The spider: four arms from the axle out to the ring.
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        d = v(math.cos(a), math.sin(a))
        tube(bm, centre + d * 0.01 + v(0, 0, 0.061), centre + d * (r * 0.9) + v(0, 0, 0.06), 0.008, 0.005)
    disc(bm, centre, 0.022, 0.056, 0.066, 20)
    # The axle through the bottom bracket, out to both crank arms.
    tube(bm, centre + v(0, 0, -0.09), centre + v(0, 0, 0.09), 0.009, 0.009, "round")
    finish(bm, "Chainring")


def crank_arm() -> None:
    """A crank arm from the axle (the origin) out along +y to the pedal, CRANK long; the code turns it to each foot."""
    bm = bmesh.new()
    stations = [(0.0, 0.017, 0.011), (0.03, 0.013, 0.01), (0.1, 0.011, 0.009), (0.155, 0.011, 0.009), (0.17, 0.012, 0.009)]
    loops = []
    for y, hw, hd in stations:
        sec = [(hw * math.cos(2 * math.pi * k / 12), hd * math.sin(2 * math.pi * k / 12)) for k in range(12)]
        loops.append([bm.verts.new(B(v(a, y, b))) for a, b in sec])
    bridge(bm, loops)
    finish(bm, "CrankArm", length=CRANK)


def pedal() -> None:
    """A clipless pedal round its spindle (the origin), the cleat face up."""
    bm = bmesh.new()
    box(bm, v(0.006, 0.0), (0.075, 0.016, 0.06))
    tube(bm, v(0, 0, -0.03), v(0, 0, 0.0), 0.006, 0.006, "round")
    finish(bm, "Pedal")


def cassette() -> None:
    """Eleven cogs on the rear hub's chain side, 11 to 28 teeth."""
    bm = bmesh.new()
    centre = v(REAR_AXLE_X, WHEEL_R)
    sizes = [28, 25, 23, 21, 19, 17, 16, 15, 14, 13, 11]
    for k, t in enumerate(sizes):
        r = t * 0.0127 / (2 * math.pi) + 0.002
        z = 0.032 + k * 0.0037
        disc(bm, centre, r, z, z + 0.0018, 20, inner=0.012)
    disc(bm, centre, 0.014, 0.03, 0.074, 16)
    finish(bm, "Cassette")


def chain_path() -> list[Vector]:
    """The chain's loop, at the chain line: over the ring, back along the top to a middle cog, round it, down through the rear mech and forward."""
    ring_r = 54 * 0.0127 / (2 * math.pi)
    cog_r = 15 * 0.0127 / (2 * math.pi)
    bb, rear = v(*BB), v(REAR_AXLE_X, WHEEL_R)
    pts: list[Vector] = []
    # Round the front of the ring, from the top (90°) forward to the bottom (−90°).
    for k in range(13):
        a = math.pi / 2 - math.pi * k / 12
        pts.append(bb + v(ring_r * math.cos(a), ring_r * math.sin(a)))
    # Back along the bottom run to the lower jockey wheel, up to the upper one, then onto the cog's underside.
    low = rear + v(0.005, -0.075)
    up = rear + v(0.025, -0.035)
    pts += [bb.lerp(low, f) for f in (0.33, 0.66)] + [low, up]
    # Round the back of the cog, bottom (−90°) through the rear (180°) to the top (90°).
    for k in range(10):
        a = -math.pi / 2 - math.pi * k / 9
        pts.append(rear + v(cog_r * math.cos(a), cog_r * math.sin(a)))
    top_start = pts[-1]
    pts += [top_start.lerp(pts[0], f) for f in (0.25, 0.5, 0.75)]
    return pts


def chain() -> None:
    bm = bmesh.new()
    z = 0.05
    pts = [p + v(0, 0, z) for p in chain_path()]
    loop = pts + [pts[0]]
    # A flat band, 7 mm tall and 5 mm across, round the loop.
    loops = []
    for k in range(len(loop) - 1):
        a, b = loop[k], loop[(k + 1) % (len(loop) - 1)]
        prev = loop[k - 1] if k > 0 else loop[-2]
        t = (b - prev).normalized()
        n = v(-t.y, t.x)
        sec = [(0.0035, 0.0025), (-0.0035, 0.0025), (-0.0035, -0.0025), (0.0035, -0.0025)]
        loops.append([bm.verts.new(B(a + n * x + v(0, 0, y))) for x, y in sec])
    m = len(loops)
    for k in range(m):
        la, lb = loops[k], loops[(k + 1) % m]
        for j in range(4):
            bm.faces.new((la[j], la[(j + 1) % 4], lb[(j + 1) % 4], lb[j]))
    finish(bm, "Chain", smooth=False)


def derailleurs() -> None:
    """The rear mech hanging under the cassette with its two jockey wheels, and the front mech's cage over the ring."""
    bm = bmesh.new()
    rear = v(REAR_AXLE_X, WHEEL_R)
    z = 0.05
    # The rear mech: knuckle at the dropout, a short parallelogram body, the cage with its jockey wheels.
    box(bm, rear + v(-0.012, -0.012, 0.072), (0.03, 0.02, 0.012))
    tube(bm, rear + v(-0.02, -0.02, 0.07), rear + v(0.01, -0.03, 0.066), 0.006, 0.005)
    for p in (rear + v(0.025, -0.035), rear + v(0.005, -0.075)):
        disc(bm, p, 0.0095, z - 0.003, z + 0.003, 16)
    tube(bm, rear + v(0.03, -0.03, z + 0.007), rear + v(0.0, -0.082, z + 0.007), 0.004, 0.004)
    # The front mech: a small cage on the seat tube, just above the ring's teeth.
    ring_r = 54 * 0.0127 / (2 * math.pi)
    st = v(*SEAT_TOP)
    bb = v(*BB)
    seat_dir = (st - bb).normalized()
    clamp = bb + seat_dir * (ring_r + 0.03)
    box(bm, clamp + v(0.0, 0.0, 0.03), (0.025, 0.02, 0.03))
    box(bm, clamp + v(0.035, -0.005, z), (0.05, 0.012, 0.012))
    finish(bm, "Derailleurs")


# --- Steering and bars -------------------------------------------------------


def headset() -> None:
    """Spacers and the top cap above the head tube, along the steerer."""
    bm = bmesh.new()
    ht, hb = v(*HEAD_TOP), v(*HEAD_BOTTOM)
    head = (ht - hb).normalized()
    tube(bm, ht + head * 0.008, ht + head * 0.03, 0.019, 0.018, "round")
    tube(bm, ht + head * 0.03, ht + head * 0.036, 0.016, 0.012, "round")
    finish(bm, "Headset")


def stem() -> None:
    """A stem from its steerer clamp (the origin) along +y to the bar clamp, 0.1 long: the code stretches it to wherever the bars are."""
    bm = bmesh.new()
    L = 0.1
    tube(bm, v(0, 0.0), v(0, L), 0.016, 0.014, "round", 4)
    # The clamps at each end, across the bike.
    tube(bm, v(0, 0.0, -0.022), v(0, 0.0, 0.022), 0.02, 0.02, "round")
    tube(bm, v(0, L, -0.025), v(0, L, 0.025), 0.019, 0.019, "round")
    finish(bm, "Stem", length=L, radius=0.016)


def base_bar() -> None:
    """The aero base bar at the stem: a flat wing across the bike, its ends curling forward into the brake levers."""
    bm = bmesh.new()
    s = v(*STEM)
    loops = []
    for k in range(11):
        z = -0.2 + 0.4 * k / 10
        # A wing section: 40 mm chord, 13 mm thick, the clamp area round.
        mid = abs(z) < 0.03
        chord, thick = (0.016, 0.016) if mid else (0.04, 0.013)
        sec = [(chord * 0.5 * math.cos(2 * math.pi * j / 12) + (0 if mid else 0.004), thick * 0.5 * math.sin(2 * math.pi * j / 12)) for j in range(12)]
        loops.append([bm.verts.new(B(s + v(x, y, z))) for x, y in sec])
    bridge(bm, loops)
    for side in (-1, 1):
        end = s + v(0.0, 0.0, side * 0.2)
        sweep(bm, [end, end + v(0.03, -0.004, side * 0.012), end + v(0.07, -0.012, side * 0.016), end + v(0.1, -0.02, side * 0.016)], lambda f: 0.0085 - 0.002 * f, 10)
    finish(bm, "BaseBar")


def arm_pad() -> None:
    """An arm cup with its pad, round its middle (the code's old pad box was 100 × 20 × 80 mm)."""
    bm = bmesh.new()
    loops = []
    for k in range(6):
        x = -0.05 + 0.1 * k / 5
        f = 1 - (2 * (k / 5) - 1) ** 4
        hw = 0.028 + 0.012 * f
        sec = []
        for j in range(14):
            t = 2 * math.pi * j / 14
            c, s = math.cos(t), math.sin(t)
            # A shallow cup: the middle of the top dips, the sides stand up.
            y = 0.004 + 0.006 * s - 0.004 * (1 - abs(c)) * max(0, s)
            sec.append((x, y, hw * c))
        loops.append([bm.verts.new(B(v(*p))) for p in sec])
    bridge(bm, loops)
    finish(bm, "ArmPad")


DROP_HALF = 0.21
# Where the hands rest on the hoods, from the bar clamp: the code puts the bars so the hands land here.
HOOD = (0.075, 0.03)


def drop_path(side: int) -> list[Vector]:
    """One half of a drop bar from the clamp out: the top, the forward bend, the drop and its end, through a smooth curve."""
    ctrl = [v(0, 0, 0), v(0, 0, side * 0.12), v(0.012, 0, side * 0.19), v(0.05, -0.004, side * DROP_HALF), v(0.085, -0.03, side * DROP_HALF), v(0.09, -0.07, side * DROP_HALF), v(0.06, -0.115, side * DROP_HALF), v(0.0, -0.128, side * DROP_HALF), v(-0.05, -0.122, side * DROP_HALF)]
    pts = []
    for i in range(len(ctrl) - 1):
        p0, p1, p2, p3 = ctrl[max(i - 1, 0)], ctrl[i], ctrl[i + 1], ctrl[min(i + 2, len(ctrl) - 1)]
        for k in range(4):
            t = k / 4
            t2, t3 = t * t, t * t * t
            pts.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    pts.append(ctrl[-1])
    return pts


def drop_bar() -> None:
    """Drop bars round their clamp (the origin), DROP_HALF to each side; fat at the clamp, the tops then slimmer."""
    bm = bmesh.new()
    for side in (-1, 1):
        sweep(bm, drop_path(side), lambda f: 0.0159 if f < 0.06 else 0.0125, 12)
    finish(bm, "DropBar", hood=list(HOOD), halfWidth=DROP_HALF)


def drop_hoods() -> None:
    """The brake hoods and levers on the drops' forward bend, round the same clamp."""
    bm = bmesh.new()
    for side in (-1, 1):
        z = side * DROP_HALF
        sweep(bm, [v(0.045, 0.004, z), v(0.07, 0.016, z), v(0.098, 0.022, z), v(0.11, 0.01, z)], lambda f: 0.016 - 0.006 * f * f, 10)
        sweep(bm, [v(0.108, 0.006, z), v(0.11, -0.03, z), v(0.098, -0.075, z), v(0.085, -0.095, z)], lambda f: 0.006 - 0.002 * f, 8)
    finish(bm, "DropHoods")


def build() -> None:
    frame("Frame", "round")
    frame("FrameKamm", "kamm")
    tyre()
    rim("RimShallow", 0.022, 0.021)
    rim("RimDeep", DEEP, 0.026)
    disc_wheel()
    hub()
    spokes("SpokesFront", SPOKES_FRONT, 0.022, False)
    spokes("SpokesFrontDeep", SPOKES_FRONT, DEEP, False)
    spokes("SpokesRear", SPOKES_REAR, 0.022, True)
    spokes("SpokesRearDeep", SPOKES_REAR, DEEP, True)
    saddle()
    chainring()
    crank_arm()
    pedal()
    cassette()
    chain()
    derailleurs()
    headset()
    stem()
    base_bar()
    arm_pad()
    drop_bar()
    drop_hoods()


# --- Preview: two bikes put together, as the code does ---------------------


def preview(path: Path) -> None:
    stage = Stage()
    place = stage.place
    for dx, frame_name, front_kind, rear_kind, bars in ((0.0, "Frame", "spoked", "spoked", "aero"), (1.7, "FrameKamm", "deep", "disc", "drops")):
        place(frame_name, "frame", dx=dx)
        for axle, kind, front in ((FRONT_AXLE_X, front_kind, True), (REAR_AXLE_X, rear_kind, False)):
            at = (axle, WHEEL_R, 0)
            place("Tyre", "black", at, dx)
            place("Hub", "metal", at, dx)
            if kind == "disc":
                place("Disc", "disc", at, dx)
            else:
                place("RimDeep" if kind == "deep" else "RimShallow", "disc" if kind == "deep" else "metal", at, dx)
                place(("SpokesFront" if front else "SpokesRear") + ("Deep" if kind == "deep" else ""), "metal", at, dx)
        place("Saddle", "black", (SADDLE[0], SADDLE[1], 0), dx)
        for name in ("Chainring", "Cassette", "Chain", "Derailleurs", "Headset"):
            place(name, "metal", dx=dx)
        for z, deg in ((-0.1, 15), (0.1, 195)):
            a = math.radians(-deg)
            foot = (BB[0] + CRANK * math.cos(a), BB[1] + CRANK * math.sin(a), z)
            # The crank arm runs up +y (Blender +z): turn it about the axle to point at the foot.
            place("CrankArm", "metal", (BB[0], BB[1], z * 0.85), dx, rot=(0, math.pi / 2 - a, 0))
            place("Pedal", "black", foot, dx)
        if bars == "aero":
            place("BaseBar", "metal", dx=dx)
            place("Stem", "metal", (HEAD_TOP[0], HEAD_TOP[1], 0), dx, rot=(0, math.atan2(0.08, 0.02), 0), scale=(1, 1, math.hypot(0.08, 0.02) / 0.1))
            for z in (-0.15, 0.15):
                place("ArmPad", "black", (STEM[0] - 0.26, STEM[1] + 0.06, z), dx)
        else:
            clamp = (0.6, 0.86, 0)
            place("DropBar", "metal", clamp, dx)
            place("DropHoods", "black", clamp, dx)
            d = (clamp[0] - HEAD_TOP[0], clamp[1] - HEAD_TOP[1])
            place("Stem", "metal", (HEAD_TOP[0], HEAD_TOP[1], 0), dx, rot=(0, math.atan2(d[0], d[1]), 0), scale=(1, 1, math.hypot(*d) / 0.1))
    stage.render(path, (1.0, 0.0, 0.6), 3.4, (1600, 600))


run(OUT, PREVIEW, build, preview)
