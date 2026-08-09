# Mir MD Muhtasim Hasan — portfolio

Next.js 15 (App Router) · TypeScript · Tailwind v4 installed, styling done with
semantic classes in `app/globals.css`.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # zero TypeScript errors, zero warnings
npm start
```

## Dependencies

`next`, `react`, `react-dom`. That is the whole runtime tree.

No three.js, no react-three-fiber, no GSAP, no scroll library. Both animated
things are raw WebGL written against the shaders in the brief:

| | |
|---|---|
| `components/FluidField.tsx` | The metaball field. One fixed canvas behind the page, drawn as a single full-screen triangle. Pointer tracked on `window`, not the canvas — the panels sit on top and would swallow every move. |
| `components/DeviceTile.tsx` | The tilting device. Two triangles drawn twice a frame: reflection first (`u_mirror = 1`), then the device. Blend on, depth off. Used three times — once for About, once per project. |

**First Load JS: 109 kB** (target was under 130).

## Where the content lives

Everything is in one typed object, `lib/content.ts`. Components read from it;
nothing is hard-coded in JSX. Change a sentence there and it changes everywhere.

## The four traps in §6, and where they are handled

1. **`generateMipmap` and non-power-of-two textures.** The 2400×1500 screenshot
   is drawn into a 2048×2048 canvas before upload (`TiltShowcase.tsx`, `build()`).
   The quad is 16:10 with 0–1 UVs, so squaring it is undone exactly on the way
   out — and the mipmaps actually build instead of leaving the texture
   incomplete and sampling black.
2. **`UNPACK_FLIP_Y_WEBGL` is never set.** The UVs already put `v = 0` at the
   quad's top edge, which is the image's own origin.
3. **`p.x / u_aspect` off a portrait viewport.** `fit = Math.min(1.38, (0.92 *
   aspect) / 0.8)` is multiplied into `u_scale`, so the device fits to whichever
   axis is tighter — the aspect term is the width limit, the cap is the height
   limit. The cap is 1.38 rather than the brief's 1.0 because the device was
   asked to be bigger; at 360×780 the width term binds and gives 0.53. Verified
   at 360 px.
4. **Secondary text is solid, never ink at an alpha.** `--ink-dim` `#2e2b35`
   and `--ink-faint` `#3a3742`. Nothing lighter than `#3a3742` is used.

## Contrast

`--ink-faint` is legible on the frosted panel but not on the bare field over
the field's deep stop (`#2d283e`), so **all copy is either on a panel or on a
wash.** Section headings live inside their panel for this reason.

The projects are the exception: their spec sheets sit on the field with no card
at all, using `.on-field`. That is a flat `rgba(245,243,239,0.55)` band with no
blur, so it costs nothing, and both its vertical and horizontal fades finish
exactly where the copy starts — a band with hard sides just reads as the card it
exists not to be. Over the field's darkest stop the copy measures `--ink` at
6.47:1 and `--ink-dim` at 4.89:1; `--ink-faint` reaches only 4.10:1, so
`.on-field` overrides it away. The wash is on the full-width `.section` and
sized with `100%`, never `100vw` — `vw` includes the scrollbar and would push
the document wider than the viewport.

The hero has no card. It gets the §7 paper wash: a flat `rgba(245,243,239,0.55)`
band that fades only above and below the copy. A radial wash thins out under the
ends of the longest line and drops `--ink-dim` below 4.5:1 there; a full-bleed
band cannot. Hero copy stays on `--ink` and `--ink-dim` only.

## Performance discipline

- DPR capped at 1.5 (field) and 2 (device).
- Adaptive resolution on both: below ~44 fps the render scale drops toward 0.6,
  above ~56 fps it recovers.
- Each device's loop is parked by an IntersectionObserver when its section
  leaves the viewport, and every loop parks on `visibilitychange`. The delta
  clock is reset on resume so parked time does not arrive as one enormous frame.
- **The devices do not all hold their textures at once.** A 2048×2048 mipmapped
  RGBA texture is about 21 MB, and three resident is not a phone-sized number.
  A second observer at `rootMargin: 100%` builds a tile's GPU resources as it
  comes within a viewport and deletes them when it goes two away. Measured by
  patching `createTexture`/`deleteTexture`: live textures peak at **2 of 3**
  across a full scroll of the page, never 3.
- After a resize while parked, each canvas repaints once by hand.
- `backdrop-filter` at a 7 px radius, on at most the navbar and one panel at a
  time. Panels never nest.
- The nav label's opacity is quantised before it is written, so a filter/layer
  change is not fed a fresh fractional value every frame.

**Context loss is recovered from**, not surrendered to. Both canvases rebuild
their program, buffers and texture on `webglcontextrestored` and resume; while
the context is gone they show their fallback. A driver reset on a mid-range
phone is a normal event, not the end of the session.

