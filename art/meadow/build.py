"""
The Lugovoy meadow's kit (PR 13v), built headless in Blender from numbers:
the drone club's field round the quads' gate course. Nobody opens the
Blender UI.

    ~/blender/blender --background --factory-startup --python art/meadow/build.py -- [--preview]

Writes public/models/meadow.glb and public/models/models.json (the hash of
every art script), and with --preview also art/meadow/preview.jpg.

The mown line and the gates stay in code (src/render/replayScene.ts), from
the course and DRONE_SCENE. These are the pieces the quad replay stands round
them, each at its own origin, built along +x (the way the quads fly). Pieces
beside the line face it across −y here (the line on their right as you
come); the scene puts them on its left, and turns them round for its right:

- TreeRound, TreePine, TreeBirch: the trees round the meadow (as the open road's).
- HayBale: a round bale on its side, cushioning the outside of a turn.
- Bunting: 12 m of pennants on a line between two poles.
- StartPads: the two launch pads across the line at the start, one each side.
- PilotTent: the pilots' gazebo: a canopy, a table, two pilots in goggles and the race screen.
- TimingTower: a scaffold tower with the lap board, facing the line.
- Spectators: 16 m of folding chairs and people watching.
- ClubHut: the club's wooden hut, its sign, a windsock (limp: races fly in still air) and three parked cars.

The game's axes (three.js): +x along, y up, z to the right. Blender is z-up,
so here x is the same, y is three.js −z (the left) and z is up; the glTF
exporter turns it round. Every piece keeps its daylight colours.

PR 13au polished it with the shared venue blocks (art/venuelib.py): round
people on proper folding chairs, a braced scaffold tower with a ladder and
lap board, a pilots' gazebo with a valance, goggles and a charging case,
roped bunting, a plank club hut with a veranda, and real cars.
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
from venuelib import Mesh, car, chair, person, run, srgb  # noqa: E402

OUT = ROOT / "public" / "models" / "meadow.glb"
PREVIEW = ROOT / "art" / "meadow" / "preview.jpg"

# The mown line: DRONE_SCENE.roadWidth in src/data/replay.ts; the quads race
# FLY metres over it (DRONE_SCENE.flyHeight), through gates drawn in code.
LINE = 3.0
FLY = 1.5

venuelib.COLOURS.update({
    "White": "F4F4F2",
    "Wall": "E9E2D6",
    "Wall2": "D8DCE6",
    "Roof": "8C4A3F",
    "Roof2": "4A5878",
    "Barn": "A8473C",
    "Steel": "5D6873",
    "Silver": "B9C0C8",
    "Glass": "2C3560",
    "Black": "1D242B",
    "Tyre": "1D242B",
    "Bark": "6B5A4E",
    "Birch": "E9E6DF",
    "Leaf": "7A9474",
    "Leaf2": "8FA27A",
    "Pine": "4E6662",
    "Wood": "A3896B",
    "Coral": "E0695D",
    "Amber": "E3A23B",
    "SignBlue": "2F5BB7",
    "Teal": "2E9E95",
    "Lilac": "A88BE0",
    "Cab": "3E4A7A",
    "Concrete": "C9C6BF",
    "Shirt1": "4F5BD5",
    "Shirt2": "E0695D",
    "Shirt3": "E3A23B",
    "Shirt4": "2E9E95",
    "Skin": "D9A88B",
    "Hay": "D9B86A",
    "Hay2": "C4A257",
    "Canvas": "F2EFE8",
    "Screen": "3D5BFF",
    "Grass": "9DB08A",
    "Hub": "B9C0C8",
    "Trunk": "6B5A4E",
    "Plank": "8E7558",
})


# --- Trees: a few draws each, many copies, so kept to a few dozen faces.


def tree_round() -> None:
    m = Mesh()
    m.cone(0, 0, 0, 3.2, 0.22, 0.16, 6, "Bark")
    m.blob(0, 0, 4.6, 2.6, 2.6, 2.2, "Leaf")
    m.blob(0.6, 0.3, 6.3, 1.7, 1.7, 1.5, "Leaf")
    m.done("TreeRound")


def tree_pine() -> None:
    m = Mesh()
    m.cone(0, 0, 0, 1.6, 0.2, 0.18, 5, "Bark")
    for k, (z0, r) in enumerate(((1.4, 2.4), (3.4, 1.9), (5.2, 1.3))):
        m.cone(0, 0, z0, z0 + 2.8 - 0.4 * k, r, 0.05, 7, "Pine")
    m.done("TreePine")


def tree_birch() -> None:
    m = Mesh()
    m.cone(0, 0, 0, 5.0, 0.14, 0.09, 5, "Birch")
    for z in (1.4, 2.6, 3.7):
        m.cone(0, 0, z, z + 0.12, 0.145, 0.14, 5, "Black")
    m.blob(0, 0, 6.0, 1.3, 1.3, 2.4, "Leaf2")
    m.done("TreeBirch")


# --- The meadow's pieces.


def hay_bale() -> None:
    """A round bale on its side, its flat faces along the line, the net wrap showing as two darker bands."""
    m = Mesh()
    m.drum(0, 0.6, 0.7, 0.7, 1.2, 14, "Hay")
    for y in (0.3, 0.9):
        m.drum(0, y, 0.7, 0.715, 0.12, 14, "Hay2")
    m.done("HayBale")


def bunting() -> None:
    """Two white poles 12 m apart, guyed, and a line of pennants sagging between them, colours in turn."""
    m = Mesh()
    for x, s in ((0, -1), (12, 1)):
        m.cone(x, 0, 0, 3.0, 0.05, 0.04, 6, "White")
        m.cone(x, 0, 3.0, 3.08, 0.06, 0.02, 6, "Coral")
        m.rod((x, 0, 2.9), (x + s * 1.4, 0, 0), 0.008, "Steel")

    def sag(x: float) -> float:
        # Lowest midway between the poles.
        return 2.9 - 0.5 * (1 - ((x - 6) / 6) ** 2)

    for k in range(8):
        m.rod((k * 1.5, 0, sag(k * 1.5)), ((k + 1) * 1.5, 0, sag((k + 1) * 1.5)), 0.01, "White", 3)
    colours = ("Coral", "Amber", "Teal", "Lilac", "SignBlue")
    for k in range(16):
        x0 = 0.35 + k * 0.72
        z0, z1 = sag(x0), sag(x0 + 0.5)
        m.poly([(x0, 0, z0), (x0 + 0.5, 0, z1), (x0 + 0.25, 0, (z0 + z1) / 2 - 0.45)], colours[k % 5])
    m.done("Bunting")


def start_pads() -> None:
    """Two launch pads across the line at the start, one in each quad's lane (±0.3 m), with a white start line between."""
    m = Mesh()
    for y in (-0.3, 0.3):
        c = y - 0.02 if y < 0 else y + 0.02
        octagon = [(0.25 * math.cos(math.pi / 8 + k * math.pi / 4), c + 0.25 * math.sin(math.pi / 8 + k * math.pi / 4)) for k in range(8)]
        m.prism(octagon, 0, 0.03, "Black")
        m.poly([(x * 0.6, c + (yy - c) * 0.6, 0.031) for x, yy in octagon], "Coral" if y > 0 else "Teal")
        m.flat(-0.03, 0.03, c - 0.08, c + 0.08, 0.032, "White")
    m.flat(0.3, 0.42, -LINE / 2, LINE / 2, 0.02, "White")
    m.done("StartPads")


