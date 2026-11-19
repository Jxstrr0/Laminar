"""
Belyanka airfield's buildings and runway furniture (PR 13o), built headless
in Blender from numbers. Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/airfield/build.py -- [--preview]

Writes public/models/airfield.glb and public/models/models.json (the hash of
every art script), and with --preview also art/airfield/preview.jpg.

The runway stays in code (AIRFIELD_SCENE.runway in src/data/replay.ts: its
length, width and centre line). These are the pieces the kit-plane replay
stands round it (src/render/replayScene.ts), each at its own origin, built
along +x (the runway's direction), facing the runway across −y here:

- Buildings: the whole field side as one piece: the apron and its taxiway,
  three hangars, the clubhouse, the control tower, parked planes and a fuel
  truck. Its origin is at the apron's runway-side corner nearest the
  runway's start.
- Threshold: the white bars across one end of the runway.
- RunwayLight: one edge light.
- Windsock: the windsock on its mast.

PR 13as polished it with the shared venue blocks (art/venuelib.py): barrel
roofs and ribbed doors on the hangars, lofted planes, a fuel bowser, a car
park, trees, a fence, floodlights, fuel tanks and a fire shed, the runway's
touchdown marks, and a striped cone of a windsock.
"""

from __future__ import annotations

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
from kitlib import ROOT  # noqa: E402
from venuelib import Mesh, car, fence, lamp_mast, light_plane, lorry_cab, run, srgb, tree, wheel  # noqa: E402

OUT = ROOT / "public" / "models" / "airfield.glb"
PREVIEW = ROOT / "art" / "airfield" / "preview.jpg"

# The runway's width: AIRFIELD_SCENE.runway.width in src/data/replay.ts.
RUNWAY = 20.0
# The apron's runway-side edge is this far from the runway's centre line, and the taxiway joins the runway's edge.
APRON_OUT = 35.0

venuelib.COLOURS.update({
    "Concrete": "C9CFD6",
    "Taxi": "B3BCC4",
    "Asphalt": "7D848C",
    "Yellow": "E3B23B",
    "White": "F4F4F2",
    "Hangar": "E9ECF2",
    "HangarRoof": "8A90B0",
    "Door": "6B7680",
    "DoorSeam": "4F5862",
    "Wall": "EEF0F5",
    "Glass": "2C3560",
    "Roof": "5D6873",
    "Steel": "5D6873",
    "Teal": "2E9E95",
    "Plane1": "F4F4F2",
    "Plane2": "E0695D",
    "Plane3": "4F5BD5",
    "Tank": "B9C0C8",
    "Cab": "3E4A7A",
    "Fire": "D9483B",
    "Orange": "F07A2A",
    "Car1": "4F5BD5",
    "Car2": "A88BE0",
    "Car3": "6B7680",
    "Car4": "E9ECF2",
})


def hangar(m: Mesh, x0: float, y0: float, width: float, depth: float, height: float) -> None:
    """A hangar: walls, a smooth barrel roof with its gable ends, and ribbed sliding doors facing the apron (−y)."""
    wall = height * 0.6
    rise = height * 0.4
    m.box(x0, x0 + width, y0, y0 + depth, 0, wall, "Hangar")
    steps = 18
    arc = [(x0 + width / 2 - (width / 2 + 0.3) * math.cos(math.pi * k / steps), wall + rise * math.sin(math.pi * k / steps)) for k in range(steps + 1)]
    # The roof: a curved sheet a little proud of the walls, front to back, then the gable ends that fill under it.
    m.loft([[(x, y0 - 0.4, z) for x, z in arc], [(x, y0 + depth + 0.4, z) for x, z in arc]], "HangarRoof", cap_start=False, cap_end=False, closed=False)
    m.loft([[(x, y0 + depth + 0.4, z - 0.15) for x, z in arc], [(x, y0 - 0.4, z - 0.15) for x, z in arc]], "HangarRoof", cap_start=False, cap_end=False, closed=False)
    for y, flip in ((y0 - 0.02, False), (y0 + depth + 0.02, True)):
        for k in range(steps):
            (xa, za), (xb, zb) = arc[k], arc[k + 1]
            quad = [(xa, y, wall), (xb, y, wall), (xb, y, zb), (xa, y, za)]
            m.poly(list(reversed(quad)) if flip else quad, "Hangar")
    # Sliding doors: four leaves with seams and a rail, the teal band over them.
    door_w = (width - 4) / 4
    for k in range(4):
        dx = x0 + 2 + k * door_w
        m.box(dx + 0.05, dx + door_w - 0.05, y0 - 0.12, y0, 0, height * 0.55, "Door")
    for r in range(1, 6):
        z = height * 0.55 * r / 6
        m.box(x0 + 2, x0 + width - 2, y0 - 0.16, y0 - 0.12, z - 0.04, z + 0.04, "DoorSeam")
    m.box(x0 + 1, x0 + width - 1, y0 - 0.2, y0, height * 0.55, height * 0.58, "Steel")
    m.box(x0, x0 + width, y0 - 0.06, y0, height * 0.58, wall, "Teal")
    # A band of windows down each side.
    m.box(x0 - 0.03, x0 + width + 0.03, y0 + 3, y0 + depth - 3, wall * 0.55, wall * 0.8, "Glass")


