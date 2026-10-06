"""
Builds the web-ready Chiron from bugatti/bugatti.blend.

Source: "Bugatti Chiron 2017" from Blend Swap (https://blendswap.com/blend/32484,
CC-BY-NC). Unzip it so that bugatti/bugatti.blend exists, then run headless:

  blender -b bugatti/bugatti.blend --python tools/build_model.py

What it does
  * takes the complete car from the `parkinghdr` scene
  * un-rotates it (the source is posed 9.6deg off-axis), scales it to the real
    4.544 m length, centres it and sits the tyres on z = 0
  * applies modifiers at web-friendly subdivision levels
  * rebuilds the ~70 Cycles materials as a small, named Principled set
  * splits wheels (spinning part / fixed caliper) and the rear wing into
    separate, correctly pivoted objects
  * writes bugatti/chiron_web.blend and public/models/chiron.glb
"""
import bpy, bmesh, math, os, re, sys
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_BLEND = os.path.join(ROOT, "bugatti", "chiron_web.blend")
OUT_GLB = os.path.join(ROOT, "public", "models", "chiron.glb")
REAL_LENGTH = 4.544

src = bpy.data.scenes["parkinghdr"]
bpy.context.window.scene = src

# ---------------------------------------------------------------- materials
for _m in list(bpy.data.materials):    # free the clean names for the rebuilt set
    _m["orig_name"] = _m.name
    _m.name = "src_" + _m.name

