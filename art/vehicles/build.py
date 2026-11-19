"""
The vehicles' kit (PR 13ap), built headless in Blender from numbers. Nobody
opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/vehicles/build.py -- [--preview]

Writes public/models/vehicles.glb and public/models/models.json (the hash of
every art script), and with --preview also art/vehicles/preview.jpg.

The parts of the cars, the truck, the record cars and the sensor pod that no
slider reshapes. The shells stay lofted in code from the drag model's own
sections; these are what hang on them. Each part is built round its own
origin, axle along z, with the outside face towards +z (the code mirrors a
left-hand one with scale.z = -1):

- CarTyre, CarRim, CarBrake: a racing wheel, CAR_BODY.wheel in radius (in
  `radius`), built `width` wide for the code to stretch to each class's tyre:
  a low-profile tyre, a ten-spoke rim with its centre-lock nut, and the brake
  disc behind it.
- Helmet, Visor: the single-seater driver's helmet round its middle, nose to
  +x, and the dark visor band across its front.
- Halo: the hoop over the single-seater's cockpit, round the helmet's middle.
- CarMirror: a mirror on a stalk, from where it meets the body out along +z.
- Lamp: a lamp's lens, facing +x, 0.24 wide: headlights and tail lights for
  the touring car and the truck.
- TruckTyre, TruckRim: a truck wheel (0.5 m radius, 0.55 m wide, as the
  truck is drawn): the tyre, and a steel rim with ten wheel nuts and its cap.
- TruckGrille: the grille on the cab's face, its back on the face (x = 0).
- TruckBumper: the bumper across the cab's foot, centred.
- TruckMirror: a mirror on its arm, from the cab's side out along +z.
- FuelTank: a round tank along x with its straps and filler cap, centred.
- RecordWheel: a record car's solid aluminium wheel, radius 1 and width 1,
  for the code to size.
- ChuteCan: the parachute canister, radius 1 and length 1 along x, centred,
  its lid at the back (−x).
- JetNozzle: the jet engine's nozzle, radius 1 at its front (+x) and 0.9 at
  its back, length 1, centred, its petals round the outside.
- IntakeLip, IntakeFan: the lip round a jet intake's mouth (radius 0.24 m,
  the origin), and the dark lining back to the engine's face set inside it.
- SensorWindow: the pod's sensor window, a faceted pane in its frame,
  radius 1, facing down (−y).

The numbers are those in src/data/car.ts, src/data/record.ts and the
figures' DRAW tables; tests/models.test.ts checks the ones the code scales by.
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
from kitlib import ROOT, B, Stage, bridge, disc, finish, revolve, run, sweep, v  # noqa: E402

OUT = ROOT / "public" / "models" / "vehicles.glb"
PREVIEW = ROOT / "art" / "vehicles" / "preview.jpg"

# CAR_BODY.touring.wheel and .open.wheel (the same), and the width the car's wheel is built at.
CAR_R, CAR_W = 0.33, 0.3
CAR_RIM = 0.225
# truckFigure DRAW.wheelRadius and tyreWidth.
TRUCK_R, TRUCK_W = 0.5, 0.55
TRUCK_RIM = 0.29
# recordFigure DRAW.intake.
INTAKE_R = 0.24
# The single-seater's helmet as the code drew it.
HELMET_R = 0.15


def obox(bm, c: Vector, ex: Vector, ey: Vector, ez: Vector, hx: float, hy: float, hz: float) -> None:
    """A box at c along the three axes, with half sizes along each."""
    vs = {}
    for i in (-1, 1):
        for j in (-1, 1):
            for k in (-1, 1):
                vs[i, j, k] = bm.verts.new(B(c + ex * (i * hx) + ey * (j * hy) + ez * (k * hz)))
    for quad in (
        ((-1, -1, -1), (-1, 1, -1), (-1, 1, 1), (-1, -1, 1)),
        ((1, -1, -1), (1, -1, 1), (1, 1, 1), (1, 1, -1)),
        ((-1, -1, -1), (-1, -1, 1), (1, -1, 1), (1, -1, -1)),
        ((-1, 1, -1), (1, 1, -1), (1, 1, 1), (-1, 1, 1)),
        ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1)),
        ((-1, -1, 1), (-1, 1, 1), (1, 1, 1), (1, -1, 1)),
    ):
        bm.faces.new([vs[q] for q in quad])


def rounded_bar(bm, c: Vector, length: float, height: float, depth: float, n: int = 6) -> None:
    """A bar along z with rounded ends in the z–x plane (a bumper, a mirror head), `depth` along x, `height` along y."""
    r = depth / 2
    straight = max(0.0, length / 2 - r)
    outline = []
    for k in range(n + 1):
        t = -math.pi / 2 + math.pi * k / n
        outline.append((straight + r * math.cos(t), r * math.sin(t)))
    for k in range(n + 1):
        t = math.pi / 2 + math.pi * k / n
        outline.append((-straight + r * math.cos(t), r * math.sin(t)))
    loops = [[bm.verts.new(B(c + v(x, y, z))) for z, x in outline] for y in (-height / 2, height / 2)]
    bridge(bm, loops)


def tyre_profile(r: float, rim: float, width: float, bulge: float) -> list[tuple[float, float]]:
    """A tyre's cross-section as a closed loop of (radius, z): bead, bulging sidewall, rounded shoulder, flat tread."""
    hw = width / 2
    side: list[tuple[float, float]] = []
    shoulder = 0.18 * (r - rim)
    for k in range(7):  # the sidewall, bead to shoulder, bulging out past the tread's edge
        t = k / 6
        side.append((rim + (r - shoulder - rim) * t, -(hw * 0.9 + bulge * math.sin(math.pi * t))))
    for k in range(1, 5):  # the shoulder, a quarter round onto the tread
        a = math.pi / 2 * k / 4
        side.append((r - shoulder + shoulder * math.sin(a), -(hw - shoulder) - shoulder * math.cos(a) * 0.9))
    loop = side + [(rr, -z) for rr, z in reversed(side)]
    return loop


