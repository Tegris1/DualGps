import { expect, it, jest } from "@jest/globals";
import { act } from "react";
import { DemoProjectProvider, useDemoProject } from "../../features/demo/project-context";

jest.mock("../../demo/Original.glb", () => 11);
jest.mock("../../demo/Target.glb", () => 12);
const { create } = require("react-test-renderer");

it("requires a valid current surface, preserves it on invalid input, and resets for a new session", async () => {
  let project!: ReturnType<typeof useDemoProject>;
  function Probe() { project = useDemoProject(); return null; }
  const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  const originalError = console.error;
  const errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
  let root: ReturnType<typeof create>;
  try {
    await act(() => { root = create(<DemoProjectProvider key="first"><Probe /></DemoProjectProvider>); });
    expect(project.currentTerrain).toBeNull();
    await act(() => { expect(project.selectCurrentTerrain("missing")).toBe(false); });
    await act(() => { expect(project.selectCurrentTerrain("target")).toBe(false); });
    expect(project.currentTerrain).toBeNull();
    await act(() => { expect(project.selectCurrentTerrain("original")).toBe(true); });
    expect(project.currentTerrain?.asset).toBe(11);
    await act(() => { expect(project.selectCurrentTerrain("target")).toBe(false); });
    expect(project.currentTerrain?.id).toBe("original");
    await act(() => root.update(<DemoProjectProvider key="second"><Probe /></DemoProjectProvider>));
    expect(project.currentTerrain).toBeNull();
  } finally {
    await act(() => root?.unmount());
    errorSpy.mockRestore();
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
  }
});
