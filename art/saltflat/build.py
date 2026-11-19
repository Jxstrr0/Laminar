"""
The salt flat's camp and course furniture (PR 13n), built headless in
Blender from numbers. Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/saltflat/build.py -- [--preview]

Writes public/models/saltflat.glb and public/models/models.json (the hash of
every art script), and with --preview also art/saltflat/preview.jpg.

The course stays in code: a run-up, the timed kilometre and room to stop,
the length of each set by the car's class (src/sim/recordReplay.ts). These
are the pieces the record replay stands along it (src/render/replayScene.ts),
each at its own origin, built along +x (the way the cars run). Pieces that
stand beside the course face it across −y here (the course is on their
right as the car comes; the scene puts them on its left, and turns them
round for its right):

- TeamCamp: the team's transporter, an awning, two motorhomes and a fuel bowser.
- TimingHut: the timekeepers' trailer, with its aerial.
- TimingPost: one beam post of the timing lights, its eye across the course.
- KmBoard: a kilometre board, facing the oncoming car (−x).
- Marker: an orange post marking the course's edge.
- ViewingArea: canopies and parked cars where people watch the timed kilometre.
- RecoveryTruck: the flatbed that waits where the cars stop.

The game's axes (three.js): +x along, y up, z to the right. Blender is z-up,
so here x is the same, y is three.js −z (the left) and z is up; the glTF
exporter turns it round. Every piece keeps its daylight colours.

PR 13as polished it with the shared venue blocks (art/venuelib.py): proper
lorries with cabs and wheels, a tractor unit and trailer for the team,
rounded motorhomes, a tank on the fuel bowser, a generator and tyre stacks,
round posts, peaked canopies with chairs, and cars that look like cars.
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
from venuelib import Mesh, car, lorry_cab, rounded, run, srgb, wheel  # noqa: E402

OUT = ROOT / "public" / "models" / "saltflat.glb"
PREVIEW = ROOT / "art" / "saltflat" / "preview.jpg"

# The graded course: RECORD_SCENE.roadWidth in src/data/replay.ts.
ROAD = 16.0

venuelib.COLOURS.update({
    "White": "F4F4F2",
    "Body": "E9ECF2",
    "Stripe": "2E9E95",
    "Cab": "3E4A7A",
    "Glass": "2C3560",
    "Black": "1D242B",
    "Steel": "5D6873",
    "Canvas": "EEF0F5",
    "Coral": "E0695D",
    "Amber": "E3A23B",
    "Orange": "F07A2A",
    "Tank": "B9C0C8",
    "Lamp": "FF5A4E",
    "Car1": "4F5BD5",
    "Car2": "A88BE0",
    "Car3": "6B7680",
    "Car4": "E9ECF2",
})
venuelib.EMISSIVE["Amber"] = 0.6


def box_body(m: Mesh, x0: float, x1: float, width: float, z0: float, z1: float, colour: str, r: float = 0.15) -> None:
    """A van or trailer body along x, centred on y = 0, its edges rounded."""
    ring = lambda x: [(x, cy, (z0 + z1) / 2 + cz) for cy, cz in rounded(width, z1 - z0, r, 2)]
    m.loft([ring(x0), ring(x1)], colour)


def motorhome(m: Mesh, x0: float, colour: str = "White") -> None:
    """A motorhome along +x from x0: a rounded body with the cab over the front, a stripe, windows, a door and wheels."""
    length, width, height = 8.5, 2.35, 3.2
    rings = []
    for fx, top, bottom in ((0.0, height, 0.55), (0.82, height, 0.55), (0.9, height - 0.25, 0.55), (0.97, height * 0.62, 0.55), (1.0, height * 0.55, 0.6)):
        rings.append([(x0 + fx * length, cy, (top + bottom) / 2 + cz) for cy, cz in rounded(width, top - bottom, 0.2, 2)])
    m.loft(rings, colour)
    hw = width / 2 + 0.01
    m.poly([(x0 + length * 0.995, -hw * 0.8, height * 0.56), (x0 + length * 0.995, hw * 0.8, height * 0.56), (x0 + length * 0.93, hw * 0.75, height * 0.8), (x0 + length * 0.93, -hw * 0.75, height * 0.8)], "Glass")
    for s in (-1, 1):
        m.box(x0 + 0.3, x0 + length * 0.92, s * hw - 0.01, s * hw + 0.01, 1.2, 1.35, "Stripe")
        m.box(x0 + 1.0, x0 + 4.5, s * hw - 0.012, s * hw + 0.012, 1.8, 2.5, "Glass")
    m.box(x0 + 5.2, x0 + 6.0, -hw - 0.015, -hw, 0.6, 2.6, "Steel")
    for wx in (x0 + 1.8, x0 + length * 0.8):
        for s in (-1, 1):
            wheel(m, wx, s * (width / 2 - 0.3), 0.42, 0.28)


def tyre_stack(m: Mesh, x: float, y: float, n: int) -> None:
    """A stack of spare tyres lying flat."""
    for k in range(n):
        m.cyl((x, y, k * 0.32), (x, y, k * 0.32 + 0.3), 0.34, "Black", 10)


def team_camp() -> None:
    """The team's camp, the course on its −y side: the tractor unit and trailer with its teal stripe, an awning with tables and chests, two motorhomes, a generator, tyre stacks and a fuel bowser."""
    m = Mesh()
    # The trailer (x 0–13.4) and tractor unit ahead of it, 2.6 wide, at y 2–4.6.
    with m.at(0, 3.3, 0):
        box_body(m, 0, 13.4, 2.6, 1.2, 4.2, "Body", 0.12)
        for s in (-1, 1):
            m.box(0.2, 13.2, s * 1.31 - 0.01, s * 1.31 + 0.01, 2.0, 2.4, "Stripe")
        m.box(0.6, 12.8, -1.1, 1.1, 0.7, 1.2, "Black")
        for wx in (1.2, 2.4, 3.6):
            for s in (-1, 1):
                wheel(m, wx, s * 1.0, 0.5, 0.36)
        m.box(11.5, 12.0, -1.0, 1.0, 0.2, 1.2, "Steel")
        m.box(13.4, 14.6, -1.1, 1.1, 0.5, 1.1, "Black")
        wheel(m, 14.0, -1.0, 0.5, 0.36)
        wheel(m, 14.0, 1.0, 0.5, 0.36)
        lorry_cab(m, 13.8, 2.5, 3.6, "Cab", 2.6)
    # The awning off the trailer's course side: a canvas sloping down to two posts, tables and chests under it.
    m.poly([(1, 1.95, 3.9), (12, 1.95, 3.9), (12, -5, 2.9), (1, -5, 2.9)], "Canvas")
    for x in (1.2, 6.5, 11.8):
        m.cyl((x, -4.9, 0), (x, -4.9, 2.9), 0.05, "Steel", 6)
    for x in (2.5, 5.0, 7.5):
        m.box(x, x + 1.4, -1.6, -0.9, 0, 1.0, "Coral")
        m.box(x + 0.02, x + 1.38, -1.62, -1.6, 0.75, 0.8, "Steel")
    m.box(9.0, 11.2, -3.2, -2.2, 0.72, 0.78, "White")
    for x in (9.2, 11.0):
        m.box(x - 0.03, x + 0.03, -3.0, -2.4, 0, 0.72, "Steel")
    tyre_stack(m, 0.3, -3.8, 4)
    tyre_stack(m, 0.3, -2.9, 3)
    # Two motorhomes and a generator between them.
    with m.at(0, 3.2, 0):
        motorhome(m, 20)
        motorhome(m, 31)
    m.box(29.0, 30.3, 2.4, 3.4, 0, 1.1, "Amber")
    m.box(29.1, 30.2, 2.38, 2.4, 0.4, 0.9, "Black")
    # The fuel bowser: a round tank on a chassis behind its cab.
    with m.at(42, 3.3, 0):
        m.box(0, 6.2, -1.0, 1.0, 0.5, 0.75, "Black")
        m.loft([[(x, 1.0 * math.cos(a), 1.75 + 0.9 * math.sin(a)) for a in (2 * math.pi * k / 14 for k in range(14))] for x in (0.2, 6.0)], "Tank")
        for s in (-1, 1):
            wheel(m, 1.2, s * 0.8, 0.45, 0.3)
            wheel(m, 2.4, s * 0.8, 0.45, 0.3)
        lorry_cab(m, 6.2, 2.3, 2.7, "Cab", 2.2)
    m.done("TeamCamp")


