"""
The Stavren Ice Oval (PR 13x): the indoor 400 m speed-skating oval the skating
replays race on, built headless in Blender from numbers. Nobody opens the
Blender UI.

    ~/blender/blender --background --factory-startup --python art/iceoval/build.py -- [--preview]

Writes public/models/iceoval.glb and public/models/models.json (the hash of
every art script), and with --preview also art/iceoval/preview.jpg (the
broadcast camera's view) and art/iceoval/preview-close.jpg (down the home
straight).

The oval follows the replay's own lap (OVAL in src/data/briefs.ts): two
112 m straights and two 88 m bends, skated anticlockwise from the head of the
home straight. The replay lays each bend as eight short straight pieces; the
circle through their ends is the one used here, so the skaters stay on the
ice. The ice is flat. Across it, out from the course's centre line: the
warm-up lane, the inner racing lane (where both skaters' lines run), the
outer lane, then the crash pads and the stands. Rubber blocks mark the lane
line through each bend; the back straight is the crossing straight, where
the lane line stops so skaters can change lanes.

The game's axes (three.js): the home straight starts at the origin and runs
along +x, and the oval lies to the left (−z), the way the skaters turn.
Blender is z-up, so here x is the same, y is three.js −z (into the oval) and
z is up; the glTF exporter turns it round.

The hall keeps its daylight colours in both themes, like every field scene.
There is no roof: the broadcast camera looks down from high over the west
bend.
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

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "public" / "models" / "models.json"
OUT = ROOT / "public" / "models" / "iceoval.glb"
PREVIEW = ROOT / "art" / "iceoval" / "preview.jpg"
PREVIEW_CLOSE = ROOT / "art" / "iceoval" / "preview-close.jpg"
# Pinned on purpose, the same as the other art scripts and .github/workflows/art.yml.
BLENDER = "4.5.15"


def input_hash() -> str:
    """Every art script, in path order, hashed: tests/models.test.ts works it out the same way."""
    h = hashlib.sha256()
    for path in sorted((ROOT / "art").rglob("*.py"), key=lambda p: p.relative_to(ROOT).as_posix().encode()):
        h.update(path.read_bytes())
    return h.hexdigest()[:16]


# The lap: the same numbers as OVAL in src/data/briefs.ts.
LAP = 400.0
STRAIGHT = LAP * 0.28
BEND = (LAP - 2 * STRAIGHT) / 2
PIECES = 8
# The circle through the ends of the replay's bend pieces, m.
RADIUS = (BEND / PIECES) / (2 * math.sin(math.pi / (2 * PIECES)))

# Across the ice, metres out from the course's centre line (where the replay
# lays its path; your skater skates 1.1 m out, the old setup 2.5 m: REPLAY_SCENE).
WARMUP = -5.0  # the warm-up lane starts here
INNER = -1.0  # the inner racing lane starts here
LANE_LINE = 3.0  # the line between the racing lanes
OUTER = 7.0  # the outer lane's edge, and the crash pads
PADS = 1.2  # the pads' depth
# The lines painted on the ice, each (from, to) across it: the warm-up lane's edge, the inner lane's edge, the lane line.
LINES = {"Line": [(WARMUP, WARMUP + 0.06), (INNER - 0.06, INNER), (LANE_LINE, LANE_LINE + 0.08)]}
# The rubber lane blocks through each bend: this far apart, m.
BLOCKS = 4.0
# The stands: their front at STANDS_IN, ROWS rows of seats each ROW deep and STEP higher, the first at STANDS_UP; the hall's wall at WALL_OUT.
STANDS_IN, STANDS_UP, ROWS, ROW, STEP = 11.0, 3.2, 10, 1.2, 0.68
WALL_OUT, WALL_UP = 26.0, 14.0

# Colours, sRGB hex. The ice matches the code-drawn oval (src/render/replayScene.ts COLOURS.ice).
COLOURS = {
    "Ice": "E2EDF4",
    "IceAlt": "D9E6EF",
    "Warmup": "CFDDE8",
    "Infield": "C4D2DE",
    "Line": "F7FAFC",
    "LaneLine": "2F5BB7",
    "Red": "D23B2F",
    "BlockA": "E0695D",
    "BlockB": "2E9E95",
    "Pads": "2F5BB7",
    "PadsAlt": "3D6BC6",
    "Black": "1D242B",
    "White": "F4F4F2",
    "Barrier": "EEF0F5",
    "Rail": "5D6873",
    "Concrete": "B9C0C8",
    "Seats": "2F7F86",
    "SeatsAlt": "358C93",
    "Riser": "234E5A",
    "HallWall": "D7DBE6",
    "Desk": "E9ECF2",
    "Steel": "5D6873",
    "Kick": "E3A23B",
    "Resurfacer": "4F5BD5",
    "Glass": "2C3560",
    "PenCoral": "E0695D",
    "PenTeal": "2E9E95",
    "PenIndigo": "4F5BD5",
    "PenAmber": "E3A23B",
    "Gold": "D9B44A",
    "Silver": "B9C0C8",
    "Bronze": "B9784A",
    "Screen": "3D5BFF",
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
        MATS[name] = m
    return MATS[name]


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
    """A point on the centre line, the way out of the oval there, what's painted across from it to the next, and whether it's on the crossing straight or a bend."""

    def __init__(self, x: float, y: float, nx: float, ny: float, paint: str | None = None, cross: bool = False, bend: bool = False) -> None:
        self.x, self.y, self.nx, self.ny, self.paint, self.cross, self.bend = x, y, nx, ny, paint, cross, bend

    def at(self, d: float, z: float) -> tuple[float, float, float]:
        return (self.x + self.nx * d, self.y + self.ny * d, z)


def stations(straight_step: float, bend_steps: int, marks: bool) -> list[Station]:
    """Round the lap anticlockwise from the head of the home straight; with `marks`, the finish line gets its own band."""
    out: list[Station] = []
    # The home straight, along +x; outside is −y. The finish line is at its head, where the replay's lap starts.
    bands = [(0.0, 0.3, "Red")] if marks else []
    xs = {round(straight_step * i, 4) for i in range(int(STRAIGHT / straight_step))}
    xs = {x for x in xs if not any(lo < x < hi for lo, hi, _ in bands)} | {e for lo, hi, _ in bands for e in (lo, hi)}
    for x in sorted(xs):
        paint = next((n for lo, hi, n in bands if lo <= x < hi), None)
        out.append(Station(x, 0.0, 0.0, -1.0, paint))
    # The first bend, round (STRAIGHT, RADIUS).
    for k in range(bend_steps):
        a = -math.pi / 2 + math.pi * k / bend_steps
        out.append(Station(STRAIGHT + RADIUS * math.cos(a), RADIUS + RADIUS * math.sin(a), math.cos(a), math.sin(a), bend=True))
    # The back straight, along −x; outside is +y. It's the crossing straight.
    for i in range(int(STRAIGHT / straight_step)):
        out.append(Station(STRAIGHT - straight_step * i, 2 * RADIUS, 0.0, 1.0, cross=True))
    # The second bend, round (0, RADIUS).
    for k in range(bend_steps):
        a = math.pi / 2 + math.pi * k / bend_steps
        out.append(Station(RADIUS * math.cos(a), RADIUS + RADIUS * math.sin(a), math.cos(a), math.sin(a), bend=True))
    return out


def ice_profile(cross: bool) -> list[tuple[float, str]]:
    """The breaks across the ice, each with the colour from it to the next: the warm-up lane, the inner lane and the outer lane, with the lines between (no lane line on the crossing straight)."""
    lines = sorted(LINES["Line"])
    cuts: list[tuple[float, str]] = []
    zones = [(WARMUP, INNER, "Warmup"), (INNER, LANE_LINE, "Ice"), (LANE_LINE, OUTER, "IceAlt")]
    for lo, hi, colour in zones:
        d = lo
        for a, b in lines:
            if lo - 1e-6 <= a < hi:
                if a > d:
                    cuts.append((d, colour))
                is_lane = abs(a - LANE_LINE) < 1e-6
                cuts.append((a, ("IceAlt" if cross else "LaneLine") if is_lane else "Line"))
                d = b
        cuts.append((d, colour))
    cuts.append((OUTER, ""))
    # Drop zero-width pieces where a line ends exactly on a zone's edge.
    return [c for i, c in enumerate(cuts) if i == len(cuts) - 1 or cuts[i + 1][0] - c[0] > 1e-6]


def build_ice() -> None:
    """The racing ice, swept round the lap, with the finish line across the racing lanes, and the infield floor inside the warm-up lane."""
    m = Mesh()
    st = stations(4.0, 36, True)
    n = len(st)
    for i in range(n):
        a, b = st[i], st[(i + 1) % n]
        prof = ice_profile(a.cross and b.cross)
        for k in range(len(prof) - 1):
            d0, name = prof[k]
            d1 = prof[k + 1][0]
            if a.paint and d0 >= INNER - 1e-6:
                name = a.paint
            m.quad([a.at(d0, 0), b.at(d0, 0), b.at(d1, 0), a.at(d1, 0)], name, up=True)
    # Everything inside the warm-up lane: one floor (the oval is convex, so a single face holds).
    m.quad([s.at(WARMUP, 0) for s in st], "Infield", up=True)
    m.done("Ice")


def build_blocks() -> None:
    """Rubber blocks along the lane line and the inner lane's edge through each bend, in two colours by turns."""
    m = Mesh()
    for cx, start in ((STRAIGHT, -math.pi / 2), (0.0, math.pi / 2)):
        for d, colour in ((LANE_LINE, "BlockA"), (INNER, "BlockB")):
            r = RADIUS + d
            count = int(math.pi * r / BLOCKS)
            for k in range(count + 1):
                a = start + math.pi * k / count
                x, y = cx + r * math.cos(a), RADIUS + r * math.sin(a)
                m.box((x, y, 0.05), (0.22, 0.22, 0.1), colour if k % 2 else "White")
    m.done("Blocks")


