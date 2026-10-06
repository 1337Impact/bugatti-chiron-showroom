"""
Bakes the soft ground-contact shadow used by the web page (public/textures/ground_shadow.png).

  blender -b bugatti/chiron_web.blend --python tools/bake_and_preview.py

Set PREVIEW=1 to also render Cycles QA stills of the cleaned model into tools/qa
(or QA_DIR), SAMPLES to change the sample count.
"""
import bpy, os, math
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QA = os.environ.get("QA_DIR", os.path.join(ROOT, "tools", "qa"))
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = int(os.environ.get("SAMPLES", "64"))
sc.cycles.use_denoising = True
sc.view_settings.view_transform = "Standard"
car = [o for o in sc.objects if o.type == "MESH"]

world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")

def camera(loc, target, ortho=None, lens=55):
    cd = bpy.data.cameras.new("c"); cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam)
    cam.location = Vector(loc)
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
    if ortho: cd.type = "ORTHO"; cd.ortho_scale = ortho
    cd.lens = lens
    sc.camera = cam
    return cam

# ---------------------------------------------------------------- shadow bake
SIZE = 7.0  # metres covered by the texture; the web plane must match
bpy.ops.mesh.primitive_plane_add(size=SIZE * 2, location=(0, 0, 0))
floor = bpy.context.active_object
floor.is_shadow_catcher = True
for o in car: o.visible_camera = False
bg.inputs[0].default_value = (1, 1, 1, 1); bg.inputs[1].default_value = 1.0
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 1024
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
cam = camera((0, 0, 20), (0, 0, 0), ortho=SIZE)
cam.rotation_euler = (0, 0, 0)           # +Y of the image = +Y of the scene (rear of the car)
sc.render.filepath = os.path.join(ROOT, "public", "textures", "ground_shadow.png")
bpy.ops.render.render(write_still=True)
print("BAKED", sc.render.filepath)

# ---------------------------------------------------------------- QA stills
if os.environ.get("PREVIEW", "0") == "1":
    os.makedirs(QA, exist_ok=True)
    for o in car: o.visible_camera = True
    floor.is_shadow_catcher = False
    fm = bpy.data.materials.new("floor"); fm.use_nodes = True
    b = next(n for n in fm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (0.02, 0.02, 0.022, 1); b.inputs["Roughness"].default_value = 0.25
    floor.data.materials.append(fm); floor.scale = (6, 6, 1)
    sc.render.film_transparent = False
    bg.inputs[0].default_value = (0.02, 0.02, 0.025, 1); bg.inputs[1].default_value = 1.0
    def light(loc, size, power, rot):
        ld = bpy.data.lights.new("l", "AREA"); ld.shape = "RECTANGLE"; ld.size = size[0]; ld.size_y = size[1]; ld.energy = power
        lo = bpy.data.objects.new("l", ld); sc.collection.objects.link(lo); lo.location = loc; lo.rotation_euler = [math.radians(a) for a in rot]
    light((0, 0, 4.5), (7, 2.2), 2600, (0, 0, 0))
    light((-5, -1, 2.0), (5, 1.2), 1500, (0, -75, 0))
    light((5, 1, 2.0), (5, 1.2), 1500, (0, 75, 0))
    light((0, -6, 2.5), (5, 1.0), 900, (70, 0, 0))
    sc.render.resolution_x = 1280; sc.render.resolution_y = 720
    sc.render.image_settings.color_mode = "RGB"
    shots = {
        "front34": ((3.6, -5.0, 1.5), (0, 0, 0.55)),
        "rear34": ((-3.8, 5.0, 1.7), (0, 0, 0.6)),
        "side": ((6.5, 0, 0.9), (0, 0, 0.6)),
        "top": ((0.01, 0.0, 9.0), (0, 0, 0)),
        "wheel": ((2.1, -2.6, 0.55), (0.9, -1.3, 0.38)),
        "tail": ((-0.9, 4.4, 1.15), (0, 2.0, 0.75)),
    }
    only = os.environ.get("SHOTS")
    for name, (loc, tgt) in shots.items():
        if only and name not in only.split(","): continue
        camera(loc, tgt)
        sc.render.filepath = os.path.join(QA, f"qa_{name}.png")
        bpy.ops.render.render(write_still=True)
        print("QA", sc.render.filepath)