def pilot_tent() -> None:
    """The pilots' gazebo, its open front to the line (−y): four legs, a peaked canopy with a valance, a table, two seated pilots in goggles with their controllers, the race screen and a charging case."""
    m = Mesh()
    for x in (0, 4):
        for y in (0, 3):
            m.box(x - 0.04, x + 0.04, y - 0.04, y + 0.04, 0, 2.2, "Silver")
            m.box(x - 0.12, x + 0.12, y - 0.12, y + 0.12, 0, 0.03, "Steel")
    # The valance round the edge, then the canopy rising to a point.
    m.prism([(-0.1, -0.1), (4.1, -0.1), (4.1, 3.1), (-0.1, 3.1)], 2.2, 2.45, "Teal")
    eave = [(-0.1, -0.1, 2.45), (4.1, -0.1, 2.45), (4.1, 3.1, 2.45), (-0.1, 3.1, 2.45)]
    for k in range(4):
        m.poly([eave[k], eave[(k + 1) % 4], (2, 1.5, 3.3)], "Canvas")
    for k in range(4):
        m.box(0.4 + k * 0.9, 0.9 + k * 0.9, -0.12, -0.1, 2.27, 2.4, "White")
    m.box(0.5, 3.5, 0.5, 1.2, 0.72, 0.76, "White")
    for x in (0.55, 3.45):
        for y in (0.55, 1.15):
            m.rod((x, y, 0), (x, y, 0.72), 0.02, "Steel")
    for x, shirt in ((1.3, "Shirt1"), (2.7, "Shirt2")):
        chair(m, x, 1.75, "Black")
        person(m, x, 1.75, shirt, sitting=True)
        # Goggles strapped on, and the controller in their lap.
        m.box(x - 0.14, x + 0.14, 1.52, 1.66, 1.2, 1.32, "Black")
        m.box(x - 0.16, x + 0.16, 1.42, 1.58, 0.82, 0.88, "Black")
    # A laptop with the lap times, and the battery case charging under the table.
    m.box(1.8, 2.2, 0.75, 1.05, 0.76, 0.78, "Silver")
    m.poly([(1.8, 0.75, 0.78), (2.2, 0.75, 0.78), (2.2, 0.68, 1.06), (1.8, 0.68, 1.06)], "Screen")
    m.box(2.6, 3.3, 0.6, 1.0, 0, 0.35, "Amber")
    m.box(2.6, 3.3, 0.6, 1.0, 0.35, 0.37, "Black")
    # The race screen on its stand at the tent's side, facing the line.
    m.box(4.4, 4.5, 1.0, 1.1, 0, 1.6, "Steel")
    m.box(4.1, 4.8, 0.8, 1.3, 0, 0.04, "Steel")
    m.box(3.9, 5.0, 0.98, 1.06, 1.4, 2.1, "Black")
    m.box(3.95, 4.95, 0.96, 0.98, 1.45, 2.05, "Screen")
    m.done("PilotTent")


