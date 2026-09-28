# Neon Dhaka Portfolio: Build Spec

Portfolio for Mir MD Muhtasim Hasan, full-stack developer, Mohammadpur, Dhaka.
A dark site where a scroll-driven camera flies through a neon wireframe Dhaka, from night to dawn.

Read this file before every phase. Do only the phase you are asked to do.

## 1. Stack

- Next.js (App Router) + TypeScript + Tailwind
- three, @react-three/fiber, @react-three/drei, @react-three/postprocessing
- gsap + ScrollTrigger
- lenis (smooth scroll)
- maath (frame-rate independent damping)
- All free. No paid tools, no paid assets.

## 2. Colors (Bangladesh flag, night to dawn)

| Token | Hex | Use |
|---|---|---|
| bg-night | #0A0F0C | Page and sky at start |
| bg-dawn | #10281B | Sky at the contact scene |
| line-base | #1E2A24 | Normal building edges |
| green | #22C55E | Main color: name, buttons, road, signs, billboard frames |
| red | #F43F5E | Rare accent for moments: tail-light trails, one blinking traffic signal, the horizon glow toward Contact, the About screen cursor, the toolset cable pulse, the rising sun. Never in the hero. Never on buttons or body text |
| window | #F5E6C8 | Warm window light, not neon |
| text | #EDEDED | Main text |
| text-2 | #9AA69F | Secondary text |

Golden rule: 70% dark, 20% building lines, 10% neon.

Line hierarchy: generated buildings are line-base. Bright green only on the road and on buildings that carry section content. Exponential fog fades far lines into the background; floor lines and rooftop details fade out by about 130 m so distant lines never moire.

## 3. Scroll and camera rules (most important)

The camera moves ONLY by scroll. It never moves on its own (a tiny idle float is fine).