def timing_hut() -> None:
    """The timekeepers' trailer: a rounded box on its axle and jacks, a window to the course (−y), steps, and a mast with its aerial, a dish and a solar panel."""
    m = Mesh()
    with m.at(0, 1.2, 0):
        box_body(m, 0, 6, 2.4, 0.5, 3.0, "Body", 0.25)
        m.box(-0.1, 6.1, -1.25, 1.25, 3.0, 3.1, "Steel")
        m.box(1, 5, -1.215, -1.2, 1.5, 2.5, "Glass")
        m.box(1, 5, -1.23, -1.2, 2.55, 2.65, "Stripe")
        wheel(m, 3.0, -1.0, 0.38, 0.22)
        wheel(m, 3.0, 1.0, 0.38, 0.22)
        for x in (0.4, 5.6):
            for s in (-1, 1):
                m.box(x - 0.06, x + 0.06, s * 0.9 - 0.06, s * 0.9 + 0.06, 0, 0.5, "Steel")
        m.box(-1.2, 0, -0.08, 0.08, 0.55, 0.65, "Steel")
        for k in range(3):
            m.box(0.6, 1.4, -1.5 - k * 0.3, -1.2 - k * 0.3, 0.5 - k * 0.17, 0.55 - k * 0.17, "Steel")
    m.cyl((6.5, 2.1, 0), (6.5, 2.1, 8.0), 0.08, "Steel", 6, rb=0.05)
    m.cyl((6.5, 2.1, 8.0), (6.5, 2.1, 9.2), 0.02, "Steel", 4)
    m.sphere((6.5, 2.1, 8.15), 0.15, "Amber", 8)
    with m.at(6.5, 2.1, 6.5, -math.pi / 2):
        m.cyl((0.0, 0, 0), (0.12, 0, 0), 0.4, "White", 12, rb=0.3)
    with m.at(3.0, 1.2, 3.1):
        m.poly([(-1.5, 0.2, 0.15), (1.5, 0.2, 0.15), (1.5, 1.0, 0.55), (-1.5, 1.0, 0.55)], "Glass")
        m.poly([(-1.5, 1.0, 0.5), (1.5, 1.0, 0.5), (1.5, 0.2, 0.1), (-1.5, 0.2, 0.1)], "Steel")
    m.done("TimingHut")


