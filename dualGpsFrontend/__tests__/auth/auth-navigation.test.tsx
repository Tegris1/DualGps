import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { Button, TextInput } from "react-native-paper";
import * as SecureStore from "expo-secure-store";

import { authApi } from "../../api/authApi";

jest.mock("../../api/authApi", () => ({
  authApi: { login: jest.fn(), register: jest.fn() },
  AuthApiError: class extends Error {},
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
jest.mock("../../lib/gps-context", () => ({ GpsProvider: ({ children }: any) => children }));
jest.mock("../../features/terrain/project-context", () => ({}));
jest.mock("react-native-paper", () => ({
  Button: "PaperButton", Text: "PaperText", TextInput: "PaperTextInput",
  useTheme: () => ({ colors: { error: "red" } }),
}));
jest.mock("expo-router", () => {
  const Stack = () => {
    const AuthScreen = require("../../app/auth").default;
    return <AuthScreen />;
  };
  Stack.Protected = "Protected";
  Stack.Screen = "Screen";
  return {
    Stack,
    useRouter: () => mockRouter,
    useSegments: () => mockSegments,
    useNavigationContainerRef: () => mockNavigationRef,
  };
});

// Exercise the online route guard regardless of the developer's offline-mode setting.
const previousOfflineMode = process.env.EXPO_PUBLIC_OFFLINE_MODE;
process.env.EXPO_PUBLIC_OFFLINE_MODE = "false";
const RootLayout = require("../../app/_layout").default;
if (previousOfflineMode === undefined) delete process.env.EXPO_PUBLIC_OFFLINE_MODE;
else process.env.EXPO_PUBLIC_OFFLINE_MODE = previousOfflineMode;

const { create } = require("react-test-renderer");
let root: ReturnType<typeof create>;
const mockRouter = { replace: jest.fn() };
const mockSegments = ["auth"];
let mockNavigationReady = true;
const mockReadyListeners = new Set<() => void>();
const mockNavigationRef = {
  isReady: () => mockNavigationReady,
  addListener: (_event: string, listener: () => void) => {
    mockReadyListeners.add(listener);
    return () => { mockReadyListeners.delete(listener); };
  },
};
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
  mockNavigationReady = true;
  mockReadyListeners.clear();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  jest.mocked(authApi.login).mockResolvedValue({ token: "token" });
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

it.each([false, true])("redirects exactly once through the route guard after authentication (sign-up: %s)", async (isSignUp) => {
  await signInThroughForm(isSignUp);
  expect(authApi.login).toHaveBeenCalledWith({ email: "operator@example.com", password: "secret" });
  expect(authApi.register).toHaveBeenCalledTimes(isSignUp ? 1 : 0);
  if (isSignUp) {
    expect(authApi.register).toHaveBeenCalledWith({
      username: "operator", email: "operator@example.com", password: "secret",
    });
  }
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("dualgps.auth-session", JSON.stringify({
    token: "token", email: "operator@example.com",
  }));
  expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).toHaveBeenCalledWith("/");
});

it("waits for navigation readiness before redirecting a successful sign-in", async () => {
  mockNavigationReady = false;
  await signInThroughForm();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  await act(() => {
    mockNavigationReady = true;
    mockReadyListeners.forEach((listener) => listener());
  });
  expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).toHaveBeenCalledWith("/");
});