# --- The racing car ------------------------------------------------------------


def car_wheel() -> None:
    bm = bmesh.new()
    revolve(bm, tyre_profile(CAR_R, CAR_RIM - 0.005, CAR_W, 0.012), 48)
    finish(bm, "CarTyre", radius=CAR_R, width=CAR_W)

    bm = bmesh.new()
    hw = CAR_W / 2
    # The barrel, just inside the tyre's bead, and the lip on its outside edge.
    revolve(bm, [(CAR_RIM - 0.012, -hw * 0.85), (CAR_RIM, -hw * 0.85), (CAR_RIM, hw * 0.8), (CAR_RIM + 0.008, hw * 0.86), (CAR_RIM - 0.012, hw * 0.86)], 40)
    # The hub and its centre-lock nut.
    disc(bm, v(0, 0), 0.06, hw * 0.45, hw * 0.75, 20)
    revolve(bm, [(0.001, hw * 0.75), (0.042, hw * 0.75), (0.042, hw * 0.98), (0.026, hw * 1.06), (0.001, hw * 1.06)], 6)
    # Ten spokes, dished towards the outside face.
    for k in range(10):
        a = 2 * math.pi * k / 10
        d = v(math.cos(a), math.sin(a))
        ac = v(-math.sin(a), math.cos(a))
        r0, r1 = 0.055, CAR_RIM - 0.006
        z0, z1 = hw * 0.62, hw * 0.78
        mid = d * ((r0 + r1) / 2) + v(0, 0, (z0 + z1) / 2)
        along = (d * (r1 - r0) + v(0, 0, z1 - z0)).normalized()
        out = along.cross(ac).normalized()
        obox(bm, mid, along, ac, out, (r1 - r0) / 2 + 0.004, 0.011, 0.012)
    finish(bm, "CarRim", radius=CAR_RIM)

    bm = bmesh.new()
    disc(bm, v(0, 0), 0.165, -0.01, 0.012, 32, inner=0.08)
    # The calliper, a block over the disc's rim at the top-back.
    obox(bm, v(-0.08, 0.13, 0.0), v(1, 0), v(0, 1), v(0, 0, 1), 0.07, 0.035, 0.035)
    finish(bm, "CarBrake")


