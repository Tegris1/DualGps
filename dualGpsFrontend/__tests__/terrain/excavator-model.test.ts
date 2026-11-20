import { expect, it, jest } from "@jest/globals";
import { Box3, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from "three";
import { createExcavator, DEFAULT_ARM_ANGLES } from "../../features/terrain/excavator-model";

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

it("converts absolute section inclinations into relative joints and moves the bucket without recreating geometry", () => {
  const surface = new Mesh(new PlaneGeometry(40, 20), new MeshBasicMaterial());
  surface.rotation.x = -Math.PI / 2;
  const excavator = createExcavator(surface);
  const tip = () => excavator.model.worldToLocal(excavator.bucketTip.getWorldPosition(new Vector3()));
  const boomLength = Math.hypot(0.85, 1.68);
  const armLength = Math.hypot(1.1, 1.85);
  const bucketLength = Math.hypot(0.725, 0.71);
  const geometry = (excavator.model.children[0] as Mesh).geometry;
  try {
    excavator.setArmAngles({ boom: 0, arm: 0, bucket: 0 });
    expect(tip().x).toBeCloseTo(0.5 + boomLength + armLength + bucketLength);
    expect(tip().y).toBeCloseTo(1.12);
    excavator.setArmAngles({ boom: 90, arm: 0, bucket: 0 });
    expect(tip().x).toBeCloseTo(0.5 + armLength + bucketLength);
    expect(tip().y).toBeCloseTo(1.12 + boomLength);
    excavator.setArmAngles({ boom: 90, arm: 0, bucket: -90 });
    expect(tip().x).toBeCloseTo(0.5 + armLength);
    expect(tip().y).toBeCloseTo(1.12 + boomLength - bucketLength);
    expect((excavator.model.children[0] as Mesh).geometry).toBe(geometry);
    excavator.setArmAngles(null);
    expect(excavator.arm.visible).toBe(false);
    excavator.setArmAngles(undefined);
    expect(excavator.arm.visible).toBe(true);
    expect(excavator.arm.rotation.z).toBeCloseTo(DEFAULT_ARM_ANGLES.boom * Math.PI / 180);
    expect(tip().toArray()).toEqual(expect.arrayContaining([expect.closeTo(3.175), expect.closeTo(0.24), expect.closeTo(-0.25)]));
  } finally {
    excavator.dispose();
    surface.geometry.dispose();
    (surface.material as MeshBasicMaterial).dispose();
  }
});
