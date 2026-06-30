START LINE  -  game-ready asset
==================================================

source/Start Line.fbx       Self-contained FBX (ASCII, FBX 7.4 / version 7400 -
                             widely compatible with Blender, Unity, Unreal, Maya,
                             3ds Max). The BaseColor and Normal maps are EMBEDDED,
                             so it imports with a usable material and no missing-
                             texture prompts. Authored in centimetres, Y-up, so it
                             lands upright at real-world scale (posts ~215 cm tall,
                             banner spanning ~3.6 m).
source/build_start.py       Builds the mesh + FBX. Re-run with
                             `python build_start.py` from a folder that has
                             ./textures (it will call tex_start.py to (re)make the
                             atlas if it is missing).
source/tex_start.py         Procedural generator for the PBR texture atlas.

textures/  PBR texture ATLAS, 2048x2048:
  Start_BaseColor.png                     colour (sRGB)        <- embedded in FBX
  Start_Normal.png                        tangent-space normal <- embedded in FBX
  Start_Roughness.png                     (Non-Color)
  Start_Metallic.png                      (Non-Color)
  Start_AO.png                            ambient occlusion
  Start_OcclusionRoughnessMetallic.png    packed ORM (R=AO, G=Rough, B=Metal)

PARTS (all one mesh, one material, driven by the atlas)
  - Two galvanised-steel posts that splay outward at the top, each with a ball
    finial and a subtle collar where the banner attaches.
  - A cream cloth "START" banner sagging between the posts (catenary droop +
    gentle cloth wave), with GREEN checker ends and a bold green serif wordmark.
    The banner is DOUBLE-SIDED so it reads from both front and back.
  - A matching flat "START" banner lying on the ground in front of the gate
    (also double-sided), with a GREEN checker BORDER all around plus checker end
    blocks, as seen in the reference image.

UV ATLAS LAYOUT
  The single 2048 atlas is split into three regions so one material covers all
  the cloth and the metal at once:
    BANNER region (upper)  : cloth, green checker ends, "START". The hung banner
                             maps here.
    MAT region   (middle)  : cloth with a full green checker border + end blocks
                             and centred "START". The ground banner maps here.
    METAL region (lower)   : brushed galvanised steel; the posts map here.
  Each cloth graphic is authored on a wide ~5.1:1 canvas so the checker cells are
  true squares once the UVs un-squash them onto the model. Because it is one
  atlas, the metallic/roughness maps already carry the right values per region
  (cloth = matte, metal = 1) - no per-face material setup needed.

USING THE FULL PBR SET
  A legacy FBX material auto-wires only Base Color + Normal, which is what is
  embedded. For a physically-based look, plug the remaining maps into your shader:
  Roughness -> Roughness, Metallic -> Metallic, AO/ORM into ambient occlusion. In
  Blender: import the FBX, add Image Texture nodes for Roughness/Metallic (set to
  Non-Color) and wire them into the Principled BSDF. The posts read as metal=1 and
  the cloth as metal=0 straight from the maps.

NOTE
  Generated with a pure-Python pipeline (no Blender dependency), so no .blend is
  included; re-run build_start.py to regenerate the FBX and textures from scratch.
