import { Vector3 } from "three";
import { getCity, type Footprint } from "./lib/city";
import { BALCONY_DEPTH, CONTENT_LOTS, CREDENTIAL_LIP } from "./lib/contentBuildings";
import { applyFocus } from "./lib/cameraFocus";
import { sampleCamera } from "./lib/paths";
import { progressToStop } from "./lib/stopMap";
const all: (Footprint & { tag: string })[] = [...getCity().footprints.map((f) => ({ ...f, tag: f.frontage ? `frontage a=${f.frontage.a.toFixed(3)}` : "grid" })), ...CONTENT_LOTS.map((l) => ({ x: l.position.x, z: l.position.z, sx: l.depth + 2 * (l.id === "about" ? BALCONY_DEPTH : CREDENTIAL_LIP), sz: l.width, yaw: l.yaw, top: l.top, roof: l.top, tag: l.id }))];
let worst = Infinity, info = "";
const P = new Vector3(), L = new Vector3();
for (let i = 0; i <= 6000; i++) {
  const p = i / 6000; sampleCamera(progressToStop(p), P, L); applyFocus(p, P, L);
  for (const f of all) { if (P.y > f.top + 4) continue; const dx = P.x - f.x, dz = P.z - f.z, c = Math.cos(f.yaw), s = Math.sin(f.yaw); const lx = dx * c - dz * s, lz = dx * s + dz * c; const d = Math.hypot(Math.max(Math.abs(lx) - f.sx / 2, 0), Math.max(Math.abs(lz) - f.sz / 2, 0)); if (d < worst) { worst = d; info = `${f.tag} at progress ${p.toFixed(4)} stop ${progressToStop(p).toFixed(3)}`; } }
}
console.log(worst.toFixed(2), info);