def helmet() -> None:
    r = HELMET_R
    bm = bmesh.new()
    rings, segs = 12, 20
    loops = []
    for i in range(1, rings):
        lat = -math.pi / 2 + math.pi * i / rings  # bottom to top
        ring = []
        for k in range(segs):
            lon = 2 * math.pi * k / segs
            x, y, z = math.cos(lat) * math.cos(lon), math.sin(lat), math.cos(lat) * math.sin(lon)
            # A longer shell at the back and a chin bar at the front, cut flat underneath.
            x *= 1.08 if x > 0 else 1.15
            y = max(y, -0.62)
            ring.append(bm.verts.new(B(v(x * r, y * r, z * r * 0.92))))
        loops.append(ring)
    bridge(bm, loops)
    finish(bm, "Helmet")

    bm = bmesh.new()
    grid = []
    for i in range(5):
        lat = math.radians(-8 + 26 * i / 4)
        row = []
        for k in range(9):
            lon = math.radians(-62 + 124 * k / 8)
            x, y, z = math.cos(lat) * math.cos(lon), math.sin(lat), math.cos(lat) * math.sin(lon)
            row.append(bm.verts.new(B(v(x * r * 1.1, y * r * 1.01, z * r * 0.94))))
        grid.append(row)
    for i in range(4):
        for k in range(8):
            bm.faces.new((grid[i][k], grid[i][k + 1], grid[i + 1][k + 1], grid[i + 1][k]))
    finish(bm, "Visor")


def halo() -> None:
    """The hoop: a front pillar ahead of the driver, a loop round the head and its two back legs."""
    bm = bmesh.new()
    # The loop, from the front pillar's top round the right, the back, the left and home.
    cx, ay, ax, az = 0.04, 0.09, 0.36, 0.24
    loop = []
    for k in range(29):
        t = 2 * math.pi * k / 28
        loop.append(v(cx + ax * math.cos(t), ay - 0.03 * math.cos(t), az * math.sin(t)))
    sweep(bm, loop, 0.022, 10, cap=False)
    pillar = [v(0.56, -0.2), v(0.52, -0.06), v(0.45, 0.04), v(cx + ax, ay - 0.03)]
    sweep(bm, pillar, lambda f: 0.03 - 0.008 * f, 10)
    for side in (-1, 1):
        t = math.radians(150)
        top = v(cx + ax * math.cos(t), ay - 0.03 * math.cos(t), side * az * math.sin(t))
        sweep(bm, [top, top + v(-0.03, -0.12, side * 0.03), top + v(-0.05, -0.24, side * 0.05)], 0.02, 10)
    finish(bm, "Halo")


def car_mirror() -> None:
    bm = bmesh.new()
    sweep(bm, [v(0, 0), v(0.0, 0.04, 0.06), v(-0.01, 0.07, 0.12)], 0.011, 8)
    rounded_bar(bm, v(-0.02, 0.09, 0.15), 0.13, 0.06, 0.05)
    finish(bm, "CarMirror")


def lamp() -> None:
    """A lens: a shallow, rounded-cornered dome 0.24 wide (z), 0.08 tall, bulging 0.03 forward."""
    bm = bmesh.new()
    loops = []
    for i in range(5):
        f = 1 - i / 4 * 0.95
        bulge = 0.03 * math.sqrt(1 - f * f) if f < 1 else 0.0
        ring = []
        for k in range(24):
            t = 2 * math.pi * k / 24
            # A superellipse: squarer than an ellipse, like a modern lamp.
            c, s = math.cos(t), math.sin(t)
            z = 0.12 * math.copysign(abs(c) ** 0.6, c) * f
            y = 0.04 * math.copysign(abs(s) ** 0.6, s) * f
            ring.append(bm.verts.new(B(v(bulge - 0.004, y, z))))
        loops.append(ring)
    bridge(bm, loops, cap_start=True, cap_end=True)
    finish(bm, "Lamp", width=0.24)