def timing_post() -> None:
    """One post of the timing lights: a round striped pole on a foot, the beam's eye in a hooded box facing across the course (−y)."""
    m = Mesh()
    m.cyl((0, 0, 0), (0, 0, 0.06), 0.35, "Steel", 10)
    for k in range(5):
        m.cyl((0, 0, k * 0.5), (0, 0, (k + 1) * 0.5), 0.07, "Black" if k % 2 else "Amber", 8)
    m.box(-0.18, 0.18, -0.25, 0.12, 0.9, 1.25, "Black")
    m.box(-0.2, 0.2, -0.38, -0.25, 1.22, 1.27, "Black")
    m.cyl((0, -0.25, 1.08), (0, -0.27, 1.08), 0.07, "Lamp", 10)
    m.done("TimingPost")


def km_board() -> None:
    """A kilometre board on two round legs, facing the oncoming car (−x): black and white quarters in a steel frame, readable at speed."""
    m = Mesh()
    for y in (-0.9, 0.9):
        m.cyl((0, y, 0), (0, y, 3.25), 0.05, "Steel", 6)
    for i, (y0, z0) in enumerate(((-1.0, 1.2), (0.0, 1.2), (-1.0, 2.2), (0.0, 2.2))):
        m.box(-0.08, 0.0, y0, y0 + 1.0, z0, z0 + 1.0, "Black" if i in (0, 3) else "White")
    m.box(-0.1, 0.02, -1.06, 1.06, 3.2, 3.26, "Steel")
    m.box(-0.1, 0.02, -1.06, 1.06, 1.14, 1.2, "Steel")
    m.done("KmBoard")


def marker() -> None:
    """An orange post marking the course's edge, with a white band and a cap."""
    m = Mesh()
    m.cyl((0, 0, 0), (0, 0, 0.6), 0.06, "Orange", 6)
    m.cyl((0, 0, 0.6), (0, 0, 0.75), 0.062, "White", 6)
    m.cyl((0, 0, 0.75), (0, 0, 1.0), 0.06, "Orange", 6, rb=0.03)
    m.done("Marker")


def canopy(m: Mesh, x: float, colour: str) -> None:
    """A pop-up canopy, 5 m square from (x, 0), its peaked top in a colour, four legs and a valance."""
    m.loft([[(x, 0, 2.6), (x + 5, 0, 2.6), (x + 5, 5, 2.6), (x, 5, 2.6)], [(x + 2.5, 2.5, 3.4)] * 4], colour, cap_end=False, smooth=False)
    for y0, y1, x0, x1 in ((-0.02, 0.0, x, x + 5), (5.0, 5.02, x, x + 5)):
        m.box(x0, x1, y0, y1, 2.3, 2.6, colour)
    for px in (x + 0.05, x + 4.95):
        for py in (0.05, 4.95):
            m.cyl((px, py, 0), (px, py, 2.6), 0.04, "Steel", 4)


