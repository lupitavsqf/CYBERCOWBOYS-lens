STOP SIGN  -  game-ready asset
==================================================

source/Stop Sign.fbx         Self-contained FBX (ASCII, FBX 7.4 / version 7400 -
                             widely compatible with Blender, Unity, Unreal, Maya,
                             3ds Max). BaseColor + Normal maps are EMBEDDED, so it
                             imports with a usable material and no missing-texture
                             prompts. Authored in centimetres, Y-up, real-world
                             scale (76 cm octagon, sign centre ~1.9 m, ~2 m post).
source/build_stop.py         Builds the mesh + FBX. Re-run with
                             `python build_stop.py` from a folder that has
                             ./textures (it calls tex_stop.py to (re)make the atlas
                             if it is missing).
source/tex_stop.py           Procedural generator for the PBR texture atlas.

textures/  PBR texture ATLAS, 2048x2048:
  Stop_BaseColor.png                       colour (sRGB)        <- embedded in FBX
  Stop_Normal.png                          tangent-space normal <- embedded in FBX
  Stop_Roughness.png                       (Non-Color)
  Stop_Metallic.png                        (Non-Color)
  Stop_AO.png                              ambient occlusion
  Stop_OcclusionRoughnessMetallic.png      packed ORM (R=AO, G=Rough, B=Metal)

MODEL
  A standard flat-top octagonal STOP plate (76 cm across the flats) extruded to a
  thin slab, mounted on a brushed-steel post. The plate reads "STOP" on BOTH
  faces: the front and back are separate octagon fans, and the back face's UVs are
  mirrored horizontally so the word is correct (not reversed) when viewed from
  behind. The post is tucked behind the sign and runs to the ground.
  ~300 verts, 312 polys (8+8 face tris, 8 rim quads, post + caps).

UV ATLAS LAYOUT
  One material, one atlas, two regions:
    STOP  region (square)      : red plate, inset white octagon border, white
                                 "STOP". Both sign faces map here (back mirrored).
    METAL region (lower strip) : brushed galvanised steel; the post and the thin
                                 octagon rim map here.
  The metallic/roughness maps already carry the right values per region (sign face
  matte/non-metal, post metal=1), so no per-face material setup is needed.

USING THE FULL PBR SET
  A legacy FBX material auto-wires only Base Color + Normal, which is what is
  embedded. For a physically-based look, plug the remaining maps into your shader:
  Roughness -> Roughness, Metallic -> Metallic, AO/ORM into ambient occlusion. In
  Blender: import the FBX, add Image Texture nodes for Roughness/Metallic (set to
  Non-Color) and wire them into the Principled BSDF.

NOTE
  Generated with a pure-Python pipeline (no Blender dependency), so no .blend is
  included; re-run build_stop.py to regenerate the FBX and textures from scratch.
