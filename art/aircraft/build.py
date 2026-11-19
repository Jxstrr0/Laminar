"""
The aircraft kit (PR 13aq), built headless in Blender from numbers. Nobody
opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/aircraft/build.py -- [--preview]

Writes public/models/aircraft.glb and public/models/models.json (the hash of
every art script), and with --preview also art/aircraft/preview.jpg.

The parts of the racing quad, the survey drone and the light aircraft that
no slider reshapes. Their fuselages, pods and wings stay lofted in code from
the drag model's own sections; these are what hang on them:

- Prop2, Prop3: a two- and a three-bladed prop, radius 1 for the code to
  size, turning round x (its disc across y and z), the first blade along +z.
  Each blade tapers to a rounded tip and twists from steep at the hub to
  flat at the tip.
- DroneMotor: the quad's brushless motor, standing up (y), centred: the
  mount, the bell with its cooling band, and the prop nut on top.
- PusherMotor: the survey drone's motor along x, its prop end at −x.
- LensBarrel, LensGlass: a camera's lens, radius 1, looking along +x: the
  barrel and the glass bulging out of it.
- GearTyre, GearHub: the light aircraft's balloon tyre (0.19 m radius,
  0.13 m wide) and its hub, round z, the hub's face outward at +z.
- Windscreen: the aircraft's curved windscreen, 1 long (x, its foot at +x)
  and 1 wide (z), bowing up 0.12 in the middle, for the code to stretch
  between the cowl and the wing.
- NavLight: a wingtip light's lens, its point forward (+x).

The numbers are those in src/data/drone.ts, src/data/plane.ts and
src/data/aircraft.ts; tests/models.test.ts checks the ones the code scales by.
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
from kitlib import ROOT, B, Stage, bridge, finish, revolve, run, v  # noqa: E402

OUT = ROOT / "public" / "models" / "aircraft.glb"
PREVIEW = ROOT / "art" / "aircraft" / "preview.jpg"

# DRONE_BODY.motor and motorHeight (src/data/drone.ts).
MOTOR_R, MOTOR_H = 0.014, 0.016
# planeFigure DRAW.motor and motorLength.
PUSHER_R, PUSHER_L = 0.025, 0.08
# AIRCRAFT_BODY.wheel (src/data/aircraft.ts).
GEAR_R, GEAR_W = 0.19, 0.13


def axle_to_y(bm) -> None:
    """A part revolved round z (three.js), stood up: three.js y and z swapped."""
    for vert in bm.verts:
        x, by, bz = vert.co
        vert.co = Vector((x, -bz, -by))


def axle_to_x(bm) -> None:
    """A part revolved round z (three.js), laid along x: three.js x and z swapped."""
    for vert in bm.verts:
        bx, by, bz = vert.co
        vert.co = Vector((-by, -bx, bz))


def prop(blades: int, name: str) -> None:
    """A prop of radius 1 round x: a hub and `blades` twisted, tapered blades."""
    bm = bmesh.new()
    revolve(bm, [(0.001, -0.07), (0.07, -0.07), (0.1, -0.04), (0.1, 0.04), (0.07, 0.07), (0.001, 0.07)], 20)
    axle_to_x(bm)
    stations = [0.08 + 0.92 * (k / 13) ** 0.9 for k in range(14)]
    section = 10
    for b in range(blades):
        turn = 2 * math.pi * b / blades
        radial = v(0, math.sin(turn), math.cos(turn))  # out along the blade (+z for the first)
        tangent = v(0, math.cos(turn), -math.sin(turn))  # the way it turns
        loops = []
        for r in stations:
            chord = max(0.03, 0.2 * math.sqrt(max(0.0, 1 - r * r)) * (0.55 + 0.45 * (1 - r)))
            if r < 0.15:
                chord = 0.08 + (r - 0.08) / 0.07 * 0.08
            thick = chord * (0.22 - 0.14 * r)
            beta = math.atan(0.75 / (2 * math.pi * max(r, 0.12)))
            along = tangent * math.cos(beta) + v(1, 0, 0) * math.sin(beta)
            normal = v(1, 0, 0) * math.cos(beta) - tangent * math.sin(beta)
            centre = radial * r
            ring = []
            for k in range(section):
                t = 2 * math.pi * k / section
                u = 0.5 * math.cos(t)  # −0.5 trailing to +0.5 leading
                h = 0.5 * thick * math.sin(t) * (1.2 - 0.6 * (u + 0.5))
                p = centre + along * (u * chord) + normal * h
                ring.append(bm.verts.new(B(p)))
            loops.append(ring)
        bridge(bm, loops, cap_start=False, cap_end=True)
    finish(bm, name, radius=1.0, blades=blades)


def drone_motor() -> None:
    h = MOTOR_H / 2
    r = MOTOR_R
    bm = bmesh.new()
    # The mount at the foot, the bell with a groove for its cooling band, the cap, and the shaft and nut on top.
    revolve(bm, [(0.001, -h), (r * 1.05, -h), (r * 1.05, -h + 0.002), (r * 0.9, -h + 0.0025), (r * 0.98, -h + 0.0035),
                 (r, -h + 0.004), (r, 0.0), (r * 0.94, 0.001), (r * 0.94, 0.002), (r, 0.003), (r, h - 0.0015), (r * 0.85, h),
                 (0.0025, h), (0.0025, h + 0.003), (0.0045, h + 0.003), (0.0045, h + 0.007), (0.001, h + 0.0075)], 24)
    axle_to_y(bm)
    finish(bm, "DroneMotor", radius=r, height=MOTOR_H)


def pusher_motor() -> None:
    h = PUSHER_L / 2
    r = PUSHER_R
    bm = bmesh.new()
    # Profile from the prop end (z −h) to the mount (z +h): prop adapter, the can with a band, the stator showing, the mount plate.
    revolve(bm, [(0.001, -h - 0.012), (0.006, -h - 0.012), (0.006, -h), (r * 0.95, -h + 0.004), (r, -h + 0.01), (r, -0.004),
                 (r * 0.92, -0.002), (r * 0.92, 0.003), (r, 0.005), (r, h * 0.55), (r * 0.82, h * 0.62), (r * 0.82, h - 0.006),
                 (r * 0.86, h - 0.006), (r * 0.86, h), (0.001, h)], 28)
    axle_to_x(bm)
    finish(bm, "PusherMotor", radius=r, length=PUSHER_L)


def lens() -> None:
    bm = bmesh.new()
    revolve(bm, [(0.78, 0.0), (1.0, 0.0), (1.0, 0.3), (0.9, 0.36), (0.78, 0.33)], 24)
    axle_to_x(bm)
    finish(bm, "LensBarrel", radius=1.0)
    bm = bmesh.new()
    # The dome: from its crown on the axis out to the barrel's lip, and back along the flat underneath.
    dome = [(0.8 * math.sin(a), 0.2 + 0.22 * math.cos(a)) for a in [math.pi / 2 * k / 6 for k in range(1, 7)]]
    revolve(bm, [(0.001, 0.42)] + dome + [(0.001, 0.2)], 24)
    axle_to_x(bm)
    finish(bm, "LensGlass", radius=1.0)


def gear_wheel() -> None:
    hw = GEAR_W / 2
    rim = 0.075
    bm = bmesh.new()
    # A fat balloon tyre: the sidewall bulges well out past the tread.
    side = []
    for k in range(9):
        a = -math.pi / 2 + math.pi * k / 8
        side.append((rim + (GEAR_R - rim) * (0.5 + 0.5 * math.sin(a)), -hw * (0.75 + 0.25 * math.cos(a)) - 0.01 * math.cos(a)))
    loop = side + [(r, -z) for r, z in reversed(side)]
    revolve(bm, loop, 40)
    finish(bm, "GearTyre", radius=GEAR_R, width=GEAR_W)
    bm = bmesh.new()
    revolve(bm, [(0.001, -hw * 0.7), (rim + 0.004, -hw * 0.7), (rim + 0.004, hw * 0.6), (rim * 0.75, hw * 0.75), (0.03, hw * 0.8), (0.03, hw * 1.05), (0.001, hw * 1.1)], 28)
    for k in range(6):
        a = 2 * math.pi * k / 6
        revolve(bm, [(0.001, hw * 0.7), (0.007, hw * 0.7), (0.007, hw * 0.9), (0.001, hw * 0.92)], 6, centre=v(0.05 * math.cos(a), 0.05 * math.sin(a)))
    finish(bm, "GearHub", radius=rim)


def windscreen() -> None:
    """A curved pane, 1 long (x from 0.5 at its foot to −0.5) and 1 wide (z), bowed up 0.12 along its middle, its edges rounded in."""
    bm = bmesh.new()
    nx, nz = 6, 12
    grid = []
    for i in range(nx + 1):
        x = 0.5 - i / nx
        row = []
        for k in range(nz + 1):
            z = -0.5 + k / nz
            y = 0.12 * (1 - (2 * z) ** 2)
            row.append(bm.verts.new(B(v(x, y, z * (0.92 + 0.08 * (i / nx))))))
        grid.append(row)
    for i in range(nx):
        for k in range(nz):
            bm.faces.new((grid[i][k], grid[i][k + 1], grid[i + 1][k + 1], grid[i + 1][k]))
    finish(bm, "Windscreen", length=1.0, width=1.0)


def nav_light() -> None:
    bm = bmesh.new()
    revolve(bm, [(0.001, 0.05), (0.012, 0.04), (0.024, 0.01), (0.026, -0.02), (0.02, -0.03), (0.001, -0.03)], 14)
    axle_to_x(bm)
    finish(bm, "NavLight")


def build() -> None:
    prop(2, "Prop2")
    prop(3, "Prop3")
    drone_motor()
    pusher_motor()
    lens()
    gear_wheel()
    windscreen()
    nav_light()


def preview(path: Path) -> None:
    st = Stage()
    q = math.pi / 2
    # Scales are in Blender axes (three.js z is Blender's −y). A row from a quarter view.
    st.place("Prop2", "black", (0, 0.5, 0), scale=(0.45, 0.45, 0.45), rot=(0, 0, 0.6))
    st.place("Prop3", "black", (1.2, 0.5, 0), scale=(0.45, 0.45, 0.45), rot=(0, 0, 0.6))
    st.place("DroneMotor", "metal", (2.0, 0.2, 0), scale=(10, 10, 10))
    st.place("PusherMotor", "black", (2.7, 0.3, 0), scale=(4, 4, 4))
    st.place("LensBarrel", "black", (3.4, 0.25, 0), scale=(0.2, 0.2, 0.2), rot=(0, 0, -0.6))
    st.place("LensGlass", "teal", (3.4, 0.25, 0), scale=(0.2, 0.2, 0.2), rot=(0, 0, -0.6))
    st.place("GearTyre", "black", (4.1, 0.38, 0), scale=(2, 2, 2))
    st.place("GearHub", "steel", (4.1, 0.38, 0), scale=(2, 2, 2))
    st.place("Windscreen", "teal", (5.0, 0.3, 0), scale=(0.6, 0.6, 0.6), rot=(0, 0.5, q))
    st.place("NavLight", "white", (5.8, 0.2, 0), scale=(4, 4, 4))
    st.render(path, centre=(2.9, 0, 0.35), ortho=7, size=(1400, 480), tilt=74, turn=18)


run(OUT, PREVIEW, build, preview)
