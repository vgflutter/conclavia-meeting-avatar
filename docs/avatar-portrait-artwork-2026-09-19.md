# Adult portrait artwork prompts, 19 September 2026

Tool: built-in **imagegen**, edit mode, no CLI fallback. Each input was inspected before the edit. Outputs were copied into `src/assets/avatar/`; the originals remain untouched.

## Adult base atlas

Input: `src/assets/avatar/portraits-2-5d-v1.png`.

Selected output: `exec-c2444d08-de9a-4ec5-8701-042bd1f8f85e.png`.

Saved asset: [`portraits-2-5d-adult-v3.png`](https://github.com/vgflutter/conclavia-avatar-kit/blob/main/src/assets/avatar/portraits-2-5d-adult-v3.png).

Exact prompt:

> Use case: style-transfer. Edit target: this exact square 2x2 portrait animation atlas. Create a more sophisticated, adult, natural editorial portrait version of these SAME two fictional professional colleagues, male top row, female bottom row, resting left and hand raised right. The user dislikes the typical AI children's-cartoon / Pixar avatar look. Change faces to believable adults aged 40-45 with normal SMALLER human eyes and irises, normal facial proportions, subtle skin texture, slight crow's feet, adult jaw, understated closed-mouth expression. High-end editorial photographic realism, approachable and thoughtful, not a toy, not glossy, not beauty retouch. Keep the SAME male brown hair and dark rectangular glasses, same female brown bob and earrings, navy blazer/ivory shirt and terracotta blazer/ivory shirt. CRITICAL animation registration: preserve exact 2x2 grid, full canvas aspect and quadrants, head size and head position, eye center positions, mouth center positions, body silhouettes, clothes, lapels, hands and finger positions, and warm ivory background. Change primarily face anatomy and skin, preserve hair silhouette and neck. Both versions of each individual must have identical identity. Mouths fully closed relaxed neutral, eyes open. No text, labels, grids, objects or watermark. Do not crop, zoom or reposition people. Output a complete square PNG atlas.

## Registered facial features

Input: the adult base atlas above.

Selected output: `exec-393b3a9b-a434-48e9-b1fe-37831cf52472.png`.

Saved asset: [`portraits-2-5d-adult-features-v3.png`](https://github.com/vgflutter/conclavia-avatar-kit/blob/main/src/assets/avatar/portraits-2-5d-adult-features-v3.png).

Exact prompt:

> Use case: precise-object-edit. Edit target: this exact square 1254x1254 2x2 adult portrait animation atlas. Produce the registered FACIAL ANIMATION texture. Change ONLY the eyes and mouths of all four portraits: eyes gently fully CLOSED for a natural blink, mouth OPEN in a relaxed speaking AH, about 18-22 pixels of dark mouth interior height at this resolution, realistic upper teeth with just a small amount of lower teeth and inner lower lip. Calm speaking, NOT a smile, NOT shouting or grimacing. Preserve EXACT head and face position, size, identity, nose, cheeks, chin, glasses, hair, skin tone, neck, shoulders, clothing, fingers, background and exact 2x2 grid. Top left male mouth remains centered at approximately (313,269), bottom left female mouth at (325,882) in full canvas coordinates. Keep both faces mature, natural adult proportions and subtle skin texture. Glasses must stay unchanged even though the eyes behind close. Mouth opening should lower the bottom lip, upper lip should stay at its original height. No repositioning, zoom, cropping, text or watermark. Same image size and framing. This will be blended ONLY at tiny feathered mouth/eye masks so precise registration and matching skin color are essential.

These prompts record asset generation, not the current animation constraints. The runtime keeps both original lips and the surrounding skin from the base atlas, articulates upper/lower lips and jaw in code, and samples the feature atlas only for registered eyelids and the oral cavity/teeth. The prompt's pinned upper lip is therefore not a current renderer invariant. Generated background, jaw outline and clothing from the feature atlas are not composited. Landmark registration is declared in `portrait-renderer.ts`; [the implementation report](avatar-portrait-2-5d.md) describes current movement and visual evidence.

The existing transparent arm layer [`portraits-2-5d-arm-layers-v2.png`](https://github.com/vgflutter/conclavia-avatar-kit/blob/main/src/assets/avatar/portraits-2-5d-arm-layers-v2.png) supplies the separate sleeve, cuff and hand. The current rendering uses that layer continuously around the elbow instead of dissolving between the resting and raised portrait cells.