# --- The truck -------------------------------------------------------------------


def truck_wheel() -> None:
    bm = bmesh.new()
    revolve(bm, tyre_profile(TRUCK_R, TRUCK_RIM - 0.005, TRUCK_W, 0.02), 48)
    finish(bm, "TruckTyre", radius=TRUCK_R, width=TRUCK_W)

    bm = bmesh.new()
    hw = TRUCK_W / 2
    # The rim's barrel and its dished face, out to the hub.
    revolve(bm, [(TRUCK_RIM - 0.012, -hw * 0.85), (TRUCK_RIM, -hw * 0.85), (TRUCK_RIM, hw * 0.82), (TRUCK_RIM + 0.012, hw * 0.88), (TRUCK_RIM - 0.01, hw * 0.88),
                 (TRUCK_RIM - 0.06, hw * 0.7), (0.15, hw * 0.7), (0.12, hw * 0.78), (0.001, hw * 0.78), (0.001, hw * 0.66), (0.12, hw * 0.66), (0.15, hw * 0.58), (TRUCK_RIM - 0.07, hw * 0.58)], 40)
    # The hub, its cap and the ten wheel nuts round it.
    revolve(bm, [(0.001, hw * 0.78), (0.1, hw * 0.78), (0.1, hw * 0.95), (0.06, hw * 1.08), (0.001, hw * 1.1)], 24)
    for k in range(10):
        a = 2 * math.pi * k / 10
        revolve(bm, [(0.001, hw * 0.78), (0.018, hw * 0.78), (0.018, hw * 0.9), (0.001, hw * 0.92)], 6, centre=v(0.135 * math.cos(a), 0.135 * math.sin(a)))
    finish(bm, "TruckRim", radius=TRUCK_RIM)


def truck_cab_parts() -> None:
    # The grille: a frame and seven slats, its back on the cab's face.
    bm = bmesh.new()
    w, h = 1.3, 0.8
    obox(bm, v(0.015, 0), v(1, 0), v(0, 1), v(0, 0, 1), 0.015, h / 2, w / 2)
    for side in (-1, 1):
        obox(bm, v(0.035, side * (h / 2 - 0.03)), v(1, 0), v(0, 1), v(0, 0, 1), 0.025, 0.03, w / 2)
        obox(bm, v(0.035, 0, side * (w / 2 - 0.03)), v(1, 0), v(0, 1), v(0, 0, 1), 0.025, h / 2, 0.03)
    for k in range(7):
        y = -h / 2 + 0.09 + (h - 0.18) * k / 6
        obox(bm, v(0.04, y), v(1, 0), v(0, 1), v(0, 0, 1), 0.012, 0.022, w / 2 - 0.05)
    finish(bm, "TruckGrille", smooth=False, width=w, height=h)

    bm = bmesh.new()
    rounded_bar(bm, v(0, 0), 2.48, 0.34, 0.24, 8)
    finish(bm, "TruckBumper", length=2.48)

    # The mirror: an arm from the cab's side, the tall main glass and the small wide-angle one below.
    bm = bmesh.new()
    sweep(bm, [v(0, 0), v(0.02, 0.05, 0.12), v(0.02, 0.06, 0.26)], 0.02, 8)
    sweep(bm, [v(0, -0.55), v(0.02, -0.5, 0.12), v(0.02, -0.48, 0.26)], 0.018, 8)
    obox(bm, v(0.02, -0.12, 0.3), v(1, 0), v(0, 1), v(0, 0, 1), 0.05, 0.27, 0.1)
    obox(bm, v(0.02, -0.5, 0.3), v(1, 0), v(0, 1), v(0, 0, 1), 0.045, 0.08, 0.1)
    finish(bm, "TruckMirror", smooth=False)

    bm = bmesh.new()
    r, half = 0.3, 0.5
    # The tank, its ends rounded, and two straps a little proud of it.
    prof = [(0.001, -half - 0.03), (r * 0.8, -half - 0.02), (r, -half + 0.04), (r, half - 0.04), (r * 0.8, half + 0.02), (0.001, half + 0.03)]
    revolve(bm, prof, 28)
    for at in (-0.25, 0.25):
        revolve(bm, [(r - 0.005, at - 0.03), (r + 0.012, at - 0.03), (r + 0.012, at + 0.03), (r - 0.005, at + 0.03)], 28)
    # Revolved round z like the wheels: the code turns it to lie along x.
    finish(bm, "FuelTank", length=2 * half, radius=r)


