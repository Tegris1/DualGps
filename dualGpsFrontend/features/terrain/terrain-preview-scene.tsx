/* eslint-disable react/no-unknown-property -- React Three Fiber defines its own JSX properties. */
import { Canvas, useLoader, useThree } from "@react-three/fiber/native";
import { Suspense, useEffect, useLayoutEffect, useMemo } from "react";
import { PerspectiveCamera } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { getPreviewCamera, preparePreviewModels, type PreviewView } from "./preview-models";
import type { Terrain } from "./terrain-catalog";
import { createExcavator } from "./excavator-model";
import { getBucketCrossSections, type BucketCrossSections } from "./terrain-cross-section";

// GLTFLoader probes browser versions even with native texture loading. React
// Native exposes navigator without userAgent; identify it without claiming a browser.
if (typeof navigator !== "undefined" && typeof navigator.userAgent !== "string") {
  Object.defineProperty(navigator, "userAgent", { value: "ReactNative", configurable: true });
}

export function clearTerrainPreviewCache(current: Terrain, target: Terrain) {
  useLoader.clear(GLTFLoader, [current.asset, target.asset]);
}

type SceneProps = {
  currentTerrain: Terrain;
  targetTerrain: Terrain;
  view: PreviewView;
  showCurrent: boolean;
  showTarget: boolean;
  onLoaded: () => void;
  onCrossSection?: (section: BucketCrossSections) => void;
};

function Terrains({ currentTerrain, targetTerrain, view, showCurrent, showTarget, onLoaded, onCrossSection }: SceneProps) {
  const [current, target] = useLoader(GLTFLoader, [currentTerrain.asset, targetTerrain.asset]);
  const models = useMemo(
    () => {
      const terrain = preparePreviewModels(current.scene, target.scene);
      let excavator: ReturnType<typeof createExcavator> | undefined;
      try {
        excavator = createExcavator(terrain.current);
        terrain.bounds.expandByObject(excavator.model).getBoundingSphere(terrain.sphere);
        const machine = excavator;
        const crossSection = getBucketCrossSections(terrain.current, terrain.target, machine.bucketTip);
        return { ...terrain, excavator: machine, crossSection, dispose: () => { machine.dispose(); terrain.dispose(); } };
      } catch (error) {
        excavator?.dispose();
        terrain.dispose();
        throw error;
      }
    },
    [current.scene, target.scene],
  );
  const { camera, size, invalidate } = useThree();

  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const frame = getPreviewCamera(models.sphere, size.width / size.height, view);
    camera.position.copy(frame.position);
    camera.lookAt(frame.target);
    camera.near = frame.near;
    camera.far = frame.far;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, models, size.width, size.height, view]);

  useEffect(() => () => models.dispose(), [models]);

  useEffect(() => {
    onCrossSection?.(models.crossSection);
    onLoaded();
  }, [models, onLoaded, onCrossSection]);

  return (
    <>
      <primitive object={models.current} visible={showCurrent} dispose={null} />
      <primitive object={models.target} visible={showTarget} dispose={null} />
      <primitive object={models.excavator.model} dispose={null} />
      <gridHelper
        args={[models.sphere.radius * 3, 12, "#94a3b8", "#cbd5e1"]}
        position={[models.sphere.center.x, models.bounds.min.y - 0.1, models.sphere.center.z]}
      />
    </>
  );
}

export function TerrainPreviewScene(props: SceneProps) {
  return (
    <Canvas camera={{ fov: 45 }} frameloop="demand" gl={{ antialias: false }}>
      <color attach="background" args={["#edf2f6"]} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[30, 60, 20]} intensity={2} />
      <Suspense fallback={null}>
        <Terrains {...props} />
      </Suspense>
    </Canvas>
  );
}
