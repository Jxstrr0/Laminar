"""
The circuit's trackside (PR 13m), built headless in Blender from numbers.
Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/circuit/build.py -- [--preview]

Writes public/models/circuit.glb and public/models/models.json (the hash of
every art script), and with --preview also art/circuit/preview.jpg.

The track stays in code: each circuit's lap comes from its corners and
straights (src/data/circuits.ts), so a model of one lap would fit no other.
These are the pieces the replay stands along whichever lap is raced
(src/render/replayScene.ts), each at its own origin, built along +x (the way
the cars drive), with the track's side on −y here (+z in the game, its
right):

- StartGantry: the gantry over the start line, its start lights facing the grid.
- GridLine: the chequered line across the 12 m road.
- PitBuilding: 150 m of garages, their doors and the pit wall facing the track.
- Grandstand: 100 m of stand, rising away from the track, with a roof.
- Footbridge: a bridge over the track on two stair towers.
- Barrier: one 4 m length of steel barrier on posts.
- Kerb: one 2 m length of kerb, red then white.
- MarshalPost: a marshals' hut with its flag pole.

The game's axes (three.js): +x along, y up, z to the right. Blender is z-up,
so here x is the same, y is three.js −z (the left) and z is up; the glTF
exporter turns it round. Every piece keeps its daylight colours.

PR 13at polished it with the shared venue blocks (art/venuelib.py): round
pillars and a lap board on the gantry, grid slots behind the line, roller
doors and team boards on the garages, race control's tower, a paddock of
transporters and trees behind the pits, the pit wall's stands, a stand with
aisles, a screen and a curved roof, an arched footbridge, a W-profile
barrier, a ridged kerb and a marshals' hut with a sloping roof.
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
from venuelib import Mesh, lorry_cab, rounded, run, srgb, tree, wheel  # noqa: E402

OUT = ROOT / "public" / "models" / "circuit.glb"
PREVIEW = ROOT / "art" / "circuit" / "preview.jpg"

# The road: REPLAY_SCENE.car.roadWidth in src/data/replay.ts.
ROAD = 12.0

venuelib.COLOURS.update({
    "Concrete": "C9CFD6",
    "Wall": "EEF0F5",
    "Door": "3E4A7A",
    "DoorAlt": "4F5BD5",
    "Slat": "34406B",
    "Glass": "2C3560",
    "Roof": "5D6873",
    "Steel": "5D6873",
    "Rail": "B9C0C8",
    "Seats": "3E4A7A",
    "SeatsAlt": "4A5788",
    "Stair": "B9C0C8",
    "Red": "D23B2F",
    "White": "F4F4F2",
    "Black": "1D242B",
    "Lamp": "FF5A4E",
    "Screen": "141A33",
    "Accent": "2E9E95",
    "Hut": "E3A23B",
    "Flag": "F2C94C",
    "Team1": "E0695D",
    "Team2": "2E9E95",
    "Team3": "A88BE0",
    "Team4": "E3A23B",
    "Body": "E9ECF2",
    "Cab": "3E4A7A",
    "Asphalt": "7D848C",
})
TEAMS = ("Team1", "Team2", "Team3", "Team4", "DoorAlt")


def start_gantry() -> None:
    """Two round pillars either side of the road and a beam across, five pairs of start lights facing back down the grid (−x), a lap board on top and a camera at each end."""
    m = Mesh()
    half = ROAD / 2 + 2.0
    for y in (-half, half):
        m.cyl((0, y, 0), (0, y, 7.6), 0.45, "Steel", 12)
        m.cyl((0, y, 0), (0, y, 0.5), 0.8, "Concrete", 12)
    m.box(-0.6, 0.6, -half - 0.4, half + 0.4, 6.2, 7.6, "Black")
    for k in range(5):
        y = -3.2 + k * 1.6
        for z in (6.5, 7.15):
            m.box(-0.66, -0.6, y - 0.28, y + 0.28, z, z + 0.4, "Lamp")
    # A teal band along the top, and the lap board standing on it, its screen to the grid.
    m.box(-0.62, 0.62, -half - 0.4, half + 0.4, 7.6, 7.85, "Accent")
    m.box(-0.3, 0.3, -3.0, 3.0, 7.85, 9.6, "Black")
    m.box(-0.32, -0.3, -2.8, 2.8, 8.05, 9.4, "Screen")
    for y in (-half, half):
        m.box(-0.4, 0.4, y - 0.3, y + 0.3, 7.85, 8.3, "Steel")
        m.box(-0.9, -0.4, y - 0.15, y + 0.15, 7.95, 8.2, "Black")
    m.done("StartGantry")


def grid_line() -> None:
    """The chequered line across the road, a metre deep, a hair above the tarmac, and the first grid slots behind it, staggered."""
    m = Mesh()
    sq = 0.5
    n = int(ROAD / sq)
    # A white strip with the black squares on it, a hair higher.
    m.box(0, 2 * sq, -ROAD / 2, ROAD / 2, 0, 0.012, "White")
    for i in range(n):
        for j in range(2):
            if (i + j) % 2:
                y = -ROAD / 2 + i * sq
                m.box(j * sq, (j + 1) * sq, y, y + sq, 0, 0.014, "Black")
    # Grid slots: an open white bracket for each car, alternating sides, 8 m apart.
    for k in range(4):
        x = -6 - k * 8
        yc = 2.6 if k % 2 == 0 else -2.6
        m.box(x - 0.2, x, yc - 1.4, yc + 1.4, 0, 0.012, "White")
        for s in (-1, 1):
            m.box(x - 1.6, x, yc + s * 1.4 - 0.1, yc + s * 1.4 + 0.1, 0, 0.012, "White")
    m.done("GridLine")


def transporter(m: Mesh, x0: float, colour: str) -> None:
    """A team's transporter along +x from x0, centred on y = 0: a rounded box trailer with a team band, and the tractor unit."""
    rings = [[(x, cy, 2.7 + cz) for cy, cz in rounded(2.6, 3.0, 0.12, 2)] for x in (x0, x0 + 13.4)]
    m.loft(rings, "Body")
    for s in (-1, 1):
        m.box(x0 + 0.2, x0 + 13.2, s * 1.31 - 0.01, s * 1.31 + 0.01, 2.0, 2.8, colour)
    m.box(x0 + 0.6, x0 + 14.6, -1.1, 1.1, 0.5, 1.2, "Black")
    for wx in (x0 + 1.2, x0 + 2.4, x0 + 14.0):
        for s in (-1, 1):
            wheel(m, wx, s * 1.0, 0.5, 0.36)
    lorry_cab(m, x0 + 13.8, 2.5, 3.6, colour, 2.6)