def build_pads() -> None:
    """The crash pads round the outside of the outer lane, blue in two tones, then the concourse floor to the stands."""
    m = Mesh()
    st = stations(4.0, 36, False)
    n = len(st)
    h = 0.9
    for i in range(n):
        a, b = st[i], st[(i + 1) % n]
        tone = "PadsAlt" if i % 2 else "Pads"
        m.quad([a.at(OUTER, 0), b.at(OUTER, 0), b.at(OUTER, h), a.at(OUTER, h)], tone)
        m.quad([a.at(OUTER, h), b.at(OUTER, h), b.at(OUTER + PADS, h), a.at(OUTER + PADS, h)], tone, up=True)
        m.quad([a.at(OUTER + PADS, 0), b.at(OUTER + PADS, 0), b.at(OUTER + PADS, h + 0.3), a.at(OUTER + PADS, h + 0.3)], "Barrier")
        m.quad([a.at(OUTER + PADS, 0), b.at(OUTER + PADS, 0), b.at(STANDS_IN, 0), a.at(STANDS_IN, 0)], "Concrete", up=True)
    m.done("Pads")


def build_stands() -> None:
    """The stands all round: a concrete front, rows of seats stepping up and back, and the hall's wall behind."""
    m = Mesh()
    st = stations(8.0, 16, False)
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
        w.quad([a.at(WALL_OUT, 0), a.at(WALL_OUT, WALL_UP), b.at(WALL_OUT, WALL_UP), b.at(WALL_OUT, 0)], "HallWall")
        w.bm.faces.ensure_lookup_table()
        f = w.bm.faces[-1]
        mid = f.calc_center_median()
        if f.normal.dot(Vector((STRAIGHT / 2 - mid.x, RADIUS - mid.y, 0))) < 0:
            f.normal_flip()
    w.done("HallWall")