def timing_tower() -> None:
    """A scaffold tower beside the line with the lap board on top, facing the line (−y), braced, with a ladder and a chequered flag."""
    m = Mesh()
    for x in (0, 1.2):
        for y in (0.2, 1.4):
            m.cone(x, y, 0, 3.4, 0.03, 0.03, 6, "Silver")
            m.box(x - 0.1, x + 0.1, y - 0.1, y + 0.1, 0, 0.03, "Steel")
    for z in (1.1, 2.2, 3.3):
        m.box(-0.05, 1.25, 0.15, 1.45, z, z + 0.05, "Wood")
        for y in (0.2, 1.4):
            m.rod((0, y, z + 0.9), (1.2, y, z + 0.9), 0.02, "Silver")
    # Diagonal braces on the back and sides, alternating.
    for k, (z0, z1) in enumerate(((0.1, 1.1), (1.1, 2.2), (2.2, 3.3))):
        a, b = (0, 1.2) if k % 2 else (1.2, 0)
        m.rod((a, 1.4, z0), (b, 1.4, z1), 0.02, "Silver")
        for x in (0, 1.2):
            m.rod((x, 0.2 if k % 2 else 1.4, z0), (x, 1.4 if k % 2 else 0.2, z1), 0.02, "Silver")
    # The ladder up the side away from the line.
    for y in (0.6, 1.0):
        m.rod((1.32, y, 0), (1.32, y, 3.35), 0.02, "Steel")
    for k in range(11):
        m.rod((1.32, 0.6, 0.3 + k * 0.3), (1.32, 1.0, 0.3 + k * 0.3), 0.015, "Steel")
    # The lap board: three amber digits.
    m.box(-0.4, 1.6, 0.1, 0.25, 3.4, 4.4, "Black")
    for k in range(3):
        m.box(-0.2 + k * 0.6, 0.15 + k * 0.6, 0.08, 0.1, 3.6, 4.2, "Amber")
    m.cone(1.58, 0.82, 3.4, 5.2, 0.025, 0.025, 5, "Steel")
    for i in range(4):
        for j in range(3):
            m.box(1.6, 1.62, 0.85 + i * 0.2, 1.05 + i * 0.2, 4.6 + j * 0.2, 4.8 + j * 0.2, "Black" if (i + j) % 2 else "White")
    m.done("TimingTower")


