import { expect, it, jest } from "@jest/globals";
import { Box3, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from "three";
import { createExcavator } from "../../features/demo/excavator-model";

it("grounds the excavator on transformed terrain and exposes the bucket edge in world coordinates", () => {
  const terrain = new Group();
  const surface = new Mesh(new PlaneGeometry(40, 20), new MeshBasicMaterial());
  surface.rotation.x = -Math.PI / 2;
  terrain.add(surface);
  terrain.position.set(100, 7, -50);
  terrain.rotation.y = Math.PI / 6;
  terrain.scale.setScalar(2);
  const excavator = createExcavator(terrain);
  try {
    expect(excavator.model.position.y).toBeCloseTo(7);
    expect(new Box3().setFromObject(excavator.model).min.y).toBeCloseTo(7);
    const tip = excavator.bucketTip.getWorldPosition(new Vector3());
    expect(tip.x).toBeGreaterThan(excavator.model.position.x);
    expect(tip.y).toBeGreaterThan(7);
    expect(terrain.children).toEqual([surface]);
    const geometry = (excavator.model.children[0] as Mesh).geometry;
    const dispose = jest.spyOn(geometry, "dispose");
    excavator.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  } finally {
    surface.geometry.dispose();
    (surface.material as MeshBasicMaterial).dispose();
  }
});

it("rejects empty terrain and a footprint with no ground beneath it", () => {
  expect(() => createExcavator(new Group())).toThrow("footprint");
  const terrain = new Group();
  const geometry = new PlaneGeometry(4, 4);
  const material = new MeshBasicMaterial();
  for (const x of [-10, 10]) {
    const patch = new Mesh(geometry, material);
    patch.rotation.x = -Math.PI / 2;
    patch.position.x = x;
    terrain.add(patch);
  }
  try { expect(() => createExcavator(terrain)).toThrow("No current terrain surface"); }
  finally { geometry.dispose(); material.dispose(); }
});