def mat(name, color, metallic=0.0, rough=0.5, emit=None, emit_strength=0.0, alpha=1.0, coat=0.0, transmission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    b.inputs["Alpha"].default_value = alpha
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.03
    b.inputs["Transmission Weight"].default_value = transmission
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1.0:
        m.surface_render_method = "BLENDED"
    m.diffuse_color = (*color, 1)
    return m

M = {
    "paint_primary":    mat("paint_primary",    (0.010, 0.085, 0.60), 0.6, 0.28, coat=1.0),
    "paint_secondary":  mat("paint_secondary",  (0.004, 0.012, 0.045), 0.6, 0.28, coat=1.0),
    "chrome_trim":      mat("chrome_trim",      (0.86, 0.86, 0.88), 1.0, 0.12),
    "glass_window":     mat("glass_window",     (0.012, 0.014, 0.018), 0.0, 0.03, coat=1.0),
    "trim_black":       mat("trim_black",       (0.012, 0.012, 0.013), 0.0, 0.35),
    "arch_black":       mat("arch_black",       (0.008, 0.008, 0.008), 0.0, 0.9),
    "vent_black":       mat("vent_black",       (0.004, 0.004, 0.004), 0.0, 0.75),
    "diffuser":         mat("diffuser",         (0.015, 0.015, 0.016), 0.2, 0.42),
    "mirror_glass":     mat("mirror_glass",     (0.9, 0.9, 0.9), 1.0, 0.03),
    "exhaust":          mat("exhaust",          (0.42, 0.44, 0.47), 1.0, 0.28),
    "grill":            mat("grill",            (0.02, 0.02, 0.022), 0.85, 0.38),
    "tyre":             mat("tyre",             (0.012, 0.012, 0.012), 0.0, 0.82),
    "rim":              mat("rim",              (0.72, 0.73, 0.75), 1.0, 0.22),
    "rim_accent":       mat("rim_accent",       (0.010, 0.085, 0.60), 0.6, 0.3, coat=1.0),
    "rim_cap":          mat("rim_cap",          (0.75, 0.75, 0.76), 1.0, 0.25),
    "wheel_nut":        mat("wheel_nut",        (0.05, 0.05, 0.055), 1.0, 0.35),
    "brake_disc":       mat("brake_disc",       (0.16, 0.16, 0.17), 0.7, 0.5),
    "hub":              mat("hub",              (0.02, 0.02, 0.02), 0.4, 0.6),
    "caliper":          mat("caliper",          (0.010, 0.12, 0.80), 0.3, 0.3, coat=1.0),
    "engine":           mat("engine",           (0.50, 0.51, 0.53), 1.0, 0.36),
    "engine_text":      mat("engine_text",      (0.03, 0.03, 0.035), 0.6, 0.4),
    "headlight_lens":   mat("headlight_lens",   (0.75, 0.9, 1.0), 0.0, 0.02, alpha=0.35),
    "headlight_emit":   mat("headlight_emit",   (0.9, 0.95, 1.0), 0.0, 0.2, emit=(0.80, 0.90, 1.0), emit_strength=6.0),
    "headlight_housing":mat("headlight_housing",(0.04, 0.04, 0.045), 1.0, 0.25),
    "headlight_cover":  mat("headlight_cover",  (1.0, 1.0, 1.0), 0.0, 0.0, alpha=0.12),
    "headlight_trim":   mat("headlight_trim",   (0.6, 0.6, 0.62), 1.0, 0.2),
    "taillight_glass":  mat("taillight_glass",  (0.35, 0.0, 0.005), 0.0, 0.08, coat=1.0),
    "taillight_trim":   mat("taillight_trim",   (0.03, 0.03, 0.03), 0.8, 0.3),
    "taillight_emit":   mat("taillight_emit",   (0.6, 0.0, 0.0), 0.0, 0.3, emit=(1.0, 0.03, 0.02), emit_strength=6.0),
    "badge_red":        mat("badge_red",        (0.55, 0.0, 0.01), 0.2, 0.25, coat=1.0),
    "badge_chrome":     mat("badge_chrome",     (0.9, 0.9, 0.92), 1.0, 0.1),
    "strut_metal":      mat("strut_metal",      (0.55, 0.56, 0.58), 1.0, 0.25),
    "strut_chrome":     mat("strut_chrome",     (0.9, 0.9, 0.92), 1.0, 0.06),
    "strut_dark":       mat("strut_dark",       (0.03, 0.03, 0.035), 0.8, 0.35),
    "cable":            mat("cable",            (0.01, 0.01, 0.01), 0.0, 0.5),
    "underbody":        mat("underbody",        (0.004, 0.004, 0.004), 0.0, 1.0),
}

ROLE = {
    "BLUE": "paint_primary", "NAVY": "paint_secondary",
    "silver door strip": "chrome_trim", "front window": "glass_window",
    "black fuel_tank": "diffuser", "black strip": "trim_black", "WHEEL CURB": "arch_black",
    "black vent": "vent_black", "black side vent": "vent_black", "black": "trim_black",
    "Wireframe": "trim_black", "Mirrors": "mirror_glass", "exhaust": "exhaust",
    "GRILL": "grill", "tyre": "tyre", "rim_silver": "rim", "rim blue": "rim_accent",
    "Material": "rim_cap", "Nut": "wheel_nut", "brake disk": "brake_disc",
    "wheel joint": "hub", "cALLIPERS": "caliper", "ENGINE": "engine",
    "headlight glass": "headlight_lens", "headlight_square": "headlight_emit",
    "reflective coat": "headlight_housing", "glass front": "headlight_cover", "Trim": "headlight_trim",
    "red glass": "taillight_glass", "silver trim": "taillight_trim", "breaks": "taillight_emit",
    "red": "badge_red", "aluminiumm": "strut_metal", "glossy": "strut_chrome",
    "white holders": "strut_dark", "black cable": "cable",
}
def role_of(m):
    if m is None:
        return None
    base = re.sub(r"\.\d+$", "", m.get("orig_name", m.name)).strip()
    return ROLE.get(base)

# (source object, group, subsurf level or None, forced material or None)
PARTS = [
    ("Plane.069", "body", 2, None),            # main shell
    ("Plane.067", "body", 2, None),            # horseshoe frame
    ("Plane.068", "body", 2, None),            # headlight housings
    ("Cube.118",  "body", 1, None),            # headlight LED blocks
    ("Cube.110",  "body", 0, None),            # horseshoe mesh
    ("Cube.119",  "body", 0, None),            # front intake mesh
    ("Cube.114",  "body", 0, None),            # rear mesh
    ("Cube.113",  "body", 2, None),            # engine covers
    ("Text.010",  "body", None, "engine_text"),
    ("Cube.102",  "body", 2, "badge_chrome"),  # rear EB
    ("Cube.104",  "body", 2, "badge_chrome"),  # rear EB
    ("Cube.103",  "body", None, None),         # tail light bar
    ("Plane.066", "body", 1, None),            # tail light housing
    ("Icosphere.008", "body", None, None),     # tail light dots
    ("Icosphere.009", "body", None, None),
    ("Cylinder.138", "body", 2, None),         # front badge
    ("Text.009",  "body", None, "badge_chrome"),
    ("Plane.062", "body", None, "trim_black"),
    ("Cylinder.145", "wing", 2, None),
    ("Cylinder.146", "wing_struts", 1, None),
    ("BezierCurve.004", "wing_struts", None, None),
    ("Cube.107",  "wheel_front", 1, None),
    ("Cube.115",  "wheel_rear", 1, None),
]

# Lettering whose source mirror modifier would produce reversed glyphs.
READABLE_TEXT = {"Text.010"}

# car frame = the mirror object's frame (rotation + translation only)
frame = src.objects["Cube.112"]
loc, rot, _ = frame.matrix_world.decompose()
F = (Matrix.Translation(loc) @ rot.to_matrix().to_4x4()).inverted()
print("FRAME rot deg", [round(math.degrees(a), 2) for a in rot.to_euler()])

for name, group, lvl, _ in PARTS:
    o = src.objects[name]
    for md in o.modifiers:
        if md.type == "SUBSURF" and lvl is not None:
            md.levels = lvl
        if md.type == "WIREFRAME":
            md.show_viewport = False
        if md.type == "MIRROR" and (group.startswith("wheel") or name in READABLE_TEXT):
            md.show_viewport = False            # mirrored by hand (wheels: own objects, text: kept readable)
    if o.type == "CURVE":
        o.data.resolution_u = 6
        o.data.bevel_resolution = 1
    if o.type == "FONT":
        o.data.resolution_u = 3

dg = bpy.context.evaluated_depsgraph_get()
dg.update()

exp = bpy.data.scenes.new("chiron_web")
made = {}
for name, group, lvl, forced in PARTS:
    o = src.objects[name]
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    mw = F @ o.matrix_world
    me.transform(mw)
    if mw.determinant() < 0:
        me.flip_normals()
    # remap materials
    roles = [forced or role_of(m) for m in me.materials]
    if not me.materials:
        roles = [forced or "trim_black"]
        me.materials.append(None)
    for i, r in enumerate(roles):
        if r is None:
            print("UNMAPPED", name, me.materials[i].name if me.materials[i] else None)
            r = "trim_black"
        me.materials[i] = M[r]
    for p in me.polygons:
        p.use_smooth = True
    no = bpy.data.objects.new(f"{group}__{name}", me)
    exp.collection.objects.link(no)
    made.setdefault(group, []).append(no)
    if name in READABLE_TEXT:
        # second copy for the other cylinder bank: mirror across the car, and
        # flip along the text's own baseline so the letters stay the right way round
        local = bpy.data.meshes.new_from_object(o.evaluated_get(dg), depsgraph=dg)
        xs = [v.co.x for v in local.vertices]
        flip = Matrix.Translation((min(xs) + max(xs), 0, 0)) @ Matrix.Scale(-1, 4, (1, 0, 0))
        local.transform(Matrix.Scale(-1, 4, (1, 0, 0)) @ mw @ flip)
        local.materials.clear()
        local.materials.append(M[forced])
        for p in local.polygons:
            p.use_smooth = True
        twin = bpy.data.objects.new(f"{group}__{name}_twin", local)
        exp.collection.objects.link(twin)
        made[group].append(twin)
    print(f"PART {name:18} -> {group:12} polys={len(me.polygons):7}")

bpy.context.window.scene = exp
vl = exp.view_layers[0]

def join(objs, name):
    if len(objs) > 1:
        with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, selected_objects=objs, object=objs[0]):
            bpy.ops.object.join()
    objs[0].name = name
    objs[0].data.name = name
    return objs[0]

