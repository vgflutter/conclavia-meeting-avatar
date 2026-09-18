"""Build the CC0 Conclavia characters with Blender 4.5 + MPFB 2.0.17.

Offline build tool, never imported by the app. See docs/avatar-rigged-3d.md
for required asset packs, licenses and command. No user Blender preferences
are changed. Pass -- followed by --workspace, --mpfb-source and --output.
"""
import argparse
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Matrix, Quaternion

parser = argparse.ArgumentParser()
parser.add_argument('--workspace', required=True)
parser.add_argument('--mpfb-source', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
workspace = Path(args.workspace).resolve()
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(Path(args.mpfb_source).resolve() / 'src'))

# MPFB's first logger initializes before its preferences can be configured.
original_resource_path = bpy.utils.resource_path
bpy.utils.resource_path = lambda kind: str(workspace / 'blender') if kind == 'USER' else original_resource_path(kind)
original_extension_path = bpy.utils.extension_path_user
bpy.utils.extension_path_user = lambda package, **kw: str(workspace) if package == 'mpfb' else original_extension_path(package, **kw)
bpy.context.preferences.addons.new().module = 'mpfb'
import mpfb
mpfb.register()
from mpfb.services.humanservice import HumanService
from mpfb.services.targetservice import TargetService
from mpfb.services.faceservice import FaceService
from mpfb.services.exportservice import ExportService


def asset(base, category, name, kind=None):
    folder = workspace / 'data' / category / name
    file = next(folder.glob('*.mhclo'))
    return HumanService.add_mhclo_asset(str(file), base, asset_type=kind or category.capitalize(),
                                      subdiv_levels=0, material_type='GAMEENGINE')


def point_bone(rig, name, direction, twist=0):
    """Set a rest-relative world orientation, independent of bone roll."""
    bone = rig.pose.bones['mixamorig:' + name]
    rest = bone.bone.matrix_local.to_quaternion()
    target = Vector(direction).normalized()
    q = (rest @ Vector((0, 1, 0))).rotation_difference(target) @ rest
    if twist:
        q = Quaternion(target, twist) @ q
    bone.matrix = Matrix.Translation(bone.head) @ q.to_matrix().to_4x4()
    bpy.context.view_layer.update()


def arm_pose(rig, raised):
    for bone in rig.pose.bones:
        bone.rotation_mode = 'QUATERNION'
        bone.rotation_quaternion = Quaternion()
    rig.pose.bones['mixamorig:Head'].scale = (1.18, 1.18, 1.18)
    bpy.context.view_layer.update()
    for side, sign in [('Left', 1), ('Right', -1)]:
        active = raised and side == 'Left'
        point_bone(rig, side + 'Arm', (sign * (.48 if active else .13), -.04, -.88 if active else -1))
        point_bone(rig, side + 'ForeArm', (sign * (-.06 if active else .03), -.14, 1 if active else -1))
        point_bone(rig, side + 'Hand', (sign * (.04 if active else .03), -.08, 1 if active else -1), math.pi if active else 0)
        for finger in ['Index', 'Middle', 'Ring', 'Pinky']:
            for joint in range(1, 4):
                bone = rig.pose.bones['mixamorig:' + side + 'Hand' + finger + str(joint)]
                bone.rotation_quaternion = Quaternion((1, 0, 0), .03 if active else .16 + joint * .06)
    bpy.context.view_layer.update()


def tailor_clothes(clothes, female):
    """Assign fabric materials to geometry, retaining the source UV layout."""
    original = clothes.data.materials[0]
    texture = next(n.image for n in original.node_tree.nodes if n.type == 'TEX_IMAGE' and n.name == 'DiffuseTexture')
    pixels = list(texture.pixels)
    width, height = texture.size
    colors = [(0.26, .095, .060, 1) if female else (.028, .055, .087, 1),
              (.80, .76, .65, 1), (.065, .095, .10, 1), (.025, .028, .03, 1)]
    mats = []
    for label, color in zip(['Blazer', 'IvoryShirt', 'Tie', 'Buttons'], colors):
        mat = bpy.data.materials.new(label)
        mat.use_nodes = True
        p = mat.node_tree.nodes.get('Principled BSDF')
        p.inputs['Base Color'].default_value = color
        p.inputs['Roughness'].default_value = .82
        mats.append(mat)
    uv = clothes.data.uv_layers.active.data
    assignments = []
    for poly in clothes.data.polygons:
        coords = [uv[i].uv for i in poly.loop_indices]
        u = sum(c.x for c in coords) / len(coords)
        v = sum(c.y for c in coords) / len(coords)
        offset = 4 * (min(height-1, max(0, int(v * height))) * width + min(width-1, max(0, int(u * width))))
        r, g, b = pixels[offset:offset+3]
        assignments.append(2 if not female and u > .84 and v > .70 else 1 if min(r, g, b) > .55 else 2 if r > .35 and r > b * 1.6 else 3 if max(r, g, b) < .09 else 0)
    clothes.data.materials.clear()
    for mat in mats:
        clothes.data.materials.append(mat)
    for poly, index in zip(clothes.data.polygons, assignments):
        poly.material_index = index