# --- The record cars -------------------------------------------------------------


def record_parts() -> None:
    bm = bmesh.new()
    # A solid wheel, crowned across its tread, its faces dished to a hub boss.
    revolve(bm, [(0.001, -0.42), (0.18, -0.42), (0.24, -0.36), (0.8, -0.44), (0.97, -0.5), (1.0, -0.3), (1.0, 0.3), (0.97, 0.5), (0.8, 0.44), (0.24, 0.36), (0.18, 0.42), (0.001, 0.42)], 48)
    revolve(bm, [(0.001, 0.36), (0.13, 0.36), (0.13, 0.52), (0.09, 0.58), (0.001, 0.58)], 20)
    finish(bm, "RecordWheel", radius=1.0, width=1.0)

    bm = bmesh.new()
    # The canister, round z here like the others (the code turns it to lie along x), its lid and its hinge.
    revolve(bm, [(0.001, -0.5), (0.92, -0.5), (1.0, -0.42), (1.0, 0.36), (1.06, 0.4), (1.06, 0.48), (0.95, 0.52), (0.001, 0.53)], 28)
    obox(bm, v(0, 1.05, 0.42), v(1, 0), v(0, 1), v(0, 0, 1), 0.25, 0.06, 0.08)
    finish(bm, "ChuteCan", radius=1.0, length=1.0)

    bm = bmesh.new()
    # The nozzle: an open, converging shell (front radius 1 at z −0.5, back 0.9 at z +0.5), lipped at the back.
    revolve(bm, [(1.0, -0.5), (0.97, 0.0), (0.9, 0.48), (0.92, 0.5), (0.85, 0.5), (0.82, 0.0), (0.88, -0.5)], 32)
    for k in range(16):
        a = 2 * math.pi * (k + 0.5) / 16
        d = v(math.cos(a), math.sin(a))
        ac = v(-math.sin(a), math.cos(a))
        p0, p1 = d * 0.995 + v(0, 0, -0.35), d * 0.91 + v(0, 0, 0.45)
        along = (p1 - p0).normalized()
        obox(bm, (p0 + p1) / 2, along, ac, along.cross(ac).normalized(), (p1 - p0).length / 2, 0.03, 0.025)
    finish(bm, "JetNozzle", radius=1.0, length=1.0)

    bm = bmesh.new()
    r = INTAKE_R
    revolve(bm, [(r * 0.86, 0.0), (r * 0.98, -0.04), (r * 1.08, 0.0), (r * 1.02, 0.05), (r * 0.9, 0.04)], 32)
    finish(bm, "IntakeLip", radius=r)

    bm = bmesh.new()
    # The engine's face 0.3 m inside the mouth: a dark lining back to it, a spinner cone and a ring of fan blades.
    revolve(bm, [(r * 0.86, 0.0), (r * 0.86, -0.32), (r * 0.84, -0.32), (r * 0.84, 0.0)], 32)
    revolve(bm, [(0.001, -0.3), (r * 0.32, -0.3), (r * 0.26, -0.24), (0.001, -0.17)], 16)
    for k in range(14):
        a = 2 * math.pi * k / 14
        d = v(math.cos(a), math.sin(a))
        ac = v(-math.sin(a), math.cos(a))
        tw = math.radians(35)
        obox(bm, d * (r * 0.58) + v(0, 0, -0.31), d, ac * math.cos(tw) + v(0, 0, math.sin(tw)), v(0, 0, 1), r * 0.27, 0.025, 0.004)
    finish(bm, "IntakeFan", smooth=False)


