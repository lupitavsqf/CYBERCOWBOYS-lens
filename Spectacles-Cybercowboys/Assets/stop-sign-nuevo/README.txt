Stop Sign asset
================

Same structure as your other packages (traffic-cone-3, finish-line-3):

stop-sign-1/
├── textures/                              <- drop-in PBR texture set
│   ├── M_Stop_Sign_BaseColor.png          (red/white sign face + STOP text)
│   ├── M_Stop_Sign_Normal.png
│   ├── M_Stop_Sign_Roughness.png
│   ├── M_Stop_Sign_Metallic.png
│   ├── M_Stop_Sign_Height.png
│   ├── M_Stop_Sign_OcclusionRoughnessMetallic.png
│   └── M_Stop_Sign_Edge_BaseColor.png     (flat gray, used on the sides/back)
└── source/
    └── Stop Sign/
        ├── stop_sign.obj                  <- octagon prism: textured top face,
        ├── stop_sign.mtl                     gray side band + bottom cap
        ├── stop_sign.glb                  <- same mesh, textures embedded
        └── (same texture set, copied alongside the mesh)

If your viewer/engine showed a checkerboard grid instead of the red/white
sign face: that's the standard "missing texture" placeholder most
tools fall back to when they can't resolve the external map_Kd reference
in the .mtl (common with plain OBJ imports). Use stop_sign.glb instead —
it has the BaseColor/Normal/Roughness/Metallic textures embedded directly
in the file, so there's no external file to fail to link up.

Notes:
- The sign face (BaseColor) is a plain square texture — no perspective/slant
  baked in — so it maps cleanly onto the flat octagon top face without any
  stretching. The italic-looking "STOP" in your reference photo is just the
  camera angle on the 3D shape, not something to bake into the texture.
- OBJ/MTL (not FBX) so it drops into any engine (Unity, Unreal, Godot,
  Blender...). As with the other assets, engine-specific .meta/import files
  get created automatically the first time you import it there.
- Two materials: M_Stop_Sign_Face (top, textured) and M_Stop_Sign_Edge
  (sides + bottom, flat gray) — matching the two-tone look in your preview.
- Sign radius is 1.0 unit (flat-to-flat across the octagon is ~1.85 units)
  with a 0.09 unit thickness — scale the mesh in-engine to match your
  world's real-world sign size.