def chair(m: Mesh, x: float, y: float, colour: str) -> None:
    """A folding camp chair facing the course (−y)."""
    m.box(x - 0.25, x + 0.25, y - 0.25, y + 0.2, 0.42, 0.48, colour)
    m.box(x - 0.25, x + 0.25, y + 0.18, y + 0.24, 0.48, 0.95, colour)
    for sx in (-0.23, 0.23):
        m.box(x + sx - 0.02, x + sx + 0.02, y - 0.25, y + 0.24, 0, 0.45, "Steel")


def viewing_area() -> None:
    """Where people watch the timed kilometre: three peaked canopies in a row, facing the course (−y), chairs and a cool box under each, and parked cars behind."""
    m = Mesh()
    for k, colour in enumerate(("Coral", "Stripe", "Amber")):
        x = k * 7.0
        canopy(m, x, colour)
        for c in range(3):
            chair(m, x + 1.2 + c * 1.3, 1.2, ("Cab", "Coral", "Stripe")[(c + k) % 3])
        m.box(x + 3.6, x + 4.4, 3.6, 4.1, 0, 0.5, "White")
    for k, colour in enumerate(("Car1", "Car2", "Car3", "Car4", "Car3")):
        with m.at(k * 4.8 + 2.2, 9.0, 0):
            car(m, colour)
    m.done("ViewingArea")


def recovery_truck() -> None:
    """The flatbed that waits where the cars stop: a long tilting bed with a stripe, a winch, the cab with its light bar."""
    m = Mesh()
    with m.at(0, 1.25, 0):
        m.box(0, 7.4, -0.9, 0.9, 0.55, 0.9, "Black")
        m.box(-0.2, 7.4, -1.25, 1.25, 0.9, 1.2, "Body")
        for s in (-1, 1):
            m.box(-0.2, 7.4, s * 1.25 - 0.012, s * 1.25 + 0.012, 0.95, 1.15, "Stripe")
        m.box(6.6, 7.4, -0.6, 0.6, 1.2, 2.2, "Steel")
        m.cyl((7.0, -0.5, 1.6), (7.0, 0.5, 1.6), 0.25, "Black", 10)
        for wx in (1.0, 2.3):
            for s in (-1, 1):
                wheel(m, wx, s * 0.95, 0.5, 0.34)
        lorry_cab(m, 7.4, 2.4, 3.0, "Body", 2.6)
        m.box(8.6, 8.9, -0.9, 0.9, 3.0, 3.2, "Amber")
    m.done("RecoveryTruck")


def build() -> None:
    team_camp()
    timing_hut()
    timing_post()
    km_board()
    marker()
    viewing_area()
    recovery_truck()


def preview(path: Path) -> None:
    """Lay the pieces by a stretch of course as the replay would, and shoot it from behind a car."""
    scene = bpy.context.scene
    o = {ob.name: ob for ob in scene.objects}
    half = ROAD / 2
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new(p) for p in ((-200, -300, 0), (800, -300, 0), (800, 300, 0), (-200, 300, 0))])
    me = bpy.data.meshes.new("Salt")
    bm.to_mesh(me)
    sm = bpy.data.materials.new("SaltMat")
    sm.use_nodes = True
    sm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb("ECE8DE")
    me.materials.append(sm)
    scene.collection.objects.link(bpy.data.objects.new("Salt", me))
    o["TeamCamp"].location = (10, half + 30, 0)
    o["TimingHut"].location = (120, half + 18, 0)
    o["TimingPost"].location = (130, half + 2, 0)
    o["KmBoard"].location = (100, half + 6, 0)
    o["ViewingArea"].location = (200, half + 50, 0)
    o["RecoveryTruck"].location = (300, -(half + 20), 0)
    o["Marker"].location = (60, half + 1, 0)
    for k in range(1, 12):
        for side in (-1, 1):
            c = o["Marker"].copy()
            c.location = (60 + k * 25, side * (half + 1), 0)
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
    cam_obj.location = (-20, -4, 6)
    scene.collection.objects.link(cam_obj)
    cam_obj.rotation_euler = (Vector((60, 8, 0)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


run(OUT, PREVIEW, build, preview)
