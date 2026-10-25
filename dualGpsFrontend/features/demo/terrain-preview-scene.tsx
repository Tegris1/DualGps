import { Canvas, useLoader, useThree } from "@react-three/fiber/native";
import { Suspense, useEffect, useLayoutEffect, useMemo } from "react";
import { PerspectiveCamera } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { getPreviewCamera, preparePreviewModels, type PreviewView } from "./preview-models";

// GLTFLoader probes browser versions even with native texture loading. React
// Native exposes navigator without userAgent; identify it without claiming a browser.
if (typeof navigator !== "undefined" && typeof navigator.userAgent !== "string") {
  Object.defineProperty(navigator, "userAgent", { value: "ReactNative", configurable: true });
}

// Static requires let Metro include both GLBs in an installed offline build.
const CURRENT_MODEL = require("../../demo/Original.glb");
const TARGET_MODEL = require("../../demo/Target.glb");

export function clearTerrainPreviewCache() {
  useLoader.clear(GLTFLoader, [CURRENT_MODEL, TARGET_MODEL]);
}

type SceneProps = {
  view: PreviewView;
  showCurrent: boolean;
  showTarget: boolean;
  onLoaded: () => void;
};

function Terrains({ view, showCurrent, showTarget, onLoaded }: SceneProps) {
  const [current, target] = useLoader(GLTFLoader, [CURRENT_MODEL, TARGET_MODEL]);
  const models = useMemo(
    () => preparePreviewModels(current.scene, target.scene),
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

  useEffect(() => {
    onLoaded();
    return models.dispose;
  }, [models, onLoaded]);

  return (
    <>
      <primitive object={models.current} visible={showCurrent} dispose={null} />
      <primitive object={models.target} visible={showTarget} dispose={null} />
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
