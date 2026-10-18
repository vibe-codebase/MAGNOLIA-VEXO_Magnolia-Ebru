# Magnolia Ebru

## Core loop
Each pattern is a recipe of steps.
- **Drop step:** hold anywhere on the bath to pour. The ink spreads at a steady 34 units per second (measured by the clock, not the frame rate), and you let go when it fills the dashed ring.
- **Stroke step:** drag along the dashed arrow. The stylus, or a comb with several tines, then travels your line and drags the ink with it.

After the last step the paper is laid down and lifted, and the print is scored.

## Marbling model
- Ink is a set of disjoint closed polylines on the bath.
- **Drop** at c with radius r: p' = c + (p − c)·√(1 + r²/|p − c|²). This conserves the area of all existing ink.
- **Stroke** from A to B: points move along the stroke by z·Σ 2^(−|d − oₖ|/fall)·w(t).
  - d is the perpendicular distance from the stroke, and oₖ are the tine offsets.
  - w(t) is a smooth window along the stroke. Its ramp length is ≥ 1.9·z·peak, so the map stays a bijective shear.
  - Partial strokes, which make the tulips, are therefore well defined.
- **Refinement:** edges are subdivided in the pre-image whenever the mapped segment would exceed 2.2 units. Points closer than 0.55 units are merged.
- **Animation:** strokes animate the stylus front along the line. Drops animate the radius.

## Grounds
From the sixth pattern onward the bath is first laid with a battal of pale stones (45 drops, seeded). The player's ink pushes the stones aside. The ground is identical in the player's bath and in the target, and it is excluded from scoring.

## Scoring
- Both baths are rasterised to 80×100 cells.
- **Likeness** is the share of inked cells whose colours agree. A cell also counts as agreeing when each colour appears within one cell of the other, so boundaries one cell out are forgiven.
- **Thresholds** (tools/stars.ts) come from a simulated hand over 12 tries:
  - 3 tulips: the steady hand's mean minus 0.035 (σ position 3, radius 2.2, stroke ends 4).
  - 1 tulip: halfway between the shaky hand (7 / 5 / 10) and the sloppy hand (14 / 9 / 20).
  - 2 tulips: 45% of the way down from three tulips to one.

## Chapters
1. **Battal:** drops only. Rings, crowding, and the first ground of stones.
2. **Tarak:** the stylus (hearts, arrowheads, ripple) and combs (chevrons, gel-git, peacock).
3. **Çiçek:** tulips, carnation, daisy, hyacinth, iris and a garden, made with strokes that stop inside the drops.

## Feel
- Dashed guides are drawn dark on light grounds and light on dark ones. The ring turns red once the pour overshoots.
- Undo steps back one action.
- The HUD shows the step list, how true the bath is to the pattern at the current step, and a thumbnail of the finished pattern.
- Attract mode marbles six showcase recipes in a loop.
