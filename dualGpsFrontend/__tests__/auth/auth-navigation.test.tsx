import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest } from "@jest/globals";
import { Buffer } from "buffer";
import { Stack } from "expo-router";
import { act } from "react";
import { Button, TextInput } from "react-native-paper";
import * as SecureStore from "expo-secure-store";

import { authApi } from "../../features/auth/api/auth-api";

jest.mock("../../features/auth/api/auth-api", () => ({
  authApi: { login: jest.fn(), register: jest.fn() },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
jest.mock("../../features/gps/gps-context", () => ({ GpsProvider: ({ children }: any) => children }));
jest.mock("../../features/terrain/project-context", () => ({ TerrainProjectProvider: ({ children }: any) => children }));
jest.mock("react-native-paper", () => ({
  Button: "PaperButton", Text: "PaperText", TextInput: "PaperTextInput",
  useTheme: () => ({ colors: { error: "red" } }),
}));
jest.mock("expo-router", () => {
  const { Children } = require("react");
  const Stack = ({ children }: { children: React.ReactNode }) => {
    const AuthScreen = require("../../app/auth").default;
    const screens = Children.toArray(children)
      .filter((group: any) => group.props.guard)
      .flatMap((group: any) => Children.toArray(group.props.children));
    return screens.map((screen: any) => screen.props.name === "auth"
      ? <AuthScreen key="auth" />
      : <Stack.Screen key={screen.props.name} name={screen.props.name} />);
  };
  Stack.Protected = "Protected";
  Stack.Screen = (_props: { name: string }) => null;
  return { Stack };
});

// Exercise the online route guard regardless of the developer's offline-mode setting.
const previousOfflineMode = process.env.EXPO_PUBLIC_OFFLINE_MODE;
process.env.EXPO_PUBLIC_OFFLINE_MODE = "false";
const RootLayout = require("../../app/_layout").default;
if (previousOfflineMode === undefined) delete process.env.EXPO_PUBLIC_OFFLINE_MODE;
else process.env.EXPO_PUBLIC_OFFLINE_MODE = previousOfflineMode;

const { create } = require("react-test-renderer");
let root: ReturnType<typeof create>;
const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const originalError = console.error;
let errorSpy: ReturnType<typeof jest.spyOn>;

beforeAll(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  jest.mocked(authApi.login).mockResolvedValue({ token: tokenFor("OPERATOR") });
});

afterEach(async () => { await act(() => root?.unmount()); });
afterAll(() => {
  errorSpy.mockRestore();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
});

async function signInThroughForm(isSignUp = false) {
  await act(async () => { root = create(<RootLayout />); });
  if (isSignUp) {
    await act(() => {
      root.root.findAllByType(Button).find((node: any) => node.props.mode === "text").props.onPress();
    });
  }
  await act(() => {
    const values: Record<string, string> = {
      Username: " operator ", Email: " Operator@Example.com ", Password: "secret",
    };
    for (const input of root.root.findAllByType(TextInput)) {
      input.props.onChangeText(values[input.props.label]);
    }
  });
  await act(async () => {
    await root.root.findAllByType(Button).find((node: any) => node.props.mode === "contained").props.onPress();
  });
}

function tokenFor(role: string) {
  const payload = Buffer.from(JSON.stringify({ roles: [role] })).toString("base64").replace(/=+$/, "");
  return "header." + payload + ".signature";
}

function availableScreens() {
  return root.root.findAllByType(Stack.Screen).map((screen: any) => screen.props.name);
}

it.each([false, true])("enables the operator routes after authentication (sign-up: %s)", async (isSignUp) => {
  await signInThroughForm(isSignUp);
  expect(authApi.login).toHaveBeenCalledWith({ email: "operator@example.com", password: "secret" });
  expect(authApi.register).toHaveBeenCalledTimes(isSignUp ? 1 : 0);
  if (isSignUp) {
    expect(authApi.register).toHaveBeenCalledWith({
      username: "operator", email: "operator@example.com", password: "secret",
    });
  }
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("dualgps.auth-session", JSON.stringify({
    token: tokenFor("OPERATOR"), email: "operator@example.com",
  }));
  expect(availableScreens()).toEqual(["(tabs)", "modal"]);
  expect(root.root.findAllByType(TextInput)).toHaveLength(0);
});

it("opens the terrain library as the only route after architect sign-in", async () => {
  jest.mocked(authApi.login).mockResolvedValue({ token: tokenFor("ARCHITECT") });
  await signInThroughForm();
  expect(availableScreens()).toEqual(["terrain-files"]);
  expect(root.root.findAllByType(TextInput)).toHaveLength(0);
});

it("restores the architect route from an existing saved session", async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify({
    token: tokenFor("ARCHITECT"), email: "architect@example.com",
  }));
  await act(async () => { root = create(<RootLayout />); });
  expect(availableScreens()).toEqual(["terrain-files"]);
});

it("allows no protected screens for an unrecognized role", async () => {
  jest.mocked(authApi.login).mockResolvedValue({ token: tokenFor("UNKNOWN") });
  await signInThroughForm();
  expect(availableScreens()).toEqual([]);
  expect(root.root.findAllByType(TextInput)).toHaveLength(2);
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

it("mounts no protected screens while the saved session is loading", async () => {
  let resolveSession: (value: string | null) => void = () => {};
  jest.mocked(SecureStore.getItemAsync).mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
  await act(async () => { root = create(<RootLayout />); });
  expect(availableScreens()).toEqual([]);
  await act(async () => {
    resolveSession(JSON.stringify({ token: tokenFor("ARCHITECT"), email: "architect@example.com" }));
  });
  expect(availableScreens()).toEqual(["terrain-files"]);
});
