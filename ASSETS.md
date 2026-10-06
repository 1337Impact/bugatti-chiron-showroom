# Asset credits and licences

## Bugatti Chiron 2017 — 3D model

| | |
| --- | --- |
| Source | [Blend Swap — Bugatti Chiron 2017](https://blendswap.com/blend/32484) |
| Shared on Blend Swap by | apexmesh |
| Modeller credited in the download | Bob Kimani (Kimz Auto) — see [`bugatti/README.txt`](bugatti/README.txt) |
| Licence | Creative Commons Attribution-NonCommercial (CC-BY-NC), as listed on Blend Swap |

**What that means for you:** you can copy, share and modify the model for
non-commercial purposes as long as you keep this credit. You cannot use it in
anything commercial. If you want to use this code commercially, swap in a model
you have the rights to — only material names and a few object names need to match
(see `tools/build_model.py`).

### Files derived from the model

These are adaptations and carry the same CC-BY-NC terms:

- `public/models/chiron.glb` — straightened, rescaled, re-materialed, wheels and wing
  separated, engine lettering un-mirrored, dark underbody core added, Draco-compressed
- `bugatti/chiron_web.blend` — the same cleaned model as a Blender file
- `public/textures/ground_shadow.png` — contact shadow baked from the model in Cycles
- `screenshots/*`, `app/opengraph-image.png` — renders of the model

The original download (`bugatti.blend`, `bugatti.obj`) is not in this repository
because it is larger than GitHub allows; get it from the Blend Swap page above.

## Software

- [Next.js](https://nextjs.org) and [React](https://react.dev) — MIT
- [three.js](https://threejs.org) — MIT (includes the Draco decoder in `public/draco`, Apache-2.0)
- [N8AO](https://github.com/N8python/n8ao) — ambient occlusion

## Design inspiration

The layout and feature set are inspired by the
[Otherlife Labs Virtual Car Showroom](https://labs.otherlife.xyz/virtual-car-showroom).
No code or assets from that project are used.

## Trademarks

"Bugatti" and "Chiron" are trademarks of Bugatti Automobiles S.A.S. This is an
independent, non-commercial fan project and is not affiliated with or endorsed by them.