def tower(m: Mesh, x: float, y: float) -> None:
    """The control tower: an eight-sided shaft with slit windows, a cab wider at the top with its glazing raked out, a roof, a mast and a little radar."""
    m.cyl((x, y, 0), (x, y, 15), 3.2, "Wall", 8)
    for k in range(4):
        m.box(x - 0.4, x + 0.4, y - 3.3, y - 3.1, 3 + k * 3, 4.6 + k * 3, "Glass")
    m.cyl((x, y, 15), (x, y, 15.6), 5.2, "Roof", 8)
    m.cyl((x, y, 15.6), (x, y, 19), 4.8, "Glass", 8, rb=5.6)
    m.cyl((x, y, 19), (x, y, 19.6), 6.0, "Roof", 8)
    m.cyl((x, y, 19.6), (x, y, 24), 0.12, "Steel", 6)
    m.box(x - 1.2, x + 1.2, y - 0.04, y + 0.04, 22.5, 22.6, "Steel")
    m.cyl((x + 2.5, y + 2.5, 19.6), (x + 2.5, y + 2.5, 20.6), 0.15, "Steel", 6)
    m.box(x + 1.7, x + 3.3, y + 2.4, y + 2.6, 20.6, 21.0, "White")


def clubhouse(m: Mesh, x0: float, x1: float, y0: float) -> None:
    """The clubhouse: low, glazed towards the apron, a deep roof, and a terrace with tables and sunshades."""
    m.box(x0, x1, y0 + 2, y0 + 16, 0, 5, "Wall")
    m.box(x0 + 1, x1 - 1, y0 + 1.95, y0 + 2, 1.0, 4.2, "Glass")
    for k in range(1, 8):
        px = x0 + 1 + k * (x1 - x0 - 2) / 8
        m.box(px - 0.08, px + 0.08, y0 + 1.9, y0 + 1.95, 1.0, 4.2, "Steel")
    m.box(x0 - 1, x1 + 1, y0 - 1.5, y0 + 17, 5, 5.4, "Roof")
    m.box(x0 - 1, x1 + 1, y0 - 1.6, y0 - 1.5, 4.6, 5.4, "Teal")
    for px in (x0, (x0 + x1) / 2, x1):
        m.cyl((px, y0 - 1.2, 0), (px, y0 - 1.2, 5), 0.12, "Steel", 6)
    m.box(x0, x1, y0 - 6, y0 + 2, 0, 0.15, "Concrete")
    for k, colour in enumerate(("Teal", "Fire", "Yellow", "Teal")):
        tx = x0 + 6 + k * (x1 - x0 - 12) / 3
        m.cyl((tx, y0 - 3.5, 0.15), (tx, y0 - 3.5, 0.9), 0.5, "White", 10)
        m.cyl((tx, y0 - 3.5, 0.15), (tx, y0 - 3.5, 2.6), 0.04, "Steel", 6)
        m.cyl((tx, y0 - 3.5, 2.2), (tx, y0 - 3.5, 2.6), 1.4, colour, 10, rb=0.05)


def fuel_bowser(m: Mesh) -> None:
    """The fuel bowser along +x from the origin: a round tank on a chassis, a hose reel and the cab."""
    m.box(-0.2, 5.6, -1.1, 1.1, 0.5, 0.75, "Black")
    m.loft([[(x, 1.05 * math.cos(a), 1.8 + 0.95 * math.sin(a)) for a in (2 * math.pi * k / 14 for k in range(14))] for x in (0.0, 5.4)], "Tank")
    m.box(0.0, 0.6, -0.8, 0.8, 0.8, 2.0, "Steel")
    m.cyl((0.3, -1.05, 1.4), (0.3, -1.25, 1.4), 0.45, "Black", 12)
    for wx in (0.9, 3.2):
        for s in (-1, 1):
            wheel(m, wx, s * 0.8, 0.45, 0.32)
    lorry_cab(m, 5.6, 2.3, 2.6, "Cab")