## Accessibility and fallbacks

- `prefers-reduced-motion: reduce` — the device renders once, upright, and its
  loop never starts. The field slows to 0.28×. The pointer light is not just
  disabled, its listeners are never attached: verified at 0 `pointermove`
  listeners under reduced motion and 0 on a coarse pointer, against 3 on a
  normal desktop.
- No WebGL — the field falls back to the CSS gradient painted on `.field`; the
  device falls back to the screenshot in a rounded bordered box at the same size.
- No JavaScript — every section is server-rendered. The screenshot is the
  device's default state, so nothing waits for a script to be revealed.
- **The About copy exists twice on purpose.** The device's screen shows it as
  pixels, and a picture of words is not words — so the copy is also real text
  in `.about-readable`. Above 900px that block is visually hidden (clipped, not
  `display: none`), so screen readers, search engines and "view source" all
  still get it. Below 900px the device is far too small to read, so the block
  is an ordinary visible panel instead. The switch is a media query, so nothing
  moves after paint and nothing depends on a script having run.
- One `h1`, one `h2` per section, `h3` per project. Skip link first in the tab
  order. Focus ring is `2px solid var(--ink)` with a `var(--paper)` halo so it
  survives any colour the field puts behind it. Every canvas is `aria-hidden`.
- The navbar repeated over the device's top edge is decorative: `aria-hidden`
  and `tabIndex={-1}`, so it does not duplicate links in the tab order.

## Verified in a browser, not by eye

Measured on the production build in Edge:

- `npm run build`: zero TypeScript errors, zero warnings.
- Zero console errors, warnings, or failed requests.
- **CLS 0 on a warm cache; 0.0079 on a cold one.** The cold-cache figure is the
  web font landing and the centred hero re-centring around it. Fixing the boxes
  does not remove it — Chrome scores the text moving inside a stable box — so
  with centred type and `font-display: swap` there is no route to 0. It is 13x
  inside Google's 0.1 threshold, and `display: "optional"` in `app/layout.tsx`
  buys a literal 0 at the price of first-time visitors seeing the fallback
  face. Measured over six cold loads, not assumed.
- `scrollWidth === clientWidth` at 360, 768, 1440 and 2560 px, checked by
  resizing a live page and scrolling through it at each width.
- Device `drawArrays` **+0** while its section is off screen; **+0** for both
  canvases while the tab is hidden. Counted by patching
  `WebGLRenderingContext.prototype.drawArrays`, not by looking.
- Reduced motion: device +0 draws, rendered upright with no transform.
- Forced context loss on both canvases via `WEBGL_lose_context`: fallbacks
  appear, then both rebuild and resume drawing.
- Tab order follows visual order; focus ring present on every stop.

## The device screens

Three shots, all 2400×1500 at 16:10 so they land on the quad without a crop:

| File | What it is | Size |
|---|---|---|
| `public/showcase.webp` | The About copy, captured from this site | 134 kB |
| `public/projects/zubayer.webp` | zubayer.life, captured live | 41 kB |
| `public/projects/renttime.webp` | rent-time-bd.web.app, captured live | 78 kB |

The project tiles show the real sites — that is what a device mockup is for.
Their copy is not in the picture, so it follows each tile as an ordinary panel.
Their `alt` text describes the screenshot properly; the About shot's `alt` is
empty because it only pictures copy that is real text in the same section.

### Regenerating the About shot

`public/showcase.webp` is a capture of the About Me copy below it, taken from
the running site at a 960×600 viewport
with `deviceScaleFactor: 2.5` (960 keeps `.about-grid` in two columns; its
breakpoint is 900). Three things have to be true of the capture:

- `.showcase` is hidden, or the device appears inside its own screen.
- The `.panel` surface — background, `backdrop-filter`, shadow — is stripped,
  so the screen shows the copy on the field rather than a card inside a card.
- The field drifts, so the copy can land on a dark stop. Park the pointer in an
  empty corner (its blob is the largest one) and take a spread of moments, then
  keep the frame where the copy sits on light ground.

WebP, not PNG: the field shader adds per-pixel noise, which is close to
incompressible. The same frame is **2.3 MB** as a PNG and ~134 kB as WebP q85,
with no visible artefacts on the text. A 2.3 MB hero image would make §"Write
it, don't install it" a lie.

Any 2400×1500 16:10 image can replace it — set `about.shot` in
`lib/content.ts`. Keep the `alt` text describing what the screen shows, since
that is what a screen reader gets in place of the picture.

## One placeholder to replace

| File | What it is |
|---|---|
| `public/resume.pdf` | A one-page placeholder so the hero's second button does not 404. |

`lib/content.ts` also carries `LinkedIn → TODO, no URL yet`, rendered as plain
text rather than a dead link. Give it an `href` and it becomes a link.
