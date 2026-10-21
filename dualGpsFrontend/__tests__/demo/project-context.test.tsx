import { expect, it, jest } from "@jest/globals";
import { act } from "react";
import { TerrainProjectProvider, useTerrainProject } from "../../features/demo/project-context";

jest.mock("../../demo/Original.glb", () => 11);
jest.mock("../../demo/Target.glb", () => 12);
const { create } = require("react-test-renderer");

it("requires two distinct role-valid surfaces, preserves selections on invalid input, and resets for a new session", async () => {
  let project!: ReturnType<typeof useTerrainProject>;
  function Probe() { project = useTerrainProject(); return null; }
  const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  const originalError = console.error;
  const errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
  let root: ReturnType<typeof create>;
  try {
    await act(() => { root = create(<TerrainProjectProvider key="first"><Probe /></TerrainProjectProvider>); });
    expect(project.currentTerrain).toBeNull();
    expect(project.targetTerrain).toBeNull();
    await act(() => { expect(project.selectTargetTerrain("target")).toBe(false); });
    await act(() => { expect(project.selectCurrentTerrain("missing")).toBe(false); });
    await act(() => { expect(project.selectCurrentTerrain("target")).toBe(false); });
    expect(project.currentTerrain).toBeNull();
    await act(() => { expect(project.selectCurrentTerrain("original")).toBe(true); });
    expect(project.currentTerrain?.asset).toBe(11);
    await act(() => { expect(project.selectTargetTerrain("original")).toBe(false); });
    await act(() => { expect(project.selectTargetTerrain("missing")).toBe(false); });
    expect(project.targetTerrain).toBeNull();
    await act(() => { expect(project.selectTargetTerrain("target")).toBe(true); });
    expect(project.targetTerrain?.asset).toBe(12);
    await act(() => { expect(project.selectTargetTerrain("missing")).toBe(false); });
    await act(() => { expect(project.selectCurrentTerrain("original")).toBe(true); });
    expect(project.targetTerrain?.id).toBe("target");
    await act(() => { expect(project.selectCurrentTerrain("target")).toBe(false); });
    expect(project.currentTerrain?.id).toBe("original");
    expect(project.targetTerrain?.id).toBe("target");
    await act(() => root.update(<TerrainProjectProvider key="second"><Probe /></TerrainProjectProvider>));
    expect(project.currentTerrain).toBeNull();
    expect(project.targetTerrain).toBeNull();
  } finally {
    await act(() => root?.unmount());
    errorSpy.mockRestore();
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
  }
});