def bbox(me, mat_names=None):
    idx = None
    if mat_names:
        ids = {i for i, m in enumerate(me.materials) if m and m.name in mat_names}
        idx = {v for p in me.polygons if p.material_index in ids for v in p.vertices}
    vs = [v.co for v in me.vertices if idx is None or v.index in idx]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return mn, mx

def split_by_material(obj, mat_names, new_name):
    """Move faces using mat_names into a new object; returns it."""
    me = obj.data
    ids = {i for i, m in enumerate(me.materials) if m and m.name in mat_names}
    bm = bmesh.new(); bm.from_mesh(me)
    keep = [f for f in bm.faces if f.material_index not in ids]
    bm2 = bm.copy()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in ids], context="FACES")
    bmesh.ops.delete(bm2, geom=[f for f in bm2.faces if f.material_index not in ids], context="FACES")
    bm.to_mesh(me); bm.free()
    me2 = bpy.data.meshes.new(new_name)
    for m in me.materials: me2.materials.append(m)
    bm2.to_mesh(me2); bm2.free()
    o2 = bpy.data.objects.new(new_name, me2)
    exp.collection.objects.link(o2)
    return o2

def mirrored_copy(obj, name):
    me = obj.data.copy()
    me.transform(Matrix.Scale(-1, 4, (1, 0, 0)))
    me.flip_normals()
    o2 = bpy.data.objects.new(name, me)
    exp.collection.objects.link(o2)
    return o2