def build(female):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    macro = TargetService.get_default_macro_info_dict()
    macro.update(gender=0 if female else 1, age=.56 if female else .60,
                 muscle=.40 if female else .53, weight=.43 if female else .48,
                 proportions=.60, height=.50, cupsize=.35, firmness=.55)
    macro['race'] = dict(caucasian=.85, asian=.10, african=.05)
    base = HumanService.create_human(macro_detail_dict=macro)
    base.name = 'ConclaviaFemale' if female else 'ConclaviaMale'
    rig = HumanService.add_builtin_rig(base, 'mixamo')
    skin = 'middleage_caucasian_female' if female else 'middleage_caucasian_male'
    HumanService.set_character_skin(str(workspace / 'data' / 'skins' / skin / (skin + '.mhmat')),
                                   base, skin_type='GAMEENGINE', material_instances=False)
    asset(base, 'eyes', 'high-poly', 'Eyes')
    asset(base, 'eyebrows', 'eyebrow007' if female else 'eyebrow001', 'Eyebrows')
    asset(base, 'eyelashes', 'eyelashes01', 'Eyelashes')
    asset(base, 'teeth', 'teeth_base', 'Teeth')
    asset(base, 'tongue', 'tongue01', 'Tongue')
    hair = asset(base, 'hair', 'ponytail01' if female else 'short01', 'Hair')
    clothes = asset(base, 'clothes', 'toigo_female_suit' if female else 'toigo_male_suit_3')
    tailor_clothes(clothes, female)
    if not female:
        asset(base, 'clothes', 'spamrakuen_tbm_glasses_frames_01')

    TargetService.bake_targets(base)
    FaceService.load_targets(base, load_microsoft_visemes=False, load_meta_visemes=True, load_arkit_faceunits=True)
    FaceService.interpolate_targets(base)
    # Keep only targets the runtime uses; hair and spectacles stay rigid.
    keep = {'Basis', 'viseme_aa', 'viseme_PP', 'viseme_FF', 'viseme_E', 'viseme_O', 'viseme_U', 'viseme_DD',
            'mouthSmileLeft', 'mouthSmileRight', 'cheekSquintLeft', 'cheekSquintRight', 'browInnerUp',
            'browDownLeft', 'browDownRight', 'browOuterUpRight', 'eyeBlinkLeft', 'eyeBlinkRight',
            'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight'}
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH' and obj.data.shape_keys:
            if obj == hair or 'glasses' in obj.name.lower():
                obj.shape_key_clear()
            else:
                for key in list(obj.data.shape_keys.key_blocks):
                    if key.name not in keep:
                        obj.shape_key_remove(key)
    subdivision = base.modifiers.new('Smooth portrait surface', 'SUBSURF')
    subdivision.levels = subdivision.render_levels = 1
    ExportService.bake_modifiers_remove_helpers(base, bake_masks=True, bake_subdiv=True, remove_helpers=True)
    bpy.context.view_layer.objects.active = clothes
    clothes.shape_key_clear()
    subdivision = clothes.modifiers.new('Smooth tailoring', 'SUBSURF')
    subdivision.levels = subdivision.render_levels = 1
    bpy.ops.object.modifier_apply(modifier=subdivision.name)
    for obj in list(bpy.context.scene.objects):
        if obj.type != 'MESH':
            continue
        for poly in obj.data.polygons:
            poly.use_smooth = True
        for modifier in list(obj.modifiers):
            if modifier.type == 'SUBSURF':
                obj.modifiers.remove(modifier)
        for mat in obj.data.materials:
            if not mat or not mat.use_nodes:
                continue
            for node in mat.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    node.inputs['Roughness'].default_value = .68
                    node.inputs['Metallic'].default_value = 0
        if obj.data.shape_keys:
            for key in obj.data.shape_keys.key_blocks:
                key.value = 0

    # Export real keyed bone poses. The browser samples this clip continuously
    # and overlays audio-clock face morphs, never swapping rest/raised pictures.
    bpy.context.scene.render.fps = 30
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 31
    rig.animation_data_create()
    for frame, raised in [(1, False), (31, True)]:
        bpy.context.scene.frame_set(frame)
        arm_pose(rig, raised)
        for bone in rig.pose.bones:
            bone.keyframe_insert('rotation_quaternion', frame=frame, group=bone.name)
            bone.keyframe_insert('scale', frame=frame, group=bone.name)
    rig.animation_data.action.name = 'HandRaise'
    bpy.context.scene.frame_set(1)
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active = rig
    name = 'female' if female else 'male'
    bpy.ops.wm.save_as_mainfile(filepath=str(out / (name + '.blend')))
    bpy.ops.export_scene.gltf(filepath=str(out / (name + '.glb')), export_format='GLB',
                              use_selection=True, export_animations=True, export_animation_mode='ACTIVE_ACTIONS',
                              export_morph=True, export_morph_normal=False, export_morph_tangent=False,
                              export_skins=True, export_extras=False, export_image_format='WEBP', export_image_quality=88)
    print('CONCLAVIA_EXPORTED', name, (out / (name + '.glb')).stat().st_size, flush=True)


build(False)
build(True)
