import { expect, it } from "@jest/globals";
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, Object3D, Vector3 } from "three";
import { getBucketCrossSections, getTerrainCrossSection } from "../../features/terrain/terrain-cross-section";

function patch(indexed = true) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    -2, 0, -1, 2, 0, -1, 2, 0, 1, -2, 0, 1,
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  if (indexed) return new Mesh(geometry);
  const expanded = geometry.toNonIndexed();
  geometry.dispose();
  return new Mesh(expanded);
}

it.each([true, false])("slices a flat surface with indexed=%s relative to the bucket", (indexed) => {
  const mesh = patch(indexed);
  try {
    const segments = getTerrainCrossSection(mesh, new Vector3(1, 3, 0), new Vector3(5, 0, 0));
    expect(segments).toEqual([
      [{ distance: -3, elevation: 0 }, { distance: -1, elevation: 0 }],
      [{ distance: -1, elevation: 0 }, { distance: 1, elevation: 0 }],
    ]);
    expect(getTerrainCrossSection(mesh, new Vector3(0, 0, 2), new Vector3(1, 0, 0))).toEqual([]);
    expect(getTerrainCrossSection(new Group(), new Vector3(), new Vector3(1, 0, 0))).toEqual([]);
  } finally { mesh.geometry.dispose(); }
});

it("preserves nested transforms, slope and bucket heading for both surfaces without changing geometry", () => {
  const current = patch(false), target = patch();
  const parent = new Group(), bucket = new Object3D();
  parent.position.set(100, 7, -50);
  parent.rotation.y = Math.PI / 2;
  parent.scale.setScalar(2);
  current.rotation.z = Math.PI / 4;
  target.position.y = -1;
  bucket.position.y = 2;
  parent.add(current, target, bucket);
  const before = Array.from(current.geometry.getAttribute("position").array);
  try {
    const section = getBucketCrossSections(current, target, bucket);
    expect(section.bucket).toEqual({ distance: 0, elevation: 11 });
    expect(section.current).toHaveLength(2);
    for (const point of section.current.flat()) expect(point.elevation).toBeCloseTo(7 + point.distance);
    expect(Math.min(...section.current.flat().map((point) => point.distance))).toBeCloseTo(-Math.sqrt(8));
    expect(Math.max(...section.current.flat().map((point) => point.distance))).toBeCloseTo(Math.sqrt(8));
    for (const point of section.target.flat()) expect(point.elevation).toBeCloseTo(5);
    expect(section.target).toHaveLength(2);
    expect(Array.from(current.geometry.getAttribute("position").array)).toEqual(before);
  } finally { current.geometry.dispose(); target.geometry.dispose(); }
});

it("leaves disconnected patches separate instead of joining across missing ground", () => {
  const terrain = new Group(), left = patch(), right = patch();
  left.position.x = -5;
  right.position.x = 5;
  terrain.add(left, right);
  try {
    const segments = getTerrainCrossSection(terrain, new Vector3(), new Vector3(1, 0, 0));
    expect(segments).toHaveLength(4);
    expect(segments.every(([a, b]) => b.distance <= -3 || a.distance >= 3)).toBe(true);
  } finally { left.geometry.dispose(); right.geometry.dispose(); }
});

it("deduplicates shared edges, ignores point tangencies and skips coplanar triangles", () => {
  const mesh = patch();
  try {
    const segments = getTerrainCrossSection(mesh, new Vector3(), new Vector3(2, 0, 1));
    expect(segments).toHaveLength(1);
    expect(segments[0][0].distance).toBeCloseTo(-Math.sqrt(5));
    expect(segments[0][1].distance).toBeCloseTo(Math.sqrt(5));
    expect(getTerrainCrossSection(mesh, new Vector3(2, 0, -1), new Vector3(1, 0, 1))).toEqual([]);
    mesh.rotation.x = Math.PI / 2;
    expect(getTerrainCrossSection(mesh, new Vector3(), new Vector3(1, 0, 0))).toEqual([]);
  } finally { mesh.geometry.dispose(); }
});

it("rejects undefined or non-finite slice directions and origins", () => {
  const terrain = new Group();
  for (const direction of [new Vector3(), new Vector3(0, 1, 0), new Vector3(Infinity, 0, 1)]) {
    expect(() => getTerrainCrossSection(terrain, new Vector3(), direction)).toThrow("digging direction");
  }
  expect(() => getTerrainCrossSection(terrain, new Vector3(NaN, 0, 0), new Vector3(1, 0, 0))).toThrow("bucket position");
});
