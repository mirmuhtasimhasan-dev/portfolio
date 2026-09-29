import { BufferAttribute, BufferGeometry, EdgesGeometry, type Mesh, type Object3D } from "three";

/*
 * Sangsad Bhaban from the Blender model (public/models/sangsad-bhaban.glb):
 * crease edges, face fills and 1.5 m marble bands, in model space. Shared by
 * the desktop finale (Landmarks) and the phone Contact view.
 */
export const MODEL_URL = "/models/sangsad-bhaban.glb";
export const EDGE_ANGLE = 20;
const BAND_STEP = 1.5;

export type SangsadParts = { fills: BufferGeometry[]; edges: BufferGeometry; bands: BufferGeometry };

/** Segments where the plane y = h cuts a triangle soup (non-indexed positions). */
function sliceAt(pos: ArrayLike<number>, h: number, out: number[]) {
  for (let i = 0; i < pos.length; i += 9) {
    const pts: number[][] = [];
    for (let k = 0; k < 3; k++) {
      const a = [pos[i + k * 3], pos[i + k * 3 + 1], pos[i + k * 3 + 2]];
      const b = [pos[i + ((k + 1) % 3) * 3], pos[i + ((k + 1) % 3) * 3 + 1], pos[i + ((k + 1) % 3) * 3 + 2]];
      if ((a[1] - h) * (b[1] - h) < 0) {
        const t = (h - a[1]) / (b[1] - a[1]);
        pts.push([a[0] + (b[0] - a[0]) * t, h, a[2] + (b[2] - a[2]) * t]);
      }
    }
    if (pts.length === 2) out.push(...pts[0], ...pts[1]);
  }
}

/*
 * East facade triangle cut-out (model space, from the Blender file): east
 * block at (63.14, 16.76, -2.61); triangle from local y -15.56 to -10.46,
 * z +-10.3; back wall at local x 6.46, facade front at 8.44.
 */
const EAST_BACK_X = 63.144 + 6.46;
const inTriangleRecess = (p: ArrayLike<number>, i: number) =>
  p[i + 1] > 16.76 - 15.6 && p[i + 1] < 16.76 - 10.4 && Math.abs(p[i + 2] + 2.6) < 10.4 && p[i] > EAST_BACK_X - 0.05;
const atBackWall = (p: ArrayLike<number>, i: number) => Math.abs(p[i] - EAST_BACK_X) < 0.05;

export function buildSangsadParts(root: Object3D): SangsadParts {
  root.updateMatrixWorld(true);
  const fills: BufferGeometry[] = [];
  const edgeArr: number[] = [];
  const bandArr: number[] = [];
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    g.deleteAttribute("normal");
    g.deleteAttribute("uv");
    fills.push(g);
    const edges = new EdgesGeometry(g, EDGE_ANGLE);
    const e = edges.attributes.position.array as Float32Array;
    const isEast = /East/.test(mesh.name);
    for (let i = 0; i < e.length; i += 6) {
      // The east triangle cut-out reads as one shape: skip its back-wall
      // outline and the short depth edges that join it to the front.
      if (isEast && inTriangleRecess(e, i) && inTriangleRecess(e, i + 3) && (atBackWall(e, i) || atBackWall(e, i + 3))) continue;
      edgeArr.push(e[i], e[i + 1], e[i + 2], e[i + 3], e[i + 4], e[i + 5]);
    }
    edges.dispose();
    // Marble strips: slice this mass every 1.5 m.
    const soup = g.index ? g.toNonIndexed() : g;
    const pos = soup.attributes.position.array as ArrayLike<number>;
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    for (let h = bb.min.y + BAND_STEP; h < bb.max.y - 0.2; h += BAND_STEP) sliceAt(pos, h, bandArr);
    if (soup !== g) soup.dispose();
  });
  const lines = (arr: number[]) => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(arr), 3));
    return geo;
  };
  return { fills, edges: lines(edgeArr), bands: lines(bandArr) };
}