def pit_building() -> None:
    """150 m of garages with the track on −y: the pit wall and its stands at the front, roller doors under team boards, a glazed upper floor, a roof terrace, race control's tower at the far end, and the paddock behind with transporters and trees."""
    m = Mesh()
    length = 150.0
    # The building's front is at y = 0; the pit wall stands 8 m in front of it, by the track.
    m.box(0, length, 0, 14, 0, 8, "Wall")
    m.box(-0.5, length + 0.5, -1.5, 14.5, 8.0, 8.3, "Roof")
    n = 15
    bay = length / n
    for k in range(n):
        x = k * bay + 1.0
        m.box(x, x + bay - 2.0, -0.05, 0.0, 0.2, 4.2, "Door")
        m.box(x - 0.6, x + bay - 1.4, -0.3, 0.0, 4.5, 5.0, TEAMS[(k // 3) % len(TEAMS)])
    for r in range(1, 7):
        m.box(1.0, length - 1.0, -0.09, -0.05, 0.2 + r * 0.6 - 0.04, 0.2 + r * 0.6, "Slat")
    m.box(0.5, length - 0.5, -0.05, 0.0, 5.2, 7.2, "Glass")
    for k in range(1, n):
        m.box(k * bay - 0.1, k * bay + 0.1, -0.1, -0.05, 5.2, 7.2, "Steel")
    # The roof terrace's rail and its sunshades.
    m.box(0, length, -1.5, -1.4, 8.3, 9.3, "Rail")
    for k in range(6):
        x = 12 + k * 22
        m.cyl((x, 4, 8.3), (x, 4, 10.6), 0.04, "Steel", 6)
        m.cyl((x, 4, 10.2), (x, 4, 10.7), 1.8, "Accent" if k % 2 else "White", 8, rb=0.05)
    # Race control: a tower at the far end with a wraparound window and the timing screen to the track.
    m.box(length + 0.5, length + 9.5, 0, 9, 0, 16, "Wall")
    m.box(length + 0.4, length + 9.6, -0.1, 9.1, 11, 14.5, "Glass")
    m.box(length, length + 10, -0.6, 9.6, 16, 16.5, "Roof")
    m.box(length + 1.5, length + 8.5, -0.25, -0.1, 5.0, 9.5, "Screen")
    m.box(length + 1.3, length + 8.7, -0.15, -0.05, 4.8, 9.7, "Black")
    # The pit wall: a low concrete wall with a fence on top, and team stands roofed against the sun.
    m.box(0, length, -8.4, -8.0, 0, 1.0, "Concrete")
    m.box(0, length, -8.25, -8.15, 1.0, 3.0, "Rail")
    for k in range(5):
        x = 10 + k * 30
        m.box(x, x + 5, -7.8, -6.6, 0, 1.2, "Black")
        m.box(x + 0.2, x + 4.8, -7.9, -7.8, 0.6, 1.1, "Screen")
        for px in (x + 0.2, x + 4.8):
            m.cyl((px, -6.8, 1.2), (px, -6.8, 3.4), 0.05, "Steel", 6)
        m.box(x - 0.3, x + 5.3, -8.3, -6.4, 3.4, 3.5, TEAMS[k % len(TEAMS)])
    # The paddock behind: tarmac, the teams' transporters backed up to the garages, and trees beyond.
    m.box(0, length, 14, 46, 0, 0.02, "Asphalt")
    for k in range(3):
        with m.at(14 + k * 48, 21 + (k % 2) * 4, 0):
            transporter(m, 0, TEAMS[k * 2])
    for k in range(12):
        tree(m, -6 + k * 14 + (k * 31 % 5), 52 + (k * 17 % 7), 9 + (k * 13 % 5), "pine" if k % 3 == 1 else "round", "LeafDark" if k % 2 else "Leaf")
    m.done("PitBuilding")


def grandstand() -> None:
    """100 m of stand with the track on +y here (the right-hand side of the road): fourteen rows stepping up away from it with stair aisles, a curved roof on raked posts, and a screen at the end."""
    m = Mesh()
    length = 100.0
    row, step = 0.9, 0.5
    rows = 14
    # A concrete front wall, then the rows going back (−y, away from the track).
    m.box(0, length, -0.3, 0, 0, 2.0, "Concrete")
    for r in range(rows):
        y1 = -r * row
        m.box(0, length, y1 - row, y1, 0, 2.0 + r * step, "SeatsAlt" if r % 2 else "Seats")
    back = -rows * row
    # Stair aisles down the rows, every 20 m, and a back wall.
    for x in (0.0, 20.0, 40.0, 60.0, 80.0, 100.0):
        m.loft([[(x - 0.6, 0.0, 2.02), (x + 0.6, 0.0, 2.02)], [(x - 0.6, back, 2.02 + rows * step), (x + 0.6, back, 2.02 + rows * step)]], "Stair", cap_start=False, cap_end=False, closed=False, smooth=False)
    m.box(0, length, back - 0.4, back, 0, 2.0 + rows * step + 1.2, "Concrete")
    # The roof: a curved sheet from high at the back to the front, on raked posts.
    arc = [(back - 1.0 + (2.0 - back + 1.0) * t, 12.0 + 1.6 * math.sin(math.pi * t) - 1.2 * t) for t in (k / 8 for k in range(9))]
    m.loft([[(-1.0, y, z) for y, z in arc], [(length + 1.0, y, z) for y, z in arc]], "Roof", cap_start=False, cap_end=False, closed=False)
    m.loft([[(length + 1.0, y, z - 0.25) for y, z in arc], [(-1.0, y, z - 0.25) for y, z in arc]], "Roof", cap_start=False, cap_end=False, closed=False)
    m.box(-1.0, length + 1.0, 1.85, 2.05, 10.4, 10.9, "Accent")
    for x in (0.0, 25.0, 50.0, 75.0, 100.0):
        m.cyl((x, back - 0.2, 0), (x, back - 0.2, 12.4), 0.25, "Steel", 8)
        m.cyl((x, back - 0.2, 9.0), (x, -4.0, 12.6), 0.12, "Steel", 6)
    # The big screen at the far end, angled to the stand.
    with m.at(length + 6, -4, 0, 0.5):
        m.box(-0.3, 0.3, -0.3, 0.3, 0, 7, "Steel")
        m.box(-0.4, 0.4, -4, 4, 7, 11.5, "Black")
        m.box(0.4, 0.42, -3.8, 3.8, 7.2, 11.3, "Screen")
    m.done("Grandstand")


def footbridge() -> None:
    """A bridge over the track: a gently arched deck 6.5 m up with glazed sides under a teal fascia, and a stair tower each side."""
    m = Mesh()
    half = ROAD / 2 + 7.0
    ys = [-half + 2 * half * k / 10 for k in range(11)]
    lift = lambda y: 0.8 * (1 - (y / half) ** 2)
    for x0, x1, z0, z1, name in ((-2.0, 2.0, 6.5, 7.0, "Concrete"), (-2.1, 2.1, 8.4, 8.6, "Roof")):
        m.loft([[(x0, y, z0 + lift(y)), (x1, y, z0 + lift(y)), (x1, y, z1 + lift(y)), (x0, y, z1 + lift(y))] for y in ys], name, smooth=False)
    for x in (-2.0, 1.95):
        m.loft([[(x, y, 7.0 + lift(y)), (x + 0.05, y, 7.0 + lift(y)), (x + 0.05, y, 8.4 + lift(y)), (x, y, 8.4 + lift(y))] for y in ys], "Glass", smooth=False)
        m.loft([[(x - 0.02, y, 8.0 + lift(y)), (x + 0.07, y, 8.0 + lift(y)), (x + 0.07, y, 8.4 + lift(y)), (x - 0.02, y, 8.4 + lift(y))] for y in ys], "Accent", smooth=False)
    for y in (-half - 2.5, half + 2.5):
        m.box(-2.5, 2.5, y - 2.5, y + 2.5, 0, 8.6, "Wall")
        m.box(-2.6, 2.6, y - 2.6, y + 2.6, 8.6, 9.0, "Roof")
        m.box(-2.52, 2.52, y - 1.2, y + 1.2, 1.0, 7.6, "Glass")
    m.done("Footbridge")


def barrier() -> None:
    """One 4 m length of steel barrier: a W-profile rail on two round posts."""
    m = Mesh()
    for x in (0.0, 2.0):
        m.cyl((x + 0.06, 0.08, 0), (x + 0.06, 0.08, 0.9), 0.06, "Steel", 6)
    # The rail's W section, bulging twice towards the track (−y).
    w = [(0.0, 0.42), (-0.08, 0.48), (-0.08, 0.56), (0.0, 0.62), (-0.08, 0.68), (-0.08, 0.76), (0.0, 0.82)]
    m.loft([[(x, y, z) for y, z in w] for x in (0.0, 4.0)], "Rail", cap_start=False, cap_end=False, closed=False, smooth=False)
    m.done("Barrier")


def kerb() -> None:
    """One 2 m length of kerb, a metre wide, red then white, ridged and sloping up to its outer edge."""
    m = Mesh()
    for x0, colour in ((0.0, "Red"), (1.0, "White")):
        m.loft([[(x0, -0.5, 0.0), (x0, -0.15, 0.05), (x0, 0.2, 0.07), (x0, 0.5, 0.09), (x0, 0.5, 0.0)], [(x0 + 1.0, -0.5, 0.0), (x0 + 1.0, -0.15, 0.05), (x0 + 1.0, 0.2, 0.07), (x0 + 1.0, 0.5, 0.09), (x0 + 1.0, 0.5, 0.0)]], colour, smooth=False)
    m.done("Kerb")


def marshal_post() -> None:
    """A marshals' hut on a low platform: a sloping roof, a window to the track (−y), steps, an extinguisher and a flag pole."""
    m = Mesh()
    m.box(-1.6, 1.6, -1.2, 1.2, 0, 0.4, "Concrete")
    m.box(-1.2, 1.2, -0.9, 0.9, 0.4, 2.8, "Hut")
    m.prism([(-1.4, -1.25), (1.4, -1.25), (1.4, 1.1), (-1.4, 1.1)], 0, 0.1, "Roof")
    with m.at(0, 0, 2.8):
        m.loft([[(-1.4, -1.25, 0.25), (1.4, -1.25, 0.25), (1.4, 1.1, 0.0), (-1.4, 1.1, 0.0)], [(-1.4, -1.25, 0.37), (1.4, -1.25, 0.37), (1.4, 1.1, 0.12), (-1.4, 1.1, 0.12)]], "Roof", smooth=False)
    m.box(-1.0, 1.0, -0.92, -0.9, 1.4, 2.4, "Glass")
    for k in range(2):
        m.box(-0.6, 0.6, 1.2 + k * 0.3, 1.5 + k * 0.3, 0, 0.27 - k * 0.13, "Concrete")
    m.cyl((-1.35, -1.0, 0.4), (-1.35, -1.0, 0.95), 0.1, "Red", 8)
    m.cyl((1.45, -0.95, 0.4), (1.45, -0.95, 4.5), 0.05, "Steel", 6)
    m.box(1.5, 2.5, -0.97, -0.93, 3.7, 4.4, "Flag")
    m.done("MarshalPost")


def build() -> None:
    start_gantry()
    grid_line()
    pit_building()
    grandstand()
    footbridge()
    barrier()
    kerb()
    marshal_post()


def preview(path: Path) -> None:
    """Lay the pieces along a straight as the replay would, and shoot it from behind the grid."""
    scene = bpy.context.scene
    o = {ob.name: ob for ob in scene.objects}
    half = ROAD / 2
    # Road and grass for the preview only.
    bm = bmesh.new()
    for (y0, y1, colour) in ((-60, -half, "8FA37E"), (-half, half, "6B737A"), (half, 60, "8FA37E")):
        f = bm.faces.new([bm.verts.new(p) for p in ((-80, y0, 0), (260, y0, 0), (260, y1, 0), (-80, y1, 0))])
        f.material_index = 0 if colour == "8FA37E" else 1
    me = bpy.data.meshes.new("Ground")
    bm.to_mesh(me)
    for colour in ("8FA37E", "6B737A"):
        gm = bpy.data.materials.new(colour)
        gm.use_nodes = True
        gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb(colour)
        me.materials.append(gm)
    ground = bpy.data.objects.new("Ground", me)
    scene.collection.objects.link(ground)
    o["PitBuilding"].location = (20, half + 10, 0)
    o["Grandstand"].location = (30, -(half + 12), 0)
    o["Footbridge"].location = (200, 0, 0)
    for k in range(40):
        for side in (-1, 1):
            b = o["Barrier"].copy()
            b.location = (-60 + k * 4 + (0 if side < 0 else 0), side * (half + 3), 0)
            scene.collection.objects.link(b)
    o["Barrier"].location = (-1000, 0, 0)
    o["Kerb"].location = (-1000, 0, 0)
    o["MarshalPost"].location = (120, -(half + 6), 0)

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
    cam_obj.location = (-14, -2, 4)
    scene.collection.objects.link(cam_obj)
    cam_obj.rotation_euler = (Vector((40, 0, 1)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


run(OUT, PREVIEW, build, preview)
