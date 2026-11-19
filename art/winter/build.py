"""
The winter kit (PR 13ao), built headless in Blender from numbers. Nobody
opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/winter/build.py -- [--preview]

Writes public/models/winter.glb and public/models/models.json (the hash of
every art script), and with --preview also art/winter/preview.jpg.

The parts of the winter sports that no slider reshapes, which
src/render/riderFigure.ts lays where the pose says (each gets its colour
there):

- ClapBlade, ClapFrame: a long-track clap skate under each boot, from the
  ice (y 0) up to the boot's sole, centred under the ankle. The blade is
  SKATER_SKELETON.blade.length long (in `length`).
- JumpSki, JumpSkiStripe, JumpBinding: a jumping ski from its tail (the
  origin) along +x, JUMP_SKIS.length long (in `length`), with the shovel
  turned up past the tip, the stripe down its top, and the binding where
  the boot sits (JUMP_SKIS.tipAhead back from the tip).
- RunnerBlade, RunnerCarrier: a bobsled runner from the ice (y 0), centred
  on its middle, 0.62 m long, and the carrier block and upright that hold
  it under the hull.
- Axle: the beam across each pair of runners, centred.
- PushHandle: a fold-out push handle on the hull's right side, from where it
  meets the hull out along +z (the code mirrors it for the left).
- PushBar: the push bar across the open back of the cockpit, centred.
- SteerRing: the driver's steering ring, round the grip (the origin).

The numbers are those in src/data/pose.ts, src/data/jumper.ts and
src/data/bobsled.ts; tests/models.test.ts checks the ones the code scales by.
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
from kitlib import ROOT, B, Stage, bridge, box, disc, finish, run, sweep, tube, v  # noqa: E402

OUT = ROOT / "public" / "models" / "winter.glb"
PREVIEW = ROOT / "art" / "winter" / "preview.jpg"

# SKATER_SKELETON.blade (src/data/pose.ts), and where the boot's sole sits above the ice.
BLADE_LEN = 0.44
SOLE = 0.028
# JUMP_SKIS and JUMPER_SKELETON.skiThick.
SKI_LEN, SKI_WIDTH, SKI_THICK, TIP_AHEAD = 2.5, 0.115, 0.02, 1.45
# SLED (src/data/bobsled.ts): the hull's floor above the ice and its width; the runners as the code draws them.
FLOOR, SLED_WIDTH, RUNNER_LEN = 0.1, 0.67, 0.62
RUNNER_Z = SLED_WIDTH * 0.42


def loft_x(bm, stations: list[tuple[float, float, float, float]], sides: int = 12, squareness: float = 0.0) -> None:
    """A body along +x through stations (x, half-width z, middle y, half-height), each a rounded box, closed at both ends."""
    exp = 2 / (2 + 6 * squareness)
    loops = []
    for x, hw, cy, hh in stations:
        ring = []
        for k in range(sides):
            a = 2 * math.pi * k / sides
            c, s = math.cos(a), math.sin(a)
            ring.append(bm.verts.new(B(v(x, cy + hh * math.copysign(abs(s) ** exp, s), hw * math.copysign(abs(c) ** exp, c)))))
        loops.append(ring)
    bridge(bm, loops)


# --- The clap skate ----------------------------------------------------------------


def clap_skate() -> None:
    bm = bmesh.new()
    half = BLADE_LEN / 2
    # The blade: steel, 1.1 mm thin and 16 mm tall, its edge rockered a hair, the nose rounded up into the tube.
    stations = []
    for k in range(17):
        f = k / 16
        x = -half + BLADE_LEN * f
        rocker = 0.0012 * (2 * f - 1) ** 2
        nose = max(0.0, (f - 0.9) / 0.1)
        bottom = rocker + 0.012 * nose * nose
        stations.append((x, 0.00055, (bottom + 0.017) / 2, (0.017 - bottom) / 2))
    loft_x(bm, stations, 8, squareness=0.9)
    finish(bm, "ClapBlade", length=BLADE_LEN)

    bm = bmesh.new()
    # The tube along the blade's top, closed at both ends.
    tube(bm, v(-half + 0.004, 0.022), v(half - 0.01, 0.022), 0.0065, 0.0055, "round")
    # The rear cup up to the sole, the front cup with the clap hinge across it.
    tube(bm, v(-0.085, 0.022), v(-0.085, SOLE), 0.012, 0.016, "round")
    tube(bm, v(0.1, 0.022), v(0.1, SOLE - 0.004), 0.011, 0.012, "round")
    tube(bm, v(0.112, SOLE - 0.002, -0.022), v(0.112, SOLE - 0.002, 0.022), 0.0035, 0.0035, "round")
    # The plates under the boot: heel and toe.
    box(bm, v(-0.085, SOLE + 0.002), (0.07, 0.004, 0.06))
    box(bm, v(0.1, SOLE + 0.002), (0.09, 0.004, 0.07))
    # A spring between the heel plate and the tube, behind the front cup.
    tube(bm, v(0.07, 0.022), v(0.07, SOLE), 0.003, 0.003, "round")
    finish(bm, "ClapFrame")


# --- The jumping ski -------------------------------------------------------------


def jump_ski() -> None:
    bm = bmesh.new()
    t = SKI_THICK / 2
    w = SKI_WIDTH / 2
    stations = [(0.0, w * 0.8, 0.0, t * 0.5), (0.03, w * 0.97, 0.0, t * 0.85), (0.1, w, 0.0, t)]
    # Flat and a touch thicker under the boot, thinning to the tip.
    for f in (0.25, 0.42, 0.55, 0.7, 0.85, 0.95):
        x = SKI_LEN * f
        thick = t * (1.15 if 0.35 < f < 0.5 else 1.0 - 0.25 * max(0.0, f - 0.5))
        stations.append((x, w * (0.98 if f > 0.6 else 1.0), 0.0, thick))
    # The shovel: wider, turning up past the tip, rounded at its end.
    for k in range(1, 7):
        f = k / 6
        a = f * math.radians(55)
        r = 0.075
        x = SKI_LEN + r * math.sin(a)
        y = r * (1 - math.cos(a))
        stations.append((x, w * (1.04 - 0.35 * f * f), y, t * (0.7 - 0.35 * f)))
    loft_x(bm, stations, 12, squareness=0.85)
    finish(bm, "JumpSki", length=SKI_LEN, width=SKI_WIDTH, thick=SKI_THICK)

    bm = bmesh.new()
    # The stripe: a thin raised band down the middle of the top, a third as wide.
    top = t * 1.0 + 0.0008
    box(bm, v(SKI_LEN * 0.5 - 0.03, top), (SKI_LEN * 0.9, 0.0016, SKI_WIDTH * 0.3))
    finish(bm, "JumpSkiStripe", smooth=False)

    bm = bmesh.new()
    boot = SKI_LEN - TIP_AHEAD
    top = t * 1.15
    # The binding: a toe piece, the heel cable's anchor further back, and the wedge plate between.
    box(bm, v(boot + 0.15, top + 0.012), (0.06, 0.024, 0.085))
    box(bm, v(boot - 0.14, top + 0.008), (0.05, 0.016, 0.07))
    box(bm, v(boot, top + 0.003), (0.32, 0.006, 0.08))
    for side in (-1, 1):
        tube(bm, v(boot + 0.13, top + 0.012, side * 0.045), v(boot - 0.12, top + 0.03, side * 0.045), 0.003, 0.003, "round")
    finish(bm, "JumpBinding")


# --- The bobsled's running gear --------------------------------------------------


def runner() -> None:
    bm = bmesh.new()
    half = RUNNER_LEN / 2
    # The steel blade: round-bottomed, rockered, its front curling up and its back lifted a little.
    stations = []
    for k in range(21):
        f = k / 20
        x = -half + RUNNER_LEN * f
        lift = 0.0015 * (2 * f - 1) ** 2 + 0.03 * max(0.0, (f - 0.85) / 0.15) ** 2 + 0.006 * max(0.0, (0.06 - f) / 0.06) ** 2
        stations.append((x, 0.007, lift + 0.016, 0.016))
    loft_x(bm, stations, 10, squareness=0.5)
    finish(bm, "RunnerBlade", length=RUNNER_LEN)

    bm = bmesh.new()
    # The carrier along the blade's top, and the upright into the hull's floor.
    loft_x(bm, [(-half + 0.06, 0.012, 0.042, 0.01), (-half + 0.1, 0.014, 0.046, 0.014), (half - 0.12, 0.014, 0.046, 0.014), (half - 0.06, 0.012, 0.042, 0.01)], 10, squareness=0.7)
    box(bm, v(0.0, (0.058 + FLOOR) / 2), (0.08, FLOOR - 0.05, 0.03))
    # Two bolts through the carrier.
    for x in (-0.12, 0.12):
        tube(bm, v(x, 0.046, -0.018), v(x, 0.046, 0.018), 0.004, 0.004, "round")
    finish(bm, "RunnerCarrier")


def axle() -> None:
    bm = bmesh.new()
    y = FLOOR - 0.012
    tube(bm, v(0, y, -RUNNER_Z - 0.01), v(0, y, RUNNER_Z + 0.01), 0.016, 0.016, "round", 3)
    # The spring blocks at each end, over the uprights.
    for side in (-1, 1):
        box(bm, v(0.0, y, side * RUNNER_Z), (0.07, 0.03, 0.04))
    finish(bm, "Axle")


def push_handle() -> None:
    """A folding handle out of the hull's side: a bar out along +z, then along the hull, back in."""
    bm = bmesh.new()
    path = [v(0.07, 0, 0), v(0.07, 0, 0.045), v(0.055, 0, 0.06), v(-0.055, 0, 0.06), v(-0.07, 0, 0.045), v(-0.07, 0, 0)]
    sweep(bm, path, 0.009, 10)
    for x in (0.07, -0.07):
        disc(bm, v(x, 0), 0.016, -0.004, 0.003, 16)
    finish(bm, "PushHandle")