def spectators() -> None:
    """16 m of folding chairs and people watching, a cool box and a parasol, facing the line (−y)."""
    m = Mesh()
    shirts = ("Shirt1", "Shirt2", "Shirt3", "Shirt4")
    seats = ("Teal", "SignBlue", "Coral")
    for k in range(9):
        x = 0.8 + k * 1.75
        if k % 3 == 2:
            person(m, x, 1.9, shirts[(k * 3) % 4], tall=0.95 + 0.05 * (k % 2))
        else:
            chair(m, x, 1.2, seats[k % 3])
            person(m, x, 1.2, shirts[(k * 5) % 4], sitting=True)
    m.box(5.2, 5.8, 0.8, 1.2, 0, 0.36, "Coral")
    m.box(5.18, 5.82, 0.78, 1.22, 0.36, 0.42, "White")
    # A parasol: the pole and an eight-panel canopy.
    m.cone(11, 1.6, 0, 2.3, 0.025, 0.025, 6, "White")
    rim = [(11 + 1.3 * math.cos(k * math.pi / 4), 1.6 + 1.3 * math.sin(k * math.pi / 4), 1.95) for k in range(8)]
    for k in range(8):
        m.poly([rim[k], rim[(k + 1) % 8], (11, 1.6, 2.4)], "Amber" if k % 2 else "White")
    m.done("Spectators")


def club_hut() -> None:
    """The club's plank hut, its door and sign to the line (−y) under a veranda, a windsock hanging limp on its mast, and three parked cars beside."""
    m = Mesh()
    m.box(0, 7, 0, 5, 0, 3, "Wood")
    # Planks: dark lines along the front and sides.
    for z in (0.5, 1.0, 1.5, 2.0, 2.5):
        m.box(-0.02, 7.02, -0.02, 5.02, z, z + 0.04, "Plank")
    m.roof(-0.4, 7.4, -0.4, 5.4, 3, 1.4, "Roof2")
    m.box(-0.3, 7.3, -1.8, 0, 0, 0.2, "Plank")
    for x in (0.1, 3.5, 6.9):
        m.box(x - 0.07, x + 0.07, -1.7, -1.56, 0.2, 2.8, "Wood")
    m.poly([(-0.4, 0, 3.0), (7.4, 0, 3.0), (7.4, -1.9, 2.55), (-0.4, -1.9, 2.55)], "Roof2")
    m.box(3, 4, -0.04, 0, 0.2, 2.1, "Teal")
    m.box(3.75, 3.85, -0.08, -0.04, 1.05, 1.15, "Silver")
    for x0 in (0.8, 4.8):
        m.box(x0 - 0.08, x0 + 1.48, -0.05, 0, 1.12, 2.18, "White")
        m.box(x0, x0 + 1.4, -0.07, -0.05, 1.2, 2.1, "Glass")
        m.box(x0 + 0.67, x0 + 0.73, -0.09, -0.07, 1.2, 2.1, "White")
    m.box(1.5, 5.5, -0.06, -0.03, 3.1, 3.6, "White")
    m.box(2.0, 5.0, -0.08, -0.06, 3.2, 3.5, "Lilac")
    # A bench on the veranda.
    m.box(4.6, 6.4, -1.0, -0.6, 0.62, 0.68, "Wood")
    for x in (4.7, 6.3):
        m.box(x - 0.04, x + 0.04, -0.95, -0.65, 0.2, 0.62, "Wood")
    # The windsock: a mast and a sock drooping, still air, in coral and white bands.
    m.cone(-2, 1, 0, 6, 0.06, 0.05, 6, "White")
    top = Vector((-2, 1, 5.85))
    hang = Vector((math.sin(math.radians(20)), 0, -math.cos(math.radians(20))))
    for k in range(4):
        r0, r1 = 0.25 - 0.035 * k, 0.25 - 0.035 * (k + 1)
        m.cyl(top + hang * (0.35 * k) + Vector((0.12, 0, 0)), top + hang * (0.35 * (k + 1)) + Vector((0.12, 0, 0)), r0, "Coral" if k % 2 == 0 else "White", 8, rb=r1, cap=False)
    m.rod((-2, 1, 5.85), (-1.88, 1, 5.85), 0.02, "Steel")
    # Three cars parked nose to the hut.
    for k, body in enumerate(("Shirt1", "Silver", "Shirt3")):
        with m.at(9.9 + k * 3, 2.5, 0, math.pi / 2):
            car(m, body, 4.0, 1.75)
    m.done("ClubHut")