def sensor_window() -> None:
    """A faceted pane (eight facets round a flat middle) in a frame, facing down, radius 1."""
    bm = bmesh.new()
    revolve(bm, [(0.86, 0.0), (1.0, 0.0), (1.0, -0.06), (0.86, -0.08)], 32)
    # Revolved round z like the wheels: swap three.js y and z (Blender's z and −y) so it lies flat, its lip hanging down.
    for vert in bm.verts:
        x, by, bz = vert.co
        vert.co = Vector((x, -bz, -by))
    finish(bm, "SensorFrame", radius=1.0)
    bm = bmesh.new()
    mid = bm.verts.new(B(v(0, -0.12)))
    inner = [bm.verts.new(B(v(0.45 * math.cos(2 * math.pi * k / 8), -0.12, 0.45 * math.sin(2 * math.pi * k / 8)))) for k in range(8)]
    outer = [bm.verts.new(B(v(0.87 * math.cos(2 * math.pi * k / 8), -0.06, 0.87 * math.sin(2 * math.pi * k / 8)))) for k in range(8)]
    for k in range(8):
        n = (k + 1) % 8
        bm.faces.new((mid, inner[n], inner[k]))
        bm.faces.new((inner[k], inner[n], outer[n], outer[k]))
    finish(bm, "SensorWindow", smooth=False, radius=1.0)


def build() -> None:
    car_wheel()
    helmet()
    halo()
    car_mirror()
    lamp()
    truck_wheel()
    truck_cab_parts()
    record_parts()
    sensor_window()


def preview(path: Path) -> None:
    st = Stage()
    q = math.pi / 2
    # Scales are in Blender axes, where the axle (three.js z) is y.
    # A row: the racing wheel, the truck wheel and the record wheel, then the helmet in its halo, the cab's parts and the jet's.
    st.place("CarTyre", "black", (0, CAR_R, 0))
    st.place("CarRim", "steel", (0, CAR_R, 0))
    st.place("CarBrake", "disc", (0, CAR_R, -0.02))
    st.place("TruckTyre", "black", (1.0, TRUCK_R, 0))
    st.place("TruckRim", "steel", (1.0, TRUCK_R, 0))
    st.place("RecordWheel", "metal", (2.2, 0.45, 0), scale=(0.45, 0.2, 0.45))
    st.place("Helmet", "white", (3.1, 0.5, 0))
    st.place("Visor", "black", (3.1, 0.5, 0))
    st.place("Halo", "black", (3.1, 0.5, 0))
    st.place("CarMirror", "white", (3.6, 0.2, 0.2))
    st.place("TruckGrille", "metal", (4.3, 0.6, -0.5), rot=(0, 0, -q))
    st.place("TruckBumper", "metal", (4.3, 0.2, -0.5))
    st.place("Lamp", "white", (4.4, 0.45, 0.4))
    st.place("TruckMirror", "black", (4.9, 0.7, 0))
    st.place("FuelTank", "steel", (5.6, 0.32, 0), rot=(0, 0, 0))
    st.place("ChuteCan", "teal", (6.4, 0.2, 0), scale=(0.2, 0.3, 0.2))
    st.place("JetNozzle", "disc", (7.0, 0.45, 0), scale=(0.45, 0.5, 0.45))
    st.place("IntakeLip", "white", (7.7, 0.3, 0))
    st.place("IntakeFan", "disc", (7.7, 0.3, 0))
    st.place("SensorFrame", "metal", (8.3, 0.3, 0), rot=(q, 0, 0), scale=(0.25, 0.25, 0.25))
    st.place("SensorWindow", "black", (8.3, 0.3, 0), rot=(q, 0, 0), scale=(0.25, 0.25, 0.25))
    st.render(path, centre=(4.2, 0, 0.4), ortho=9.5, size=(1600, 520), tilt=78, turn=12)


run(OUT, PREVIEW, build, preview)
