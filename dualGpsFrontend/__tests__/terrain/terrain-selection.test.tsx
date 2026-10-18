import { expect, it, jest } from "@jest/globals";
import { act } from "react";
import { Text } from "react-native";

import CurrentTerrainSelection from "../../app/current-terrain";
import TargetTerrainSelection from "../../app/target-terrain";
import { OFFLINE_ACCOUNT, OfflineSessionProvider, useOfflineSession } from "../../features/auth/offline-session-context";
import { TerrainProjectProvider, useTerrainProject } from "../../features/terrain/project-context";

jest.mock("../../assets/terrain/Original.glb", () => 11);
jest.mock("../../assets/terrain/Target.glb", () => 12);
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: require("react-native").View }));

const mockRouter = { push: jest.fn(), navigate: jest.fn() };
const { create } = require("react-test-renderer");

it("selects both terrain roles through the shared UI, follows renamed routes, and supports change and sign-out", async () => {
  let project!: ReturnType<typeof useTerrainProject>;
  let session!: ReturnType<typeof useOfflineSession>;
  function Probe() {
    project = useTerrainProject();
    session = useOfflineSession();
    return null;
  }
  function App({ target = false }: { target?: boolean }) {
    return (
      <OfflineSessionProvider>
        <TerrainProjectProvider>
          <Probe />
          {target ? <TargetTerrainSelection /> : <CurrentTerrainSelection />}
        </TerrainProjectProvider>
      </OfflineSessionProvider>
    );
  }

  const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  const originalError = console.error;
  const errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
  let root: ReturnType<typeof create>;
  function button(label: string) {
    const match = root.root.findAll((node: any) =>
      node.props.accessibilityRole === "button" && typeof node.props.onPress === "function",
    ).find((node: any) =>
      node.findAllByType(Text).some((text: any) => text.props.children === label),
    );
    expect(match).toBeDefined();
    return match;
  }
  function options() {
    return root.root.findAll((node: any) =>
      node.props.accessibilityRole === "radio" && typeof node.props.onPress === "function",
    );
  }

  try {
    await act(() => { root = create(<App />); });
    await act(() => { session.signIn(OFFLINE_ACCOUNT.email, OFFLINE_ACCOUNT.password); });
    expect(button("Choose target terrain").props.disabled).toBe(true);
    expect(options()).toHaveLength(1);
    expect(options()[0].props.accessibilityLabel).toBe("Original.glb");
    expect(options()[0].props.accessibilityState.checked).toBe(false);

    await act(() => options()[0].props.onPress());
    expect(project.currentTerrain?.id).toBe("original");
    expect(options()[0].props.accessibilityState.checked).toBe(true);
    expect(button("Choose target terrain").props.disabled).toBe(false);
    await act(() => button("Choose target terrain").props.onPress());
    expect(mockRouter.push).toHaveBeenLastCalledWith("/target-terrain");

    await act(() => root.update(<App target />));
    expect(button("Open preview").props.disabled).toBe(true);
    expect(options()).toHaveLength(1);
    expect(options()[0].props.accessibilityLabel).toBe("Target.glb");
    await act(() => options()[0].props.onPress());
    expect(project.targetTerrain?.id).toBe("target");
    expect(button("Open preview").props.disabled).toBe(false);
    await act(() => button("Open preview").props.onPress());
    expect(mockRouter.push).toHaveBeenLastCalledWith("/terrain-preview");

    const changeCurrent = root.root.find(
      (node: any) => node.props.accessibilityLabel === "Change current terrain" && typeof node.props.onPress === "function",
    );
    await act(() => changeCurrent.props.onPress());
    expect(mockRouter.navigate).toHaveBeenLastCalledWith("/current-terrain");
    await act(() => root.update(<App />));
    expect(options()[0].props.accessibilityState.checked).toBe(true);
    expect(project.targetTerrain?.id).toBe("target");
    await act(() => button("Sign out").props.onPress());
    expect(session.isSignedIn).toBe(false);
  } finally {
    await act(() => root?.unmount());
    errorSpy.mockRestore();
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
  }
});
