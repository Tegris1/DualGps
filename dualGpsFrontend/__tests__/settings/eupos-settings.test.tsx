import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest } from "@jest/globals";
import * as SecureStore from "expo-secure-store";
import { act } from "react";

import { EuposSettings } from "../../features/gps/components/settings/eupos-settings";
import { InfoBanner } from "../../components/ui/form-controls";
import { useEuposSettings } from "../../features/gps/hooks/use-eupos-settings";
import { getEuposSaveFeedback } from "../../features/gps/presentation/eupos-feedback";

jest.mock("@expo/vector-icons/MaterialIcons", () => "MaterialIcons");
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));

const { create } = require("react-test-renderer");
let root: ReturnType<typeof create>;
let controller!: ReturnType<typeof useEuposSettings>;
const readStorage = jest.mocked(SecureStore.getItemAsync);
const writeStorage = jest.mocked(SecureStore.setItemAsync);
const savedSettings = {
  username: "operator", password: "secret", host: "caster.example.com", port: "2101",
  mountpoint: "RTN_VRS_3_1", useTls: false,
};
const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const originalError = console.error;
let errorSpy: ReturnType<typeof jest.spyOn>;

function Screen() {
  controller = useEuposSettings();
  return <EuposSettings settings={controller.settings} isSaving={controller.isSaving}
    saveFeedback={getEuposSaveFeedback(controller.saveResult)} onChange={controller.update} onSave={controller.save} />;
}

beforeAll(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
});

beforeEach(() => {
  readStorage.mockReset().mockResolvedValue(null);
  writeStorage.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  await act(() => root?.unmount());
});

afterAll(() => {
  errorSpy.mockRestore();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
});

async function render() {
  await act(async () => { root = create(<Screen />); });
}

function input(label: string) {
  return root.root.findAll((node: any) =>
    node.props.accessibilityLabel === label && typeof node.props.onChangeText === "function",
  )[0];
}

function action(label: string) {
  return root.root.findAll((node: any) =>
    node.props.accessibilityLabel === label && typeof node.props.onPress === "function",
  )[0];
}

function banners() {
  return root.root.findAllByType(InfoBanner);
}

function saveButton() {
  return root.root.find((node: any) =>
    typeof node.props.label === "string" && node.props.label.includes("Sav") && typeof node.props.onPress === "function",
  );
}

async function save() {
  await act(async () => { saveButton().props.onPress(); });
}

it("shows validation failures as alerts, saves successfully after correction, and clears feedback on edits", async () => {
  await render();
  await save();
  expect(writeStorage).not.toHaveBeenCalled();
  expect(controller.saveResult).toMatchObject({
    status: "error", failure: { kind: "validation", error: { code: "password-required" } },
  });
  expect(banners()[0].props.variant).toBe("error");
  expect(banners()[0].props.message).toContain("Enter your ASG-EUPOS password");
  expect(root.root.findAll((node: any) => node.props.accessibilityRole === "alert").length).toBeGreaterThan(0);

  await act(() => input("Username").props.onChangeText(" operator "));
  expect(banners()).toHaveLength(0);
  await act(() => input("Password").props.onChangeText("secret"));
  await save();
  expect(writeStorage).toHaveBeenCalledWith("dualgps.asg-eupos-settings", expect.any(String));
  expect(JSON.parse(writeStorage.mock.calls[0][1]).username).toBe("operator");
  expect(banners()[0].props.variant).toBe("success");
  expect(banners()[0].props.message).toBe("ASG-EUPOS settings saved.");
  expect(root.root.findAll((node: any) => node.props.accessibilityRole === "alert")).toHaveLength(0);
  await act(() => input("IP address or hostname").props.onChangeText("another.example.com"));
  expect(banners()).toHaveLength(0);
});

it("reports a storage failure as an error instead of successful feedback", async () => {
  readStorage.mockResolvedValue(JSON.stringify(savedSettings));
  const cause = new Error("Native storage diagnostics");
  writeStorage.mockRejectedValueOnce(cause);
  await render();
  await save();
  expect(banners()[0].props.variant).toBe("error");
  expect(controller.saveResult).toEqual({ status: "error", failure: { kind: "persistence", cause } });
  expect(banners()[0].props.message).toBe("Could not save settings. Please try again.");
  expect(root.root.findAll((node: any) => node.props.accessibilityRole === "alert").length).toBeGreaterThan(0);
  expect(saveButton().props.loading).toBe(false);
});

it("toggles visibility through the shared password field without losing or saving its value", async () => {
  readStorage.mockResolvedValue(JSON.stringify(savedSettings));
  await render();
  expect(input("Password").props.secureTextEntry).toBe(true);
  expect(input("Password").props.value).toBe("secret");
  await act(() => action("Show password").props.onPress());
  expect(input("Password").props.secureTextEntry).toBe(false);
  expect(input("Password").props.value).toBe("secret");
  await act(() => input("Password").props.onChangeText("changed-secret"));
  await act(() => action("Hide password").props.onPress());
  expect(input("Password").props.secureTextEntry).toBe(true);
  expect(input("Password").props.value).toBe("changed-secret");
  expect(writeStorage).not.toHaveBeenCalled();
});

it("clears old feedback during a new save and shows success only after storage finishes", async () => {
  readStorage.mockResolvedValue(JSON.stringify(savedSettings));
  await render();
  await save();
  expect(banners()[0].props.variant).toBe("success");
  let finishSave!: () => void;
  writeStorage.mockImplementationOnce(() => new Promise<void>((resolve) => { finishSave = resolve; }));
  await save();
  expect(saveButton().props.loading).toBe(true);
  expect(banners()).toHaveLength(0);
  await act(async () => { finishSave(); });
  expect(saveButton().props.loading).toBe(false);
  expect(banners()[0].props.variant).toBe("success");
});

it("normalizes port edits in the hook while preserving passwords and TLS values", async () => {
  await render();
  await act(() => input("Port").props.onChangeText("2x10-1"));
  expect(controller.settings.port).toBe("2101");
  expect(input("Port").props.value).toBe("2101");
  await act(() => {
    controller.update("port", "8a080");
    controller.update("password", " secret with spaces ");
    controller.update("useTls", true);
  });
  expect(controller.settings.port).toBe("8080");
  expect(controller.settings.password).toBe(" secret with spaces ");
  expect(controller.settings.useTls).toBe(true);
  expect(writeStorage).not.toHaveBeenCalled();
});
