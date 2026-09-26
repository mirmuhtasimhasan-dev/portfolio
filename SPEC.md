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

- Lenis smooth scroll, synced to the GSAP ticker.
- One master scroll progress value, 0 to 1, from a tall scroll container (about 900vh on desktop).
- Camera position and camera look target each follow their own CatmullRomCurve3 (centripetal). No straight line jumps between points.
- Progress goes through a stop map before sampling the curves. Each section has a hold zone where the camera is almost still (about 40% of that section's scroll range) and eased travel zones between holds.
- Sections can have different scroll weights. About and Credentials get 1.8x because their holds play scroll-driven sequences; the hold stays about 40% of each section's range.
- In-scene sequences (windows switching off, floors drawing, typing) are pure functions of master progress, so they reverse exactly. Inside a hold, a small scroll-driven push toward a focus point is allowed (About: 3 m toward the last lit window), added to the sampled target before damping.
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

1. Hero: night Dhaka from the sky, a dense skyline with buildings packed close and varied heights. "Hi. I'm Muhtasim." floats in the sky with "Full-stack developer, Mohammadpur, Dhaka", a green "Available for work" badge and a résumé button (public/resume.pdf). Small Shaheed Minar silhouette far on the skyline, silhouette only, respectful, no effects on it. Pure night: no red in the hero.
2. About, "lockdown night": the camera dives to street level in front of a Mohammadpur house (floors, grilled balconies, window grills, a ground-floor gate, roof parapet, stair room, water tanks). As the camera arrives, most windows in the city are lit warm. On scroll they switch off one by one until only one window of the house stays on. The camera moves a little toward it. Inside, a screen glow types "<h1>Hello</h1>" with a red cursor. Then the About text fades in: he picked up HTML during lockdown out of boredom and never put it down. Reverses on scroll up.
3. Credentials, "building myself": the next building. At arrival only the foundation shows. On scroll each floor draws itself line by line from the bottom, then its credential lights up in green with a label. Chronological from the bottom: Front-End Development with React (2023), B.Sc. Computer Science and Engineering (2025), Digital Marketing, EDGE ICT Division (2025). Reverses on scroll up.
4. Toolset: the Neon Bazaar (see section 5).
5. Projects: Hatirjheel curved bridge with billboards (see section 6).
6. Contact: the road ends at Sangsad Bhaban across the lake. As the camera arrives, a red sun rises behind the building. Green building + red sun + lake reflection = a living flag. Sky shifts from bg-night to bg-dawn, stars fade out, red shimmer on the water. Then "Say hello" appears with email, phone, GitHub, location and the form (name, email, message).

Red hints after the hero, building toward the sunrise: red tail-light trails moving away on the road (left lane; Dhaka drives on the left), a blinking red traffic signal at one bend, and a faint red glow on the horizon behind Sangsad Bhaban that grows a little each section toward Contact. The toolset cable pulse is red too.

Navigation: a minimal top nav (About, Work, Contact) scrolls to each stop with Lenis. About lands at the end of its sequence with the text showing.

City rules: buildings are generated by code (merged EdgesGeometry, no modeling). Dhaka feel comes from details: shop signboards, rickshaw light trails, flickering windows, light rain. Max 3 landmarks: Shaheed Minar (hero silhouette), Hatirjheel bridge, Sangsad Bhaban (finale). Sangsad Bhaban gets an accurate model (Blender from reference photos, or a checked free model), shown as wireframe edges.

## 5. Toolset: Neon Bazaar

- Tools are grouped by zone along the street: Frontend street (shop signboards), Backend gali (tall narrow signs), Server roof (signs on rooftops).
- Each sign shows the tool logo drawn as a neon tube line plus the name. Use crisp text rendering (drei Text), never blurry textures.
- Signs start off (dim). When the camera comes near, or on hover, a sign flickers on like a tube light (2 to 3 flickers, then steady). Optional tiny "tick" sound, off by default, with a mute toggle.
- Brightness shows experience: more used tools glow brighter. No numbers, no progress bars.
- Click a sign: a red light pulse travels along a neon cable beside the road toward the Hatirjheel bridge, and the billboards of projects that used this tool light up.
- Phone: signs become a grid. Tap = flicker on, and a bottom panel shows "used in".

## 6. Projects: Hatirjheel bridge

- Billboards are placed automatically from data/projects.ts, alternating right and left.
- Only projects with featured: true go on the bridge. Max 5. The bridge length and camera path grow with the count.
- The end of the bridge has a small neon sign "All projects" linking to /projects, a normal grid page with every project.
- Billboards show screenshots (webp). Featured ones may use a short muted video loop (5 to 8 seconds). No live iframes.
- Hover: frame glows, turning slightly red. Click: a detail panel with what, stack, infra and link.
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

Starting content:
- Zubayer.life (2026, Live): portfolio and living archive for a Dhaka filmmaker and brand consultant, content-managed through Sanity. Stack: Next.js, TypeScript, Sanity, Tailwind. Infra: Node behind Nginx on a self-provisioned VPS, PM2, auto-renewing certificates. https://zubayer.life
- RentTime (2025, Live): rental marketplace where listing and availability stay honest while several users act at once. Stack: React, Tailwind, Firebase, Firestore, Node.js. https://rent-time-bd.web.app/
- Tools: React, Next.js, TypeScript, JavaScript, Tailwind, Sanity, Firebase, Node.js, PHP, MySQL, Nginx, PM2, Git, Figma, SEO.
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
