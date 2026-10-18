import { describe, expect, it } from "@jest/globals";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from "three";

import { DEFAULT_VIEW, getPreviewCamera, preparePreviewModels } from "../../features/terrain/preview-models";

function terrain(x: number) {
  const root = new Group();
  root.position.set(x, 2, -3);
  root.rotation.y = Math.PI / 6;
  root.add(new Mesh(new BoxGeometry(10, 2, 8), new MeshBasicMaterial()));
  return root;
}

describe("terrain preview placement and framing", () => {
  it("retains both imported transforms without changing cached source materials", () => {
    const current = terrain(-20);
    const target = terrain(30);
    const currentMaterial = (current.children[0] as Mesh).material;
    const targetMaterial = (target.children[0] as Mesh).material;
    const models = preparePreviewModels(current, target);
    try {
      expect(models.current.position.equals(current.position)).toBe(true);
      expect(models.target.position.equals(target.position)).toBe(true);
      expect(models.current.quaternion.equals(current.quaternion)).toBe(true);
      expect(models.target.quaternion.equals(target.quaternion)).toBe(true);
      expect(models.bounds.min.x).toBeLessThan(-20);
      expect(models.bounds.max.x).toBeGreaterThan(30);
      expect((current.children[0] as Mesh).material).toBe(currentMaterial);
      expect((target.children[0] as Mesh).material).toBe(targetMaterial);
      expect((models.current.children[0] as Mesh).geometry).toBe((current.children[0] as Mesh).geometry);
    } finally {
      models.dispose();
    }
  });

  it.each([0.5, 1, 2])("fits the combined terrain bounds at aspect ratio %s", (aspect) => {
    const models = preparePreviewModels(terrain(-20), terrain(30));
    try {
      const frame = getPreviewCamera(models.sphere, aspect, DEFAULT_VIEW);
      const camera = new PerspectiveCamera(45, aspect, frame.near, frame.far);
      camera.position.copy(frame.position);
      camera.lookAt(frame.target);
      camera.updateMatrixWorld();
      for (const x of [models.bounds.min.x, models.bounds.max.x]) {
        for (const y of [models.bounds.min.y, models.bounds.max.y]) {
          for (const z of [models.bounds.min.z, models.bounds.max.z]) {
            const point = new Vector3(x, y, z).project(camera);
            expect(Math.abs(point.x)).toBeLessThan(1);
            expect(Math.abs(point.y)).toBeLessThan(1);
            expect(Math.abs(point.z)).toBeLessThan(1);
          }
        }
      }
    } finally {
      models.dispose();
    }
  });

  it("rejects empty model pairs", () => {
    expect(() => preparePreviewModels(new Group(), new Group())).toThrow("usable geometry");
  });
});