def push_bar() -> None:
    """The back push bar: an arch across the cockpit's open end."""
    bm = bmesh.new()
    span = 0.24
    path = [v(0, 0, -span), v(0, 0.045, -span), v(0, 0.06, -span + 0.03), v(0, 0.06, span - 0.03), v(0, 0.045, span), v(0, 0, span)]
    sweep(bm, path, 0.011, 10)
    finish(bm, "PushBar")


def steer_ring() -> None:
    """A steering ring, round the grip, in the side view's plane; a short cable runs forward from it."""
    bm = bmesh.new()
    r = 0.032
    pts = [v(r * math.sin(2 * math.pi * k / 16), -r + r * math.cos(2 * math.pi * k / 16)) for k in range(17)]
    sweep(bm, pts, 0.0055, 8, cap=False)
    tube(bm, v(0.0, -2 * r), v(0.16, -2 * r - 0.03), 0.003, 0.003, "round")
    finish(bm, "SteerRing")


def build() -> None:
    clap_skate()
    jump_ski()
    runner()
    axle()
    push_handle()
    push_bar()
    steer_ring()


def preview(path: Path) -> None:
    stage = Stage()
    place = stage.place
    # Two skates side by side, scaled up so they read.
    for z in (-0.06, 0.06):
        place("ClapBlade", "steel", (0, 0, z), 0.0, scale=(2.5, 2.5, 2.5))
        place("ClapFrame", "black", (0, 0, z), 0.0, scale=(2.5, 2.5, 2.5))
    # A ski, lifted, its tail at the left.
    for name, colour in (("JumpSki", "white"), ("JumpSkiStripe", "teal"), ("JumpBinding", "black")):
        place(name, colour, (0, 0.06, 0), 0.9, scale=(0.5, 0.5, 0.5))
    # The bobsled's gear: two runner pairs with their axles, the push handles and bar, the steering rings.
    x0 = 2.9
    for x in (0.47, -0.47):
        for side in (-1, 1):
            place("RunnerBlade", "steel", (x, 0, side * RUNNER_Z), x0)
            place("RunnerCarrier", "metal", (x, 0, side * RUNNER_Z), x0)
        place("Axle", "metal", (x, 0, 0), x0)
    for side in (-1, 1):
        o = place("PushHandle", "metal", (0.6, 0.3, side * 0.3), x0)
        if side < 0:
            o.scale = (1, -1, 1)
        place("SteerRing", "metal", (0.3, 0.33, side * 0.15), x0)
    place("PushBar", "metal", (-0.75, 0.42, 0), x0)
    stage.render(path, (2.0, 0.0, 0.25), 4.4, (1600, 520), tilt=74, turn=18)


run(OUT, PREVIEW, build, preview)