def fire_shed(m: Mesh, x0: float, y0: float) -> None:
    """A small fire shed with two red doors and a tender peeking out."""
    m.box(x0, x0 + 16, y0, y0 + 10, 0, 6, "Wall")
    m.box(x0 - 0.5, x0 + 16.5, y0 - 0.5, y0 + 10.5, 6, 6.4, "Roof")
    for k in range(2):
        dx = x0 + 1.5 + k * 7
        m.box(dx, dx + 5.5, y0 - 0.06, y0, 0, 4.6, "Fire")
        for r in range(1, 5):
            m.box(dx, dx + 5.5, y0 - 0.09, y0 - 0.06, r * 0.92 - 0.03, r * 0.92 + 0.03, "Wall")
    m.box(x0, x0 + 16, y0 - 0.07, y0, 5.0, 5.6, "Fire")


def buildings() -> None:
    """The field side, from the apron's runway-side corner: apron and taxiway, three hangars, the clubhouse, the tower, the fire shed, parked planes, the bowser, fuel tanks, a car park, trees, a fence and floodlights."""
    m = Mesh()
    width = 300.0
    depth = 60.0
    # The apron, a hair above the grass, with tie-down lines and a lead-in line, and the taxiway down to the runway's edge.
    m.box(0, width, 0, depth, 0, 0.02, "Concrete")
    m.box(width - 40, width - 22, -(APRON_OUT - RUNWAY / 2), 0, 0, 0.02, "Taxi")
    m.box(width - 31.2, width - 30.8, -(APRON_OUT - RUNWAY / 2), depth * 0.6, 0.02, 0.03, "Yellow")
    m.box(10, width - 45, depth * 0.6 - 0.2, depth * 0.6 + 0.2, 0.02, 0.03, "Yellow")
    for k in range(6):
        x = 30 + k * 25
        m.box(x - 0.2, x + 0.2, 14, 30, 0.02, 0.03, "White")
    # Three hangars along the back of the apron.
    for k in range(3):
        hangar(m, 10 + k * 50, depth, 40, 30, 14)
    clubhouse(m, 170, 215, depth)
    tower(m, 235, depth + 7)
    fire_shed(m, 250, depth + 2)
    # Planes parked on the apron, noses to the runway (−y).
    for x, colour in ((30, "Plane1"), (55, "Plane2"), (80, "Plane3"), (115, "Plane1")):
        with m.at(x, 22, 0, -math.pi / 2):
            light_plane(m, colour, "Teal" if colour == "Plane1" else "White")
    with m.at(150, 13.2, 0):
        fuel_bowser(m)
    # The fuel farm by the taxiway: two tanks on a bund.
    m.box(width - 18, width - 4, 6, 18, 0, 0.6, "Concrete")
    for ty in (9, 15):
        m.loft([[(width - 16 + 0.0, ty + 1.8 * math.cos(a), 1.0 + 1.8 + 1.8 * math.sin(a)) for a in (2 * math.pi * k / 16 for k in range(16))], [(width - 6, ty + 1.8 * math.cos(a), 1.0 + 1.8 + 1.8 * math.sin(a)) for a in (2 * math.pi * k / 16 for k in range(16))]], "Tank")
        for sx in (width - 14, width - 8):
            m.box(sx - 0.3, sx + 0.3, ty - 1.2, ty + 1.2, 0.6, 1.4, "Steel")
    # The car park behind the clubhouse, and the cars in it.
    m.box(150, 230, depth + 22, depth + 40, 0, 0.02, "Asphalt")
    for k in range(14):
        x = 153 + k * 5.4
        m.box(x - 0.08, x + 0.08, depth + 23, depth + 28, 0.02, 0.03, "White")
        if k % 2 == 0 and k < 13:
            with m.at(x + 2.7, depth + 25.5, 0, math.pi / 2 if k % 2 else -math.pi / 2):
                car(m, ("Car1", "Car2", "Car3", "Car4")[k % 4])
    # Floodlights over the apron, the fence along the back and trees beyond it.
    for x in (5, 75, 145, 220, 290):
        lamp_mast(m, x, depth - 2, 14, -math.pi / 2, 3)
    fence(m, -20, width + 20, depth + 46, 2.0, 10.0)
    for k in range(15):
        x = -15 + k * 23 + (k * 37 % 7)
        y = depth + 52 + (k * 53 % 11)
        tree(m, x, y, 9 + (k * 29 % 6), "pine" if k % 3 == 0 else "round", "LeafDark" if k % 2 else "Leaf")
    m.done("Buildings")