def build() -> None:
    tree_round()
    tree_pine()
    tree_birch()
    hay_bale()
    bunting()
    start_pads()
    pilot_tent()
    timing_tower()
    spectators()
    club_hut()


def preview(path: Path) -> None:
    """Lay the pieces round a stretch of the mown line as the replay would, and shoot it from behind a quad."""
    scene = bpy.context.scene
    o = {ob.name: ob for ob in scene.objects}
    half = LINE / 2

    def plane(name: str, x0: float, x1: float, y0: float, y1: float, z: float, colour: str) -> None:
        bm = bmesh.new()
        bm.faces.new([bm.verts.new(p) for p in ((x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z))])
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        sm = bpy.data.materials.new(name + "Mat")
        sm.use_nodes = True
        sm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb(colour)
        me.materials.append(sm)
        scene.collection.objects.link(bpy.data.objects.new(name, me))

    plane("Meadow", -200, 300, -200, 200, 0, "B9C7A2")
    plane("Line", -50, 120, -half, half, 0.01, "8FA77E")

    def put(name: str, x: float, y: float, turned: bool = False) -> None:
        c = o[name].copy()
        c.location = (x, y, 0)
        if turned:
            c.rotation_euler = (0, 0, math.pi)
        scene.collection.objects.link(c)

    o["StartPads"].location = (0, 0, 0)
    o["PilotTent"].location = (4, half + 5, 0)
    put("TimingTower", 3, -(half + 2.5), True)
    o["TimingTower"].location = (-1000, 0, 0)
    o["Spectators"].location = (20, half + 4, 0)
    o["ClubHut"].location = (-10, half + 26, 0)
    o["Bunting"].location = (40, half + 2, 0)
    put("Bunting", 64, -(half + 2), True)
    for k in range(6):
        put("HayBale", 70 + k * 2.2, -(half + 2.5 + k * 0.6), True)
    o["HayBale"].location = (-1000, 0, 0)
    names = ("TreeRound", "TreePine", "TreeBirch")
    for k in range(40):
        put(names[(k * 5) % 3], -30 + k * 6, (1 if k % 2 else -1) * (40 + (k * 7) % 15))
    for n in names:
        o[n].location = (-1000, 0, 0)
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
    cam_obj.location = (-6, -1, 3.2)
    scene.collection.objects.link(cam_obj)
    cam_obj.rotation_euler = (Vector((30, 3, 1.2)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


run(OUT, PREVIEW, build, preview)