body = join(made["body"], "body")
wing = join(made["wing"], "wing")
struts = join(made["wing_struts"], "wing_struts")
wf = made["wheel_front"][0]; wr = made["wheel_rear"][0]

# ------------------------------------------------ global scale / placement
bmn, bmx = bbox(body.data, {"paint_primary", "paint_secondary"})
length = bmx.y - bmn.y
s = REAL_LENGTH / length
zmin = min(bbox(wf.data, {"tyre"})[0].z, bbox(wr.data, {"tyre"})[0].z)
ymid = (bmx.y + bmn.y) / 2
T = Matrix.Scale(s, 4) @ Matrix.Translation((0, -ymid, -zmin))
print(f"BODY length={length:.3f} scale={s:.4f} zmin={zmin:.3f} xspan=({bmn.x:.3f},{bmx.x:.3f})")
for o in (body, wing, struts, wf, wr):
    o.data.transform(T)

# ------------------------------------------------ underbody
def core(name, prisms, material):
    """Closed black volumes: (z_bottom, z_top, outline)."""
    bm = bmesh.new()
    for z0, z1, pts in prisms:
        face = bm.faces.new([bm.verts.new((x, y, z0)) for x, y in pts])
        top = bmesh.ops.extrude_face_region(bm, geom=[face])
        bmesh.ops.translate(bm, vec=(0, 0, z1 - z0), verts=[g for g in top["geom"] if isinstance(g, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(M[material])
    o = bpy.data.objects.new(name, me); exp.collection.objects.link(o)
    return o

# The source is a hollow single-surface shell with no floor pan. A dark core
# under the skin stops low cameras and the floor reflection from seeing inside it.
fmn, fmx = bbox(wf.data, {"tyre"}); rmn, rmx = bbox(wr.data, {"tyre"})
inner = min(abs(fmn.x), abs(fmx.x), abs(rmn.x), abs(rmx.x)) - 0.04      # stay inside the tyres
fy, ry = (fmn.y + fmx.y) / 2, (rmn.y + rmx.y) / 2                      # axle positions
fr, rr = (fmx.z - fmn.z) / 2 + 0.06, (rmx.z - rmn.z) / 2 + 0.06        # arch clearance
nose, tail = -REAL_LENGTH / 2, REAL_LENGTH / 2
sym = lambda pts: pts + [(-x, y) for x, y in reversed(pts)]            # mirror a half outline
under = core("underbody", [
    (0.135, 0.50, sym([(inner, fy - fr), (inner, ry + rr)])),                              # spine between the arches
    (0.135, 0.50, sym([(0.88, fy + fr), (0.88, -0.15), (0.66, 0.05), (0.66, ry - rr)])),  # between the axles, tucked in behind the side intakes
    (0.17, 0.42, sym([(0.45, nose + 0.24), (0.80, nose + 0.46), (0.80, fy - fr)])),        # front overhang, follows the nose
    (0.19, 0.50, sym([(0.88, ry + rr), (0.88, tail - 0.32), (0.66, tail - 0.2)])),         # rear overhang
], "underbody")
print(f"UNDERBODY inner={inner:.3f} axles=({fy:.3f},{ry:.3f})")

# ------------------------------------------------ wheels
wheels = []
for src_w, tag in ((wf, "F"), (wr, "R")):
    side = "R" if bbox(src_w.data, {"tyre"})[0].x + bbox(src_w.data, {"tyre"})[1].x > 0 else "L"
    other = "L" if side == "R" else "R"
    src_w.name = f"wheel_{tag}{side}"
    twin = mirrored_copy(src_w, f"wheel_{tag}{other}")
    wheels += [src_w, twin]
calipers = []
for w in wheels:
    c = split_by_material(w, {"caliper"}, w.name.replace("wheel", "caliper"))
    calipers.append(c)
    mn, mx = bbox(w.data, {"tyre"})
    centre = (mn + mx) / 2
    w.data.transform(Matrix.Translation(-centre))
    w.location = centre
    w.data.name = w.name
    print(f"WHEEL {w.name} centre=({centre.x:.3f},{centre.y:.3f},{centre.z:.3f}) dia={(mx.z-mn.z):.3f} width={(mx.x-mn.x):.3f} polys={len(w.data.polygons)}")
body = join([body, under] + calipers, "body")

# ------------------------------------------------ wing pivot (centre of blade)
mn, mx = bbox(wing.data)
pivot = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
wing.data.transform(Matrix.Translation(-pivot)); wing.location = pivot
smn, smx = bbox(struts.data)
print(f"WING pivot=({pivot.x:.3f},{pivot.y:.3f},{pivot.z:.3f}) size=({mx.x-mn.x:.3f},{mx.y-mn.y:.3f},{mx.z-mn.z:.3f}) STRUTS z=({smn.z:.3f},{smx.z:.3f}) y=({smn.y:.3f},{smx.y:.3f})")

root = bpy.data.objects.new("Chiron", None)
exp.collection.objects.link(root)
for o in [body, wing, struts] + wheels:
    o.parent = root

# drop unused material slots so the GLB only carries what is drawn
for o in [body, wing, struts] + wheels:
    used = {p.material_index for p in o.data.polygons}
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):
        bpy.ops.object.material_slot_remove_unused()

mn, mx = bbox(body.data)
tot = sum(len(o.data.polygons) for o in exp.objects if o.type == "MESH")
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in exp.objects if o.type == "MESH")
print(f"FINAL bbox=({mn.x:.3f},{mn.y:.3f},{mn.z:.3f})..({mx.x:.3f},{mx.y:.3f},{mx.z:.3f}) polys={tot} tris={tris}")
for o in exp.objects:
    if o.type == "MESH":
        print("OBJ", o.name, len(o.data.polygons), [m.name for m in o.data.materials])

# ------------------------------------------------ save + export
for sc in list(bpy.data.scenes):
    if sc != exp:
        bpy.data.scenes.remove(sc)
bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, compress=True)

for o in exp.objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB, export_format="GLB", use_selection=True, export_apply=True,
    export_yup=True, export_cameras=False, export_lights=False, export_animations=False,
    export_texcoords=True, export_normals=True, export_materials="EXPORT",
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14, export_draco_normal_quantization=10,
)
print("EXPORTED", OUT_GLB, round(os.path.getsize(OUT_GLB) / 1e6, 2), "MB")