- Lenis smooth scroll, synced to the GSAP ticker. A mouse-wheel notch moves about two thirds as far as the browser default; touchpad scrolling stays at its natural speed.
- One master scroll progress value, 0 to 1, from a tall scroll container (about 1650vh on desktop with four featured projects; its height is computed from the section weights).
- Camera position and camera look target each follow their own CatmullRomCurve3 (centripetal). No straight line jumps between points.
- Progress goes through a stop map before sampling the curves. Each section has a hold zone where the camera is almost still (about 40% of that section's scroll range) and eased travel zones between holds.
- Sections can have different scroll weights. About and Credentials get 1.8x because their holds play scroll-driven sequences, and the Toolset has three holds of 1.1x each (one per zone); the hold stays about 40% of each section's range. Extra weight makes the page longer, it never shortens other sections.
- In-scene sequences (windows switching off, floors drawing, typing) are pure functions of master progress, so they reverse exactly. Inside a hold, a small scroll-driven push toward a focus point is allowed (About: 2.6 m toward the last lit window), added to the sampled target before damping.
- Camera clearance: at least 8.5 m from any building, balconies included, along the whole path. Street-level camera keys sit on the road center at eye height with the look target at eye level. Geometry closer than 2 m to the camera is never drawn (near plane).
- Each section's text sits on a dark scrim in the emptiest part of its frame. No lines cross text.
- Every frame, damp the camera position and the look target separately toward their sampled points (maath easing.damp3). Never set lookAt to a jumping target.
- No camera roll. Limit turn speed so nothing feels sudden.
- Scrolling up reverses the path exactly.
- No scroll hijacking. The scrollbar and keyboard scrolling work normally. No snap by default.
- HTML section content (text, cards, form) fades in and out from the same master progress, not from IntersectionObserver.
- prefers-reduced-motion: no fly-through. Soft fade cuts between stop frames.
- Target 60fps on a mid laptop. Keep a debug overlay (toggle with a key) showing progress, current section and fps.

## 4. Sections and camera stops

1. Hero: night Dhaka from the sky, a dense skyline with buildings packed close and varied heights. "Hi. I'm Muhtasim." floats in the sky with "Full-stack developer, Mohammadpur, Dhaka", a green "Available for work" badge and a Resume button (public/resume.pdf). Small Shaheed Minar silhouette far on the skyline (left of the title, beyond the city): its real shape in thin dim lines, a tall central frame whose top bends forward and two shorter frames each side on a stepped platform; still, no colour, no fog, no bloom, no effects. Pure night: no red in the hero.
2. About, "lockdown night": the camera dives to street level in front of a Mohammadpur house (floors, grilled balconies, window grills, a ground-floor gate, roof parapet, stair room, water tanks). As the camera arrives, many windows in the city are lit warm. Windows sit flush on the road-facing walls in a regular grid (one row per floor, even columns, about 1.2 x 1.5 m); not every building has them and not every window is lit; far ones shrink to dots and none turn into large squares near the camera. On scroll they switch off in small clusters by building and floor until only one window of the house stays on. The camera moves a little toward it. Inside the window, a dark silhouette of a person at a desk with a laptop glow (shape only); the window casts a faint warm light on the wall below and the balcony beside it. A thin green leader line draws from the window to one clean card styled as a small code editor (top bar with three dots and "index.html", faint line numbers, solid dark background, hairline border, no radial backing); a small light dot travels along the line from window to card on a loop, placed beside the house, clear of the road and the house's lines. In the card: first the code types "<h1>Hello</h1>" with a red cursor, then a small mono label "2020 · lockdown", then "I picked up HTML during lockdown, out of boredom." After a short beat, "I never put it down." appears larger and in green, the strongest line, and the red cursor moves to the end of it and keeps blinking. All driven by scroll; reverses on scroll up.
3. Credentials, "building myself": the next building, set back 3 m behind the sidewalk with an empty plot beside it on the road side. At arrival only the foundation shows. On scroll each floor draws itself line by line from the bottom (including a balcony edge), then its credential lights up in green and hangs from the balcony edge as a banner that unrolls. A Dhaka-style construction signboard on legs stands on the plot beside the building, toward the road, facing the camera: PROJECT What I studied, DEVELOPER Muhtasim, STARTED 2023, STATUS. STATUS follows the build: Foundation, Floor 1, Floor 2, then "Still building" in green with a slow blink once all floors are done. No separate heading. The hold frames all banners and the board. Chronological from the bottom: Front-End Development with React (2023), B.Sc. Computer Science and Engineering (2025), Digital Marketing, EDGE ICT Division (2025). Reverses on scroll up.
4. Toolset: the tech stack street (see section 5).
5. Projects: an overhead highway gantry sign before the Hatirjheel bridge, then one hold per billboard (see section 6).
6. Contact: the road ends at Sangsad Bhaban across the lake, from the Blender model public/models/sangsad-bhaban.glb (metres, origin at the octagon centre, detailed facade on +X turned to face the Contact camera, scaled 0.72 to fit the framing): crease edges (EdgesGeometry, 20 degrees) in green, faces filled with the live background colour so back lines stay hidden, and thin horizontal lines every 1.5 m around every mass at 0.3 opacity for the marble strips. As the camera arrives (all scroll-driven, reversible): rain and stars fade out, a red sun (#F43F5E) rises straight out of the lake behind the octagon (clipped at the water line, a soft glow backlighting the building while it is hidden, its mirrored reflection in the lake), clears the octagon roof and settles in the sky just above it, the sky and fog shift from bg-night to bg-dawn, the lake mirrors the building and carries a red shimmer under the sun (one sun only, in the sky; no mirrored disc in the water). Green building + red sun + lake reflection = a living flag. "Say hello" fades in as soon as the sun clears the roof, in one clean card low on the screen (solid dark at 85%, thin green border at 0.3, 12 px corners, info left and form right, stacked on phone; fields with a dark fill, green border at 0.4, full green on focus, light placeholders; no blurred backing) so the whole building and its reflection stay visible above it, below the building and sun, with email, phone, GitHub, location and the form (name, email, message). Contact has 1.6x scroll weight; the nav lands after the sunrise. The sun's halo is small (about 1.5x its radius) and faint so the disc reads crisp. At the Contact hold the visitor can drag Sangsad Bhaban (grab / grabbing cursor over the building) to turn it around its vertical axis, up to 60 degrees each way, damped, easing back to the front view on release; the sun, shimmer and camera stay put and page scroll works as normal. A small "Drag to turn" hint under the building fades after the first drag. On touch, a horizontal swipe on the building turns it while vertical swipes still scroll (canvas touch-action: pan-y). Dragging never starts on the contact card.

Red hints after the hero, building toward the sunrise: red tail-light trails moving away on the road (left lane; Dhaka drives on the left), a blinking red traffic signal at one bend, and a faint red glow on the horizon behind Sangsad Bhaban that grows a little each section up to the gantry, stays barely visible over the bridge (the glow is in linear light: tiny values still read as red after sRGB encoding), and at Contact follows the sun: it peaks exactly as the sun clears the horizon, then settles into the dawn. The toolset cable pulse is red too.

Navigation: a minimal top nav (About, Work, Contact) scrolls to each stop with Lenis. About lands at the end of its sequence with the text showing.

Atmosphere (phase 5):
- Bloom, desktop only: a luminance threshold lets only neon lines, signs, billboard frames, lamps and lit windows glow softly; line-base building edges stay dim. Billboard screenshots are dimmed to just under the threshold so a bright site never glares.
- Window flicker: outside the About sequence about 13% of city windows stay lit (dimmer than the lockdown moment, never closer than about 70 m); a few of those switch now and then or flicker like a failing tube. The About sequence owns every window while it plays: no flicker there.
- Rickshaw trails: slower (2.6 to 4.4 m/s) and lower than cars, near the kerb in both lanes, each with a small warm front lamp and a red tail lamp leaving short trails; fading out near the camera; not in the hero.
- Light rain: thin diagonal streaks in a volume that travels with the camera, denser near it, fading with the fog and never right at the lens. Rain is drawn first and without depth, so every sign, billboard, card and label paints over it; DOM text sits above the canvas.
- Wet road: a soft green sheen along the green road edges, and faint mirrored streaks under the neon signs and the gantry that follow each sign's brightness (and fade out near the camera).
- Phone: no bloom, about 400 rain streaks (desktop about 1400). Reduced motion: no bloom, no rain.

City rules: buildings are generated by code (merged EdgesGeometry, no modeling). Dhaka feel comes from details: shop signboards, rickshaw light trails, flickering windows, light rain. Max 3 landmarks: Shaheed Minar (hero silhouette), Hatirjheel bridge, Sangsad Bhaban (finale). Sangsad Bhaban gets an accurate model (Blender from reference photos, or a checked free model), shown as wireframe edges.

## 5. Toolset: tech stack

- Tools are grouped by zone, one stretch of street after another: Frontend street (shop boards stacked by floor on the building fronts on both sides, like a Dhaka market; all within a narrow distance range so no board is more than 1.5x the smallest on screen, all inside the middle 90% of the screen width), Backend gali (one neat row of tall signs on the right), Server roof (one straight row of signs side by side on a rooftop edge on the left, square to the camera, same size and height, no stair-step). The Toolset has one camera hold per zone, in that order; the Server roof hold stands past the end of the gali (its signs are behind the camera) and looks up at the rooftop row. The bazaar stretch is low shop-houses (3 to 5 floors) so rooftop signs stay in view.
- Layout rules, solved in code for the actual viewport: at each hold every sign of that zone faces the camera, has the same size and height as the rest of its zone, and is evenly spaced as seen from the hold; none sits under the title or caption, none is cut by the screen edge, none overlaps another sign in front of it (a dimmed sign of another zone may stand hidden behind one); every name is measured after layout and scaled to fit its board beside the icon, with padding; every sign's inner edge stays at least 8.9 m from the road center. Signs light during their zone's hold, nearest first. At each Toolset hold only that zone's signs stay bright; the other zones dim to about 30%, and to about 10% when close to the camera or at the Server roof hold. The zone captions use full text contrast.
- Each sign shows the tool logo drawn as a neon tube line plus the name. Use crisp text rendering (drei Text), never blurry textures.
- Logo tubes are thin and sharp: a thin green tube with a bright near-white-green core and a thin soft halo. Logos and names are excluded from the bloom pass (inverted selective bloom), so glow never fills the gaps inside a logo; road lines, windows and billboard frames bloom as before. Logos that simple-icons ships as filled silhouettes (React, TypeScript) use single-stroke neon paths.
- Signs start off (dim). When the camera comes near (scroll-driven, nearest first), or on hover, a sign flickers on like a tube light (2 to 3 flickers, then steady). Optional tiny "tick" sound, off by default, with a mute toggle in the nav.
- No heading block. A neon gate arches over the road at the entrance (posts 8.75 m from the road center): big neon letters "MY TECH STACK" and a small plate below, "Tools I use to design, build and ship websites." The camera passes under it.
- Each zone has a small two-line street plate, lit while its hold is active: "Frontend / What users see", "Backend & Data / What runs behind it", "Deploy & DevOps / Where it goes live". The informal zone names (bazaar, street, gali, roof) never appear on the page.
- Hover only makes a sign glow brighter (no card). A small pill at the bottom center, "Click a sign to trace it to the work.", fades after the first click.
- Brightness shows experience: more used tools glow brighter. No numbers, no progress bars.
- Click a sign: a red light pulse travels along an overhead neon cable beside the road toward the Hatirjheel bridge, and the billboards of projects that used this tool light up.
- Phone: signs become a grid. Tap = flicker on, and a bottom panel shows "used in".

## 6. Projects: Hatirjheel bridge

- No corner heading. An overhead green highway gantry sign over the road before the bridge is the heading: "PROJECTS ↑ Things I shipped" with a small green "EXIT 05" tab on top of its right corner, one row per featured project with a live distance in km that counts down as the camera moves (map scale: 1 world metre reads as 20 m), and "All projects →". A row turns bright green at 0.0 km. Clicking a row scrolls (Lenis) to that billboard's hold; "All projects" opens /projects.
- The bridge is a curved Hatirjheel-style deck over water (railings, piers, curved lamp posts, faint reflections); no buildings on the water.
- Billboards are placed automatically from data/projects.ts, alternating right and left, facing their hold camera, inner edge 8.9 m from the road center. One camera hold per billboard.
- Only projects with featured: true go on the bridge. Max 5. The bridge length, the page and the camera path grow with the count (sections are generated from the data).
- The end of the bridge has a small neon sign "All projects" linking to /projects, a dark grid page with every project. It stands just past the last billboard, fully in frame beside it, and fades on only at that hold. The gantry fades in on the way to its hold.
- Billboards show screenshots (webp, captured with headless Chrome at 1440 x 900). Featured ones may use a short muted video loop (5 to 8 seconds). No live iframes.
- Hover: a glow around the frame, turning slightly red. Click: a detail panel with what, stack, infra and link (Esc or leaving the bridge closes it).
- Nothing stands between the camera and the focused billboard at any billboard hold (checked by projecting every pole, lamp, leg and building edge). The Neon Bazaar cable ends before the bridge, since any line along the road converges into the billboards; over the water the red pulse runs along the deck's center line, lights each matching billboard as it passes, and climbs to the farthest one.
- Screenshots are dimmed evenly, just under the bloom threshold. Decorative blur layers on a site (such as Zubayer.life's .orb) are hidden when capturing, so they don't read as a smudge on the billboard.
- Phone: normal card list over the skyline background.

## 7. Data files

data/projects.ts
```ts
export type Project = {
  slug: string;
  name: string;
  year: number;
  status: "Live" | "In progress";
  what: string;
  stack: string[];      // tool names, must match data/tools.ts
  infra?: string;
  url: string;
  image: string;        // /projects/<slug>.webp
  video?: string;       // optional loop
  featured: boolean;
};
```

data/tools.ts
```ts
export type Tool = {
  name: string;
  zone: "frontend" | "backend" | "server";
  logo: string;         // svg path used for the neon tube
  level: 1 | 2 | 3;     // brightness
};
```
"Used in" is computed from projects[].stack, so adding a project connects its tools automatically.

Starting content (featured projects appear on the bridge in array order: Agent Wise X, Zubayer.life, Crimson & Co, RentTime):
- Agent Wise X (2026, Live): full website for a Dhaka growth agency, with services, free tools with PDF reports, guides, news, an admin panel and lead capture. Stack: Next.js, JavaScript, PostgreSQL, Prisma, Docker. Infra: Docker on a Hetzner VPS, Postgres, Backblaze B2 storage, JWT auth with Google sign-in. https://agentwisex.com
- Crimson & Co (2026, Live): Shopify store for an old-money menswear brand in Bangladesh, with custom theme sections, bundle offers, reviews and cash on delivery. Stack: Shopify, Liquid, JavaScript. https://shopcrimson.co
- Zubayer.life (2026, Live): portfolio and living archive for a Dhaka filmmaker and brand consultant, content-managed through Sanity. Stack: Next.js, TypeScript, Sanity, Tailwind, Nginx, PM2, Git. Infra: Node behind Nginx on a self-provisioned VPS, PM2, auto-renewing certificates. https://zubayer.life
- RentTime (2025, Live): rental marketplace where listing and availability stay honest while several users act at once. Stack: React, JavaScript, Tailwind, Firebase, Node.js, Git. https://rent-time-bd.web.app/
- Tools: React, Next.js, TypeScript, JavaScript, Tailwind, Figma, SEO, Shopify, Liquid (Frontend street); Node.js, Firebase, Sanity, PHP, MySQL, PostgreSQL, Prisma (Backend gali); Nginx, PM2, Git, Docker (Server roof). Logos come from simple-icons; SEO and Liquid use simple custom paths.
- Contact: mirmuhtasimhasan@gmail.com, +880 1906 042275, github.com/mirmuhtasimhasan-dev, Mohammadpur, Dhaka, GMT+6.

## 8. Phone version

- No fly-through.
- A static wireframe Dhaka skyline at the bottom with gentle parallax on scroll and randomly flickering windows.
- Sections scroll normally on top.
- Toolset: sign grid. Projects: card list.
- Contact: static Sangsad Bhaban front view in green, the red sun rises a little on scroll, form below.

## 9. Performance rules

- Merge building geometry. Instance repeated objects.
- Bloom on desktop only. Device pixel ratio max 1.5.
- Load text content first, load the canvas after with a dynamic import (ssr: false).
- Pause rendering when the tab is hidden or the canvas is off screen.
- Test on an old Android phone before calling any phase done.

## 10. Phases

1. Scaffold + city generator + road + camera splines + scroll system + stop map + placeholder section overlays + debug overlay.
2. Real section content synced to camera stops.
3. Neon Bazaar toolset.
4. Hatirjheel bridge + auto billboards + /projects page.
5. Glow, window flicker, rickshaw trails, rain.
6. Landmarks: Sangsad Bhaban finale with sunrise, then Hatirjheel bridge shape, then Shaheed Minar silhouette.
7. Phone version + reduced motion version.
8. Loader, SEO meta, performance pass, final testing.

## 11. Done means

- Scrolling feels smooth with mouse wheel, touchpad and keyboard. No jumps, no jitter.
- Scrolling back reverses exactly.
- Steady 60fps on a mid laptop, no overheating on phone.
- Adding a project or tool needs only a data file edit.
