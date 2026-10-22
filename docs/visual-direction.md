# Visual direction

## A garden you can read

A storm-silenced conservatory becomes a small isometric diorama beside a warm field notebook. Pip restores it through inspectable instructions. The world should feel inviting and quietly adventurous while making tile, direction, action, and consequence easy to distinguish.

This is a design specification, not evidence that rendered proportions, motion, accessibility, or physical-device performance have passed review. Use the [acceptance checklist](review-checklist.md) to verify them.

## World and character

- **A diorama, not a landscape.** A compact planter on brass feet keeps the whole route readable. Conservatory ironwork sits behind the play area; tall planting stays clear of paths.
- **Path versus water is a material difference.** Walkable tiles have clay sides, cream raised plates, and brass studs. Missing tiles are pond water; decorative planting belongs on the bank, not the grid.
- **Useful landmarks.** The start dock has a copper plate and charging post. The destination is an amber lantern flower. Engraved coordinates match the interpreter's labels and the flat map.
- **Readable direction.** Pip's visor, tile pointer, and hovering arrow indicate forward. A heading dial and plain-language facing readout repeat the state. A turn changes facing, not tile.
- **Pip has a practical personality.** A terracotta repair robot with a glass visor, lamp eyes, seedling, antenna, and small tools. Walking, turning, bumping, and celebrating should clarify the program's effects, not punish a mistake.
- **Warm, local materials.** Pale mint, sage, forest ink, cream paper, terracotta, brass, and amber. No dark blue/purple gradient treatment, remote imagery, or remote fonts.

The renderer uses local authored geometry and textures, flat-shaded materials, simple lighting, and painted shadow blobs rather than dynamic shadow maps or post-processing.

## The field notebook

Keep one thing to read, one thing to edit, and one place for feedback visible. Secondary story and reference material stay optional.

**Always visible:** lesson/title and Lessons control; the primary goal; the program labelled as a teaching language, not Python; contextual feedback and any open clue; Run/One step and quieter recovery actions. Initial predictions or sensor observations use the same work area when relevant.

**Closed by default:** Field notes holds story, dialogue, retrieval/reference help, and review notes. Journal & settings holds progress, offline/save status, reduced motion, and export/import/erase. The final Python bridge is optional at the ending checkpoint.

Use ivory paper, forest ink, a restrained survey grid, mono labels, and an orange notebook margin. Reserve orange for the primary action, active code line, and directional emphasis. Controls are rectangular, with 44 px minimum targets and visible focus. Type is upright and uses local system sans/mono stacks. Do not use pill-button clusters, excessive italics, or extra permanent text islands.

The garden sits beside the notebook in landscape and above it on narrow/portrait screens. The action area stays reachable; short viewports must scroll without losing the top of an overlay or hiding content behind controls. Check actual layout at 1024×768, 768×600, 768×1024, and phone sizes rather than assuming CSS rules prove fit.

## Care state and act identity

Plant dose needs must remain readable beside Pip and the destination. In 3D, each planted tile has a pot and a dose rod: a ring for a missing dose and a bead for a delivered dose. Ready plants open cream blossoms. The flat map repeats care with filled/hollow dose marks, text, and changed borders, not color alone.

The five acts share the same world and controls. Small changes in warm light, ironwork, lanterns, and low bank props suggest the nursery, workshop, and final restoration without changing the teaching geometry or making the last act dark.

Rendering follows interpreter state. Plants, light, pose, and celebration never award completion themselves; Undo and reset must redraw the exact supplied state.

## Fallbacks, motion, and performance

- The flat map is built from real labeled tile buttons, with coordinates, facing, and plant state. In 3D it remains keyboard-accessible; without WebGL or in Flat view it is the primary world.
- Switching views preserves the program and execution state. A view-status announcement must not overwrite teaching feedback.
- Reduced motion snaps poses and removes the continuous animation loop. The operating-system setting and in-app control both need real-browser checks.
- The renderer caps pixel ratio and frame cadence, pauses background/off-screen work, reduces optional detail under sustained slow frames, and batches only eligible static opaque scenery.
- Teardown cancels animation, removes listeners/observers and owned DOM, and disposes owned resources. Repeated view changes must not accumulate contexts or state.

These are implementation intentions with source/lifecycle tests, not frame-rate, battery, screen-reader, or visual-quality guarantees. Fine tile engravings may be decorative at small sizes; the flat map and textual state are the dependable reference.

## Repository artwork

`docs/assets/wordmark.svg` is a code-native brand composition reusing the project's Pip/lantern icon from `public/icon.svg`. It is not an application screenshot or evidence of gameplay. Keep original artwork provenance and dependency notices intact; a license for original code and art has not yet been selected.
