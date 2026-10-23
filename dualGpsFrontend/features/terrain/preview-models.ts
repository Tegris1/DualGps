import {
  Box3,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Sphere,
  Vector3,
} from "three";
import { terrainColors } from "./theme";

export const CURRENT_COLOR = terrainColors.currentTerrain;
export const TARGET_COLOR = terrainColors.accent;
export const DEFAULT_VIEW = { yaw: Math.PI / 4, elevation: Math.PI / 5, zoom: 1 };
export type PreviewView = typeof DEFAULT_VIEW;

export function preparePreviewModels(currentSource: Object3D, targetSource: Object3D) {
  // Clone the hierarchy, retaining imported transforms and cached geometry.
  const current = currentSource.clone(true);
  const target = targetSource.clone(true);
  const currentMaterial = new MeshStandardMaterial({
    color: CURRENT_COLOR, side: DoubleSide, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  const targetMaterial = new MeshBasicMaterial({
    color: TARGET_COLOR, side: DoubleSide, wireframe: true,
    // The design overlay stays visible even below the current surface.
    depthTest: false, depthWrite: false,
  });

  current.traverse((node) => {
    if (node instanceof Mesh) node.material = currentMaterial;
  });
  target.traverse((node) => {
    if (node instanceof Mesh) {
      node.material = targetMaterial;
      node.renderOrder = 1;
    }
  });

  const dispose = () => {
    currentMaterial.dispose();
    targetMaterial.dispose();
  };
  const bounds = new Box3().setFromObject(current).union(new Box3().setFromObject(target));
  const sphere = bounds.getBoundingSphere(new Sphere());
  if (bounds.isEmpty() || !Number.isFinite(sphere.radius) || sphere.radius <= 0) {
    dispose();
    throw new Error("The terrain models do not contain usable geometry.");
  }
  return { current, target, bounds, sphere, dispose };
}

export function getPreviewCamera(sphere: Sphere, aspect: number, view: PreviewView) {
  const verticalHalfFov = Math.PI / 8; // 45-degree vertical field of view.
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
  const distance = sphere.radius / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov))
    * 1.15 * view.zoom;
  const direction = new Vector3(
    Math.cos(view.elevation) * Math.sin(view.yaw),
    Math.sin(view.elevation),
    Math.cos(view.elevation) * Math.cos(view.yaw),
  );
  return {
    position: direction.multiplyScalar(distance).add(sphere.center),
    target: sphere.center,
    near: Math.max(0.01, sphere.radius / 1000),
    far: distance + sphere.radius * 10,
  };
}
