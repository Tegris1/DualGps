import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { Text } from "react-native";

import OfflineLogin from "../../app/offline-login";
import TerrainPreview, { ErrorBoundary } from "../../app/terrain-preview";
import { OFFLINE_ACCOUNT, OfflineSessionProvider, useOfflineSession } from "../../features/auth/offline-session-context";
import { TerrainProjectProvider, useTerrainProject } from "../../features/terrain/project-context";
import { DEFAULT_VIEW } from "../../features/terrain/preview-models";
import { clearTerrainPreviewCache, TerrainPreviewScene } from "../../features/terrain/terrain-preview-scene";
import { TerrainPreviewErrorView } from "../../features/terrain/components/terrain-preview-error-view";
import { SensorStatusCard } from "../../features/dashboard/components/sensor-status-card";
import { DashboardTerrainPanel } from "../../features/dashboard/containers/dashboard-terrain-panel";
import { useDashboardTerrain } from "../../features/dashboard/hooks/use-dashboard-terrain";

jest.mock("../../assets/terrain/Original.glb", () => 11);
jest.mock("../../assets/terrain/Target.glb", () => 12);
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: require("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons/MaterialIcons", () => "MaterialIcon");
jest.mock("../../features/terrain/terrain-preview-scene", () => ({
  TerrainPreviewScene: jest.fn(() => null), clearTerrainPreviewCache: jest.fn(),
}));

const mockRouter = { navigate: jest.fn() };
const retry = jest.fn(async () => {});
const { create } = require("react-test-renderer");
let root: ReturnType<typeof create>;
let project!: ReturnType<typeof useTerrainProject>;
let session!: ReturnType<typeof useOfflineSession>;
const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const originalError = console.error;
let errorSpy: ReturnType<typeof jest.spyOn>;

function Probe() {
  project = useTerrainProject();
  session = useOfflineSession();
  return null;
}

function App({ screen = "preview" }: { screen?: "preview" | "error" | "login" }) {
  return (
    <OfflineSessionProvider>
      <TerrainProjectProvider>
        <Probe />
        {screen === "login" ? <OfflineLogin /> : screen === "error"
          ? <ErrorBoundary error={new Error("Models unavailable")} retry={retry} />
          : <TerrainPreview />}
      </TerrainProjectProvider>
    </OfflineSessionProvider>
  );
}

beforeAll(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
});

beforeEach(() => { jest.clearAllMocks(); });
afterEach(async () => { await act(() => root?.unmount()); });
afterAll(() => {
  errorSpy.mockRestore();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
});

function button(label: string) {
  const found = root.root.findAll((node: any) =>
    node.props.accessibilityRole === "button" && typeof node.props.onPress === "function",
  ).find((node: any) => node.findAllByType(Text).some((text: any) => text.props.children === label));
  expect(found).toBeDefined();
  return found;
}

function labeledAction(label: string, callback: string) {
  return root.root.findAll((node: any) =>
    node.props.accessibilityLabel === label && typeof node.props[callback] === "function",
  )[0];
}

function scene() {
  const calls = jest.mocked(TerrainPreviewScene).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0];
}

async function mountPreview() {
  await act(() => { root = create(<App />); });
  await act(() => {
    session.signIn(OFFLINE_ACCOUNT.email, OFFLINE_ACCOUNT.password);
    project.selectCurrentTerrain("original");
  });
  await act(() => { project.selectTargetTerrain("target"); });
}

it("enables preview controls after loading and preserves rotation, zoom, top view, and reset actions", async () => {
  await mountPreview();
  const controls = ["Widok", "Reset"];
  await act(() => button("Menu").props.onPress());
  for (const label of controls) expect(button(label).props.disabled).toBe(true);
  await act(() => scene().onLoaded());
  const onLoaded = scene().onLoaded;
  for (const label of controls) expect(button(label).props.disabled).toBe(false);
  await act(() => button("Widok").props.onPress());

  await act(() => button("Obrót w lewo").props.onPress());
  expect(scene().view.yaw).toBeLessThan(DEFAULT_VIEW.yaw);
  await act(() => button("Obrót w prawo").props.onPress());
  expect(scene().view.yaw).toBeCloseTo(DEFAULT_VIEW.yaw);
  await act(() => button("Przybliż").props.onPress());
  expect(scene().view.zoom).toBeLessThan(DEFAULT_VIEW.zoom);
  await act(() => button("Oddal").props.onPress());
  expect(scene().view.zoom).toBeCloseTo(DEFAULT_VIEW.zoom);
  await act(() => button("Z góry").props.onPress());
  expect(scene().view.elevation).toBeGreaterThan(DEFAULT_VIEW.elevation);
  await act(() => labeledAction("Powrót do menu", "onPress").props.onPress());
  await act(() => button("Reset").props.onPress());
  expect(scene().view).toEqual(DEFAULT_VIEW);
  expect(scene().onLoaded).toBe(onLoaded);
});

