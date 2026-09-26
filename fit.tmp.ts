import { PerspectiveCamera, Vector3 } from "three";
import { buildBazaar } from "./lib/bazaar";
import { sampleCamera } from "./lib/paths";
import { sectionIndex } from "./lib/sections";
import { tools } from "./data/tools";
const zoneSec = { frontend: "toolset", backend: "gali", server: "roof" } as const;
for (const [w, h] of [[1280, 800], [1366, 768], [1440, 900], [1920, 1080]]) {
  const signs = buildBazaar(w, h);
  const out: string[] = [];
  for (const zone of ["frontend", "backend", "server"] as const) {
    const pos = new Vector3(), look = new Vector3();
    sampleCamera(sectionIndex(zoneSec[zone]), pos, look);
    const cam = new PerspectiveCamera(55, w / h, 2, 2000); cam.position.copy(pos); cam.lookAt(look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const zs = signs.filter((s) => s.zone === zone);
    let minX = 1e9, maxX = -1e9, minH = 1e9, maxH = 0; const t = new Vector3();
    for (const s of zs) {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const u of [-s.width / 2, s.width / 2]) for (const v of [-s.height / 2, s.height / 2]) {
        t.set(s.position.x + u * Math.cos(s.yaw), s.position.y + v, s.position.z - u * Math.sin(s.yaw)).project(cam);
        const px = (t.x * 0.5 + 0.5) * w, py = (-t.y * 0.5 + 0.5) * h;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      minX = Math.min(minX, x0); maxX = Math.max(maxX, x1);
      const hh = zone === "backend" ? x1 - x0 : y1 - y0; minH = Math.min(minH, hh); maxH = Math.max(maxH, hh);
    }
    const total = tools.filter((x) => x.zone === zone).length;
    out.push(`${zone} ${zs.length}/${total} x ${(minX / w * 100).toFixed(0)}-${(maxX / w * 100).toFixed(0)}% size ${(maxH / minH).toFixed(2)}x rows ${[...new Set(zs.map((s) => s.position.y.toFixed(1)))].join("/")}`);
  }
  console.log(`${w}x${h}: ${out.join(" | ")}`);
}
