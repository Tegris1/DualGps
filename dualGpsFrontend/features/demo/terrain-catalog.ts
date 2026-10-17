// Static references keep model resources bundled with the Android app.
export const TERRAIN_CATALOG = [
  { id: "original", name: "Original terrain", filename: "Original.glb", role: "current", asset: require("../../demo/Original.glb") },
  { id: "target", name: "Target design", filename: "Target.glb", role: "target", asset: require("../../demo/Target.glb") },
] as const;

export type DemoTerrain = typeof TERRAIN_CATALOG[number];

export function getCurrentTerrain(id: string | null) {
  return TERRAIN_CATALOG.find((terrain) => terrain.id === id && terrain.role === "current") ?? null;
}

export function getTargetTerrain(id: string | null) {
  return TERRAIN_CATALOG.find((terrain) => terrain.id === id && terrain.role === "target") ?? null;
}