def threshold() -> None:
    """The white marks at the runway's start, a hair above it: eight threshold bars, four each side of the centre line, then touchdown-zone bars and the two big aiming-point blocks."""
    m = Mesh()
    bar, gap = 1.8, 0.6
    for side in (-1, 1):
        for k in range(4):
            y0 = side * (1.5 + k * (bar + gap))
            m.box(6, 36, min(y0, y0 + side * bar), max(y0, y0 + side * bar), 0, 0.015, "White")
        # Touchdown zone: pairs of bars every 150 m, then the aiming point.
        for k, x in enumerate((150, 300, 450)):
            for b in range(3 - k):
                y0 = side * (3.0 + b * 1.6)
                m.box(x, x + 22, min(y0, y0 + side * 0.9), max(y0, y0 + side * 0.9), 0, 0.015, "White")
        m.box(220, 265, min(side * 4, side * 8), max(side * 4, side * 8), 0, 0.015, "White")
    m.done("Threshold")


def runway_light() -> None:
    """One runway edge light: a short round post, a collar and a glowing dome."""
    m = Mesh()
    m.cyl((0, 0, 0), (0, 0, 0.35), 0.06, "Steel", 8)
    m.cyl((0, 0, 0.33), (0, 0, 0.38), 0.14, "Steel", 10)
    m.sphere((0, 0, 0.42), 0.13, "Lamp", 10, (1, 1, 0.9))
    m.done("RunwayLight")


def windsock() -> None:
    """The windsock: a mast with a ring frame and the striped cone streaming along +x, drooping a touch."""
    m = Mesh()
    m.cyl((0, 0, 0), (0, 0, 6.0), 0.09, "Steel", 8, rb=0.06)
    m.cyl((0, 0, 0), (0, 0, 0.3), 0.6, "Concrete", 10)
    m.cyl((0, 0, 5.6), (0.15, 0, 5.6), 0.48, "Steel", 14, cap=False)
    n = 14
    for k in range(5):
        x0, x1 = 0.15 + k * 0.7, 0.15 + (k + 1) * 0.7
        r0, r1 = 0.46 - k * 0.06, 0.46 - (k + 1) * 0.06
        z0, z1 = 5.6 - 0.04 * k * k, 5.6 - 0.04 * (k + 1) ** 2
        ring = lambda x, r, z: [(x, r * math.cos(2 * math.pi * j / n), z + r * math.sin(2 * math.pi * j / n)) for j in range(n)]
        m.loft([ring(x0, r0, z0), ring(x1, r1, z1)], "Orange" if k % 2 == 0 else "White", cap_start=False, cap_end=False)
    m.done("Windsock")


def build() -> None:
    buildings()
    threshold()
    runway_light()
    windsock()


def preview(path: Path) -> None:
    """Lay the pieces by a stretch of runway as the replay would, and shoot it from the passes' camera."""
    scene = bpy.context.scene
    o = {ob.name: ob for ob in scene.objects}
    bm = bmesh.new()
    for (y0, y1, colour) in ((-400, -RUNWAY / 2, "C9D3B8"), (-RUNWAY / 2, RUNWAY / 2, "6B737A"), (RUNWAY / 2, 400, "C9D3B8")):
        f = bm.faces.new([bm.verts.new(p) for p in ((-800, y0, 0), (900, y0, 0), (900, y1, 0), (-800, y1, 0))])
        f.material_index = 0 if colour == "C9D3B8" else 1
    me = bpy.data.meshes.new("Ground")
    bm.to_mesh(me)
    for colour in ("C9D3B8", "6B737A"):
        gm = bpy.data.materials.new(colour)
        gm.use_nodes = True
        gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb(colour)
        me.materials.append(gm)
    scene.collection.objects.link(bpy.data.objects.new("Ground", me))
    o["Buildings"].location = (-350, APRON_OUT, 0)
    o["Threshold"].location = (-700, 0, 0)
    o["Windsock"].location = (100, 30, 0)
    for k in range(25):
        for side in (-1, 1):
            c = o["RunwayLight"].copy()
            c.location = (-700 + k * 60, side * (RUNWAY / 2 + 1.5), 0)
            scene.collection.objects.link(c)
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
    cam_obj.location = (120, -25, 18)
    scene.collection.objects.link(cam_obj)
    cam_obj.rotation_euler = (Vector((-200, 60, 0)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


run(OUT, PREVIEW, build, preview)