it("keeps offline layers independent, changes terrain in place, and signs out from the offline menu", async () => {
  await mountPreview();
  const sensors = root.root.findByType(SensorStatusCard).props;
  expect(sensors.gnss).toHaveLength(2);
  expect(sensors.gnss.every((sensor: { source: string }) => sensor.source === "preset")).toBe(true);
  await act(() => scene().onLoaded());
  await act(() => button("Menu").props.onPress());
  await act(() => button("Warstwy").props.onPress());
  await act(() => labeledAction("Pokaż warstwę: Pomiar", "onValueChange").props.onValueChange(false));
  expect(scene().showCurrent).toBe(false);
  expect(scene().showTarget).toBe(true);
  await act(() => labeledAction("Pokaż warstwę: Projekt", "onValueChange").props.onValueChange(false));
  expect(scene().showTarget).toBe(false);
  await act(() => labeledAction("Pokaż warstwę: Pomiar", "onValueChange").props.onValueChange(true));
  expect(scene().showCurrent).toBe(true);
  expect(scene().showTarget).toBe(false);
  await act(() => labeledAction("Zmień warstwę: Pomiar", "onPress").props.onPress());
  await act(() => button("Dalej: wybierz projekt").props.onPress());
  await act(() => button("Otwórz podgląd").props.onPress());
  await act(() => button("Menu").props.onPress());
  await act(() => button("Warstwy").props.onPress());
  await act(() => labeledAction("Zmień warstwę: Projekt", "onPress").props.onPress());
  await act(() => button("Otwórz podgląd").props.onPress());
  expect(mockRouter.navigate).not.toHaveBeenCalled();
  expect(project.currentTerrain?.id).toBe("original");
  expect(project.targetTerrain?.id).toBe("target");
  await act(() => button("Menu").props.onPress());
  const menuText = root.root.findAllByType(Text).map((node: any) => node.props.children);
  expect(menuText).not.toContain("Połączenie z odbiornikiem");
  expect(menuText).not.toContain("Ustawienia");
  await act(() => button("Wyloguj").props.onPress());
  expect(session.isSignedIn).toBe(false);
});

it("clears the selected model cache before retrying and supports sign-out from the error controls", async () => {
  await mountPreview();
  await act(() => root.update(<App screen="error" />));
  await act(async () => { button("Retry").props.onPress(); });
  expect(clearTerrainPreviewCache).toHaveBeenCalledWith(project.currentTerrain, project.targetTerrain);
  expect(retry).toHaveBeenCalledTimes(1);
  expect(jest.mocked(clearTerrainPreviewCache).mock.invocationCallOrder[0]).toBeLessThan(retry.mock.invocationCallOrder[0]);
  await act(() => button("Sign out").props.onPress());
  expect(session.isSignedIn).toBe(false);
});

it("submits offline credentials through the shared primary button and clears an earlier sign-in error", async () => {
  await act(() => { root = create(<App screen="login" />); });
  await act(() => button("Sign in").props.onPress());
  expect(session.isSignedIn).toBe(false);
  expect(root.root.findAll((node: any) => node.props.accessibilityRole === "alert").length).toBeGreaterThan(0);
  await act(() => labeledAction("Email", "onChangeText").props.onChangeText(OFFLINE_ACCOUNT.email));
  await act(() => labeledAction("Password", "onChangeText").props.onChangeText(OFFLINE_ACCOUNT.password));
  await act(() => button("Sign in").props.onPress());
  expect(session.isSignedIn).toBe(true);
  expect(root.root.findAll((node: any) => node.props.accessibilityRole === "alert")).toHaveLength(0);
});

it("waits for both selected terrains before mounting the scene", async () => {
  await act(() => { root = create(<App />); });
  expect(TerrainPreviewScene).not.toHaveBeenCalled();
  await act(() => { project.selectCurrentTerrain("original"); });
  expect(TerrainPreviewScene).not.toHaveBeenCalled();
  await act(() => { project.selectTargetTerrain("target"); });
  expect(TerrainPreviewScene).toHaveBeenCalled();
  await act(() => button("Menu").props.onPress());
  expect(button("Widok").props.disabled).toBe(true);
});

it("recreates the canvas after navigation while retaining the selected models and camera", async () => {
  let terrain!: ReturnType<typeof useDashboardTerrain>;
  function Preview({ active }: { active: boolean }) {
    terrain = useDashboardTerrain();
    return <DashboardTerrainPanel controller={terrain} controls={null} isActive={active} />;
  }
  function Harness({ active }: { active: boolean }) {
    return <TerrainProjectProvider><Preview active={active} /></TerrainProjectProvider>;
  }
  await act(() => { root = create(<Harness active />); });
  await act(() => terrain.selection.onSelect("original"));
  await act(() => terrain.selection.onNext());
  await act(() => terrain.selection.onSelect("target"));
  await act(() => terrain.selection.onNext());
  await act(() => scene().onLoaded());
  await act(() => terrain.cameraControls.onRotateLeft());
  const camera = scene().view;
  await act(() => root.update(<Harness active={false} />));
  expect(root.root.findAllByType(TerrainPreviewScene)).toHaveLength(0);
  await act(() => root.update(<Harness active />));
  expect(root.root.findAllByType(TerrainPreviewScene)).toHaveLength(1);
  expect(scene().view).toEqual(camera);
  expect(scene().currentTerrain.id).toBe("original");
  expect(scene().targetTerrain.id).toBe("target");
});

it("retries without clearing model caches when there is no complete terrain selection", async () => {
  await act(() => { root = create(<App screen="error" />); });
  await act(async () => { await button("Retry").props.onPress(); });
  expect(clearTerrainPreviewCache).not.toHaveBeenCalled();
  expect(retry).toHaveBeenCalledTimes(1);
});

it("renders the preview error view with only a message and callbacks", async () => {
  const onRetry = jest.fn();
  const onSignOut = jest.fn();
  await act(() => {
    root = create(<TerrainPreviewErrorView message="Models unavailable" onRetry={onRetry} onSignOut={onSignOut} />);
  });
  expect(root.root.findAllByType(Text).some((node: any) => node.props.children === "Models unavailable")).toBe(true);
  await act(() => button("Retry").props.onPress());
  await act(() => button("Sign out").props.onPress());
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(onSignOut).toHaveBeenCalledTimes(1);
  expect(clearTerrainPreviewCache).not.toHaveBeenCalled();
});
