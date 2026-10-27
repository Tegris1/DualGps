import { Mesh, Object3D, Vector3 } from "three";

export type SectionPoint = { distance: number; elevation: number };
export type SectionSegment = [SectionPoint, SectionPoint];
export type BucketCrossSections = {
  current: SectionSegment[];
  target: SectionSegment[];
  bucket: SectionPoint;
};
const EPSILON = 1e-6; // World-coordinate tolerance; no assumption that source units are metres.

// Independent triangle intersections preserve gaps and overlapping surface layers.
// Coplanar triangles intersect in an area, so they have no unique profile and are skipped.
export function getTerrainCrossSection(terrain: Object3D, origin: Vector3, diggingDirection: Vector3) {
  const direction = new Vector3(diggingDirection.x, 0, diggingDirection.z);
  if (![...origin.toArray(), ...direction.toArray()].every(Number.isFinite) || direction.length() <= EPSILON) {
    throw new Error("A finite bucket position and horizontal digging direction are required.");
  }
  direction.normalize();
  const normal = new Vector3(-direction.z, 0, direction.x);
  const segments: SectionSegment[] = [];
  const seen = new Set<string>();
  terrain.updateWorldMatrix(true, true);
  terrain.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const positions = node.geometry.getAttribute("position");
    if (!positions) return;
    const index = node.geometry.getIndex();
    const count = index ? index.count : positions.count;
    for (let i = 0; i + 2 < count; i += 3) {
      const vertices = [0, 1, 2].map((offset) => node.getVertexPosition(
        index ? index.getX(i + offset) : i + offset, new Vector3(),
      ).applyMatrix4(node.matrixWorld));
      const distances = vertices.map((point) => normal.dot(point.clone().sub(origin)));
      if (distances.every((distance) => Math.abs(distance) <= EPSILON)) continue;
      const hits: Vector3[] = [];
      function add(point: Vector3) {
        if (!hits.some((hit) => hit.distanceToSquared(point) <= EPSILON ** 2)) hits.push(point);
      }
      for (let edge = 0; edge < 3; edge++) {
        const next = (edge + 1) % 3;
        const a = distances[edge], b = distances[next];
        if (Math.abs(a) <= EPSILON) add(vertices[edge]);
        if ((a < -EPSILON && b > EPSILON) || (a > EPSILON && b < -EPSILON)) {
          add(vertices[edge].clone().lerp(vertices[next], a / (a - b)));
        }
      }
      if (hits.length !== 2 || hits[0].distanceToSquared(hits[1]) <= EPSILON ** 2) continue;
      const points = hits.map((point) => ({ distance: direction.dot(point.clone().sub(origin)), elevation: point.y }))
        .sort((a, b) => a.distance - b.distance || a.elevation - b.elevation) as SectionSegment;
      const key = points.map((point) => `${Math.round(point.distance / EPSILON)},${Math.round(point.elevation / EPSILON)}`).join(";");
      if (!seen.has(key)) { seen.add(key); segments.push(points); }
    }
  });
  return segments.sort((a, b) => a[0].distance - b[0].distance || a[0].elevation - b[0].elevation);
}

export function getBucketCrossSections(current: Object3D, target: Object3D, bucketTip: Object3D): BucketCrossSections {
  bucketTip.updateWorldMatrix(true, false);
  const origin = bucketTip.getWorldPosition(new Vector3());
  // The procedural excavator digs along local +X; retain its world heading.
  const direction = new Vector3(1, 0, 0).transformDirection(bucketTip.matrixWorld);
  return {
    current: getTerrainCrossSection(current, origin, direction),
    target: getTerrainCrossSection(target, origin, direction),
    bucket: { distance: 0, elevation: origin.y } satisfies SectionPoint,
  };
}