def rounded(cx: float, cy: float, hx: float, hy: float, r: float, steps: int = 4) -> list[tuple[float, float]]:
    """The outline of a rounded rectangle, anticlockwise: half-sizes hx, hy, corner radius r."""
    pts = []
    for qx, qy, a0 in ((1, -1, -math.pi / 2), (1, 1, 0.0), (-1, 1, math.pi / 2), (-1, -1, math.pi)):
        ox, oy = cx + qx * (hx - r), cy + qy * (hy - r)
        for k in range(steps + 1):
            a = a0 + (math.pi / 2) * k / steps
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


def build_infield_kit() -> None:
    """The infield: a rink with its boards, four team pens along the home straight, the officials' desk and the podium at the line, the lap board and the ice resurfacer."""
    m = Mesh()
    # The rink in the middle of the infield: 60 by 30 m, white boards with an amber kick plate, red and blue lines.
    cx, cy = STRAIGHT / 2, RADIUS
    outline = rounded(cx, cy, 30, 15, 8)
    m.quad([(x, y, 0.06) for x, y in outline], "Ice", up=True)
    for (x0, y0), (x1, y1) in zip(outline, outline[1:] + outline[:1]):
        m.quad([(x0, y0, 0), (x1, y1, 0), (x1, y1, 0.25), (x0, y0, 0.25)], "Kick")
        m.quad([(x0, y0, 0.25), (x1, y1, 0.25), (x1, y1, 1.1), (x0, y0, 1.1)], "Barrier")
    for x, w, colour in ((cx - 0.15, 0.3, "Red"), (cx - 9.15, 0.3, "LaneLine"), (cx + 8.85, 0.3, "LaneLine")):
        m.quad([(x, cy - 15, 0.1), (x + w, cy - 15, 0.1), (x + w, cy + 15, 0.1), (x, cy + 15, 0.1)], colour, up=True)
    # The ice resurfacer, parked by the rink's end.
    m.box((cx + 36, cy + 4, 0.9), (4.2, 2.1, 1.4), "Resurfacer")
    m.box((cx + 35.4, cy + 4, 2.1), (1.4, 1.6, 1.0), "Glass")
    # Four team pens along the home straight's infield side.
    for k, colour in enumerate(("PenCoral", "PenTeal", "PenIndigo", "PenAmber")):
        x = 14.0 + k * 7.0
        m.box((x, 9.0, 0.04), (5.6, 3.4, 0.08), colour)
        m.box((x, 10.5, 0.25), (4.8, 0.45, 0.5), "Desk")
        m.box((x + 2.0, 8.2, 0.3), (0.5, 0.5, 0.6), "Rail")
    # The officials' desk inside the warm-up lane, level with the finish line, and the podium behind.
    m.box((0.6, 6.4, 0.45), (3.4, 1.0, 0.9), "Desk")
    m.box((0.6, 7.2, 0.6), (3.4, 0.5, 1.2), "Rail")
    for dx, h, colour in ((-1.3, 0.5, "Silver"), (0.0, 0.8, "Gold"), (1.3, 0.35, "Bronze")):
        m.box((0.6 + dx, 10.0, h / 2), (1.2, 1.2, h), colour)
    # The lap board beyond the pads past the line, facing the ice, and the photo-finish mast on the line.
    y = -(OUTER + PADS + 1.2)
    for x in (6.0, 12.0):
        m.box((x, y, 2.0), (0.25, 0.25, 4.0), "Steel")
    m.box((9.0, y, 4.6), (7.2, 0.3, 2.4), "Black")
    m.box((9.0, y + 0.16, 4.6), (6.6, 0.04, 1.9), "Screen")
    m.box((0.0, -(OUTER + PADS + 0.6), 3.0), (0.25, 0.25, 6.0), "Steel")
    m.box((0.0, -(OUTER + PADS + 0.3), 5.8), (0.5, 0.7, 0.45), "Black")
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
    build_ice()
    build_blocks()
    build_pads()
    build_stands()
    build_infield_kit()

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
        # The replay's broadcast camera (REPLAY_SCENE.track.camera, lifted for the longer lap): high over the west bend, looking along the oval.
        k = LAP / 250
        cx, cy = STRAIGHT / 2, RADIUS
        shoot(PREVIEW, (cx - 26 * k, cy, 108 * k), (cx + 4 * k, cy, 0), 70, (600, 960))
        shoot(PREVIEW_CLOSE, (-10, 16, 7), (60, -4, 0), 55, (960, 600))
        print(f"wrote {PREVIEW} and {PREVIEW_CLOSE}")
    MANIFEST.write_text(json.dumps({"inputHash": input_hash(), "blender": BLENDER}, indent=2) + "\n")
    print(f"wrote {MANIFEST}")


main()
