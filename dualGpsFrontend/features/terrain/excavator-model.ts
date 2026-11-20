import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Raycaster,
  Vector3,
} from "three";
import type { ArmAngles } from "@/lib/imu/imu-protocol";

export const DEFAULT_ARM_ANGLES: ArmAngles = {
  boom: Math.atan2(1.68, 0.85) * 180 / Math.PI,
  arm: Math.atan2(-1.85, 1.1) * 180 / Math.PI,
  bucket: Math.atan2(-0.71, 0.725) * 180 / Math.PI,
};

// Presentation proportions, scaled to the terrain footprint; not surveyed dimensions.
export function createExcavator(terrain: Object3D) {
  terrain.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(terrain);
  const size = bounds.getSize(new Vector3());
  const scale = Math.min(size.x, size.z) * 0.09;
  if (bounds.isEmpty() || !Number.isFinite(scale) || scale <= 0) {
    throw new Error("The current terrain has no usable excavator footprint.");
  }
  const origin = bounds.getCenter(new Vector3());
  origin.x -= size.x * 0.12;
  origin.y = bounds.max.y + Math.max(size.y, scale);
  const hit = new Raycaster(origin, new Vector3(0, -1, 0)).intersectObject(
    terrain,
    true,
  )[0];
  if (!hit)
    throw new Error("No current terrain surface beneath the excavator.");

  const model = new Group();
  model.name = "Excavator";
  model.position.copy(hit.point);
  model.scale.setScalar(scale);
  model.rotation.y = Math.PI / 4;
  const yellow = new MeshStandardMaterial({
    color: "#f5b51b",
    roughness: 0.65,
  });
  const dark = new MeshStandardMaterial({ color: "#263341", roughness: 0.9 });
  const glass = new MeshStandardMaterial({ color: "#87bccc", roughness: 0.25 });
  const geometries: (BoxGeometry | CylinderGeometry)[] = [];
  function part(
    geometry: BoxGeometry | CylinderGeometry,
    material: MeshStandardMaterial,
    position: Vector3,
  ) {
    geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.renderOrder = 2;
    model.add(mesh);
    return mesh;
  }
  function box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material = yellow,
  ) {
    return part(new BoxGeometry(w, h, d), material, new Vector3(x, y, z));
  }
  function link(
    start: Vector3,
    end: Vector3,
    width: number,
    material = yellow,
  ) {
    const mesh = part(
      new BoxGeometry(width, start.distanceTo(end), width),
      material,
      start.clone().add(end).multiplyScalar(0.5),
    );
    mesh.quaternion.setFromUnitVectors(
      new Vector3(0, 1, 0),
      end.clone().sub(start).normalize(),
    );
    return mesh;
  }
  for (const z of [-0.66, 0.66]) {
    box(2.1, 0.5, 0.42, 0, 0.25, z, dark);
    for (const x of [-0.68, 0, 0.68]) {
      const wheel = part(
        new CylinderGeometry(0.19, 0.19, 0.44, 12),
        dark,
        new Vector3(x, 0.25, z),
      );
      wheel.rotation.x = Math.PI / 2;
    }
  }
  box(1.85, 0.5, 1.45, -0.1, 0.75, 0);
  box(0.85, 0.55, 1.35, -0.65, 1.08, 0);
  box(0.8, 1.05, 0.72, -0.18, 1.5, 0.34, dark);
  box(0.65, 0.72, 0.74, -0.18, 1.6, 0.34, glass);
  box(0.9, 0.12, 0.85, -0.18, 2.07, 0.34);
  const shoulder = new Vector3(0.5, 1.12, -0.25);
  const elbow = new Vector3(1.35, 2.8, -0.25);
  const wrist = new Vector3(2.45, 0.95, -0.25);
  const boomMesh = link(shoulder, elbow, 0.3);
  const armMesh = link(elbow, wrist, 0.23);
  const boomHydraulic = link(
    new Vector3(0.25, 1.15, -0.25),
    new Vector3(1.1, 2.35, -0.25),
    0.1,
    dark,
  );
  const armHydraulic = link(new Vector3(1.5, 2.5, -0.25), new Vector3(2.2, 1.4, -0.25), 0.08, dark);
  const bucketParts = [box(0.65, 0.15, 0.8, 2.65, 0.35, -0.25, dark),
    box(0.18, 0.65, 0.8, 2.38, 0.62, -0.25)];
  for (const z of [-0.65, 0.15]) bucketParts.push(box(0.65, 0.48, 0.08, 2.65, 0.52, z));
  for (const z of [-0.52, -0.25, 0.02])
    bucketParts.push(box(0.25, 0.12, 0.12, 3.05, 0.3, z, dark));
  const bucketTip = new Object3D();
  bucketTip.name = "Bucket cutting edge";
  bucketTip.position.set(3.175, 0.24, -0.25);
  model.add(bucketTip);
  const boomLength = shoulder.distanceTo(elbow);
  const armLength = elbow.distanceTo(wrist);
  const boomPivot = new Group();
  boomPivot.name = "Boom hinge";
  boomPivot.position.copy(shoulder);
  boomPivot.rotation.z = DEFAULT_ARM_ANGLES.boom * Math.PI / 180;
  model.add(boomPivot);
  const armPivot = new Group();
  armPivot.name = "Arm hinge";
  armPivot.position.x = boomLength;
  armPivot.rotation.z = (DEFAULT_ARM_ANGLES.arm - DEFAULT_ARM_ANGLES.boom) * Math.PI / 180;
  boomPivot.add(armPivot);
  const bucketPivot = new Group();
  bucketPivot.name = "Bucket hinge";
  bucketPivot.position.x = armLength;
  bucketPivot.rotation.z = (DEFAULT_ARM_ANGLES.bucket - DEFAULT_ARM_ANGLES.arm) * Math.PI / 180;
  armPivot.add(bucketPivot);
  model.updateMatrixWorld(true);
  boomPivot.attach(boomMesh);
  armPivot.attach(armMesh);
  [...bucketParts, bucketTip].forEach((part) => bucketPivot.attach(part));
  model.updateMatrixWorld(true);

  function updateHydraulic(mesh: Mesh<BoxGeometry | CylinderGeometry>, start: Vector3, end: Vector3) {
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.scale.y = start.distanceTo(end) / mesh.geometry.parameters.height;
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), end.clone().sub(start).normalize());
  }

  function setArmAngles(angles: ArmAngles | null | undefined) {
    const value = angles === undefined ? DEFAULT_ARM_ANGLES : angles;
    const available = value !== null && Object.values(value).every((angle) => Number.isFinite(angle) && Math.abs(angle) <= 180);
    boomPivot.visible = boomHydraulic.visible = armHydraulic.visible = available;
    if (!available || !value) return;
    const a = value.boom * Math.PI / 180;
    const b = value.arm * Math.PI / 180;
    const c = value.bucket * Math.PI / 180;
    boomPivot.rotation.z = a;
    armPivot.rotation.z = b - a;
    bucketPivot.rotation.z = c - b;
    const nextElbow = shoulder.clone().add(new Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar(boomLength));
    const nextWrist = nextElbow.clone().add(new Vector3(Math.cos(b), Math.sin(b), 0).multiplyScalar(armLength));
    updateHydraulic(boomHydraulic, new Vector3(0.25, 1.15, -0.25), shoulder.clone().lerp(nextElbow, 0.73));
    updateHydraulic(armHydraulic, shoulder.clone().lerp(nextElbow, 0.82), nextElbow.clone().lerp(nextWrist, 0.76));
    model.updateMatrixWorld(true);
  }
  return {
    model,
    bucketTip,
    arm: boomPivot,
    setArmAngles,
    dispose: () => {
      geometries.forEach((geometry) => geometry.dispose());
      [yellow, dark, glass].forEach((material) => material.dispose());
    },
  };
}
