import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest } from "@jest/globals";
import { act } from "react";

import { authApi } from "../../features/auth/api/auth-api";
import { AuthApiError } from "../../features/auth/api/auth-errors";
import { useEuposSettings } from "../../features/gps/hooks/use-eupos-settings";
import { AuthProvider, useAuth } from "../../features/auth/auth-context";
import { DEFAULT_EUPOS_SETTINGS, toNtripSettings } from "../../features/gps/eupos-settings";

jest.mock("react-native", () => ({ Platform: { OS: "web" } }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("../../features/auth/api/auth-api", () => ({
  authApi: { login: jest.fn(), register: jest.fn() },
}));

const { create } = require("react-test-renderer");
const AUTH_KEY = "dualgps.auth-session";
const SETTINGS_KEY = "dualgps.asg-eupos-settings";
let root: ReturnType<typeof create>;
let auth!: ReturnType<typeof useAuth>;
let settings!: ReturnType<typeof useEuposSettings>;
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const originalError = console.error;
let errorSpy: ReturnType<typeof jest.spyOn>;

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn((key: string) => { values.delete(key); }),
  };
}

let sessionStorage: ReturnType<typeof memoryStorage>;
let localStorage: ReturnType<typeof memoryStorage>;

function Probe() {
  auth = useAuth();
  settings = useEuposSettings();
  return null;
}

async function render() {
  await act(async () => { root = create(<AuthProvider><Probe /></AuthProvider>); });
}

beforeAll(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated") && args[0] !== "Could not restore ASG-EUPOS settings:") originalError(...args);
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(authApi.login).mockResolvedValue({ token: "new-token" });
  sessionStorage = memoryStorage();
  localStorage = memoryStorage();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage, localStorage } });
});

afterEach(async () => {
  await act(() => root?.unmount());
  if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
  else Reflect.deleteProperty(globalThis, "window");
});

afterAll(() => {
  errorSpy.mockRestore();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
});

it("restores existing keys, keeps authentication in session storage, and preserves settings on sign-out", async () => {
  sessionStorage.values.set(AUTH_KEY, JSON.stringify({ token: "stored-token", email: "operator@example.com" }));
  localStorage.values.set(SETTINGS_KEY, JSON.stringify({ username: "receiver", useTls: true }));
  await render();
  expect(auth.token).toBe("stored-token");
  expect(auth.isLoadingUser).toBe(false);
  expect(settings.settings).toEqual({ ...DEFAULT_EUPOS_SETTINGS, username: "receiver", useTls: true });

  await act(async () => { await auth.signOut(); });
  expect(auth.user).toBeNull();
  expect(sessionStorage.values.has(AUTH_KEY)).toBe(false);
  expect(localStorage.values.has(SETTINGS_KEY)).toBe(true);
  await act(async () => { expect(await auth.signIn(" Operator@Example.com ", "password")).toBeNull(); });
  expect(authApi.login).toHaveBeenCalledWith({ email: "operator@example.com", password: "password" });
  expect(JSON.parse(sessionStorage.values.get(AUTH_KEY)!)).toEqual({ token: "new-token", email: "operator@example.com" });
  expect(localStorage.values.has(AUTH_KEY)).toBe(false);
});

it("persists settings using the same normalized values passed to NTRIP", async () => {
  localStorage.values.set(SETTINGS_KEY, JSON.stringify({
    host: " caster.example.com ", port: "002101", mountpoint: " //STREAM ",
    username: " operator ", password: " secret ", useTls: true,
  }));
  await render();
  await act(async () => { await settings.save(); });
  const persisted = JSON.parse(localStorage.values.get(SETTINGS_KEY)!);
  expect(persisted).toEqual({
    host: "caster.example.com", port: "2101", mountpoint: "STREAM",
    username: "operator", password: " secret ", useTls: true,
  });
  expect(settings.settings).toEqual(persisted);
  expect(toNtripSettings(persisted)).toEqual(toNtripSettings(settings.settings));
  expect(sessionStorage.values.has(SETTINGS_KEY)).toBe(false);
});

it("discards corrupt authentication data while keeping editable defaults for invalid settings", async () => {
  sessionStorage.values.set(AUTH_KEY, "null");
  localStorage.values.set(SETTINGS_KEY, '{"host":42,"useTls":"false"}');
  await render();
  expect(auth.user).toBeNull();
  expect(sessionStorage.removeItem).toHaveBeenCalledWith(AUTH_KEY);
  expect(settings.settings).toEqual(DEFAULT_EUPOS_SETTINGS);
  await act(() => settings.update("username", "operator"));
  expect(settings.settings.username).toBe("operator");
});

it("keeps settings usable after a storage read fails", async () => {
  localStorage.getItem.mockImplementationOnce(() => { throw new Error("Storage blocked"); });
  await render();
  expect(errorSpy).toHaveBeenCalledWith("Could not restore ASG-EUPOS settings:", expect.any(Error));
  expect(settings.settings).toEqual(DEFAULT_EUPOS_SETTINGS);
  await act(() => settings.update("host", "caster.example.com"));
  expect(settings.settings.host).toBe("caster.example.com");
});

it("preserves API failure details without changing the session or writing storage", async () => {
  const failure = new AuthApiError("http", 401, { message: "Invalid credentials" });
  jest.mocked(authApi.login).mockRejectedValueOnce(failure);
  await render();
  await act(async () => {
    expect(await auth.signIn("operator@example.com", "password")).toEqual({ kind: "api", error: failure });
  });
  expect(auth.user).toBeNull();
  expect(sessionStorage.setItem).not.toHaveBeenCalled();
});

it("distinguishes session persistence failures from authentication failures and allows retry", async () => {
  const cause = new Error("Storage blocked");
  await render();
  sessionStorage.setItem.mockImplementationOnce(() => { throw cause; });
  await act(async () => {
    expect(await auth.signIn("operator@example.com", "password")).toEqual({ kind: "persistence", cause });
  });
  expect(auth.user).toBeNull();
  expect(auth.token).toBeNull();
  await act(async () => { expect(await auth.signIn("operator@example.com", "password")).toBeNull(); });
  expect(auth.user?.email).toBe("operator@example.com");
});

it("preserves registration rejection and does not attempt sign-in", async () => {
  const failure = new AuthApiError("http", 409, { error: "Email already registered" });
  jest.mocked(authApi.register).mockRejectedValueOnce(failure);
  await render();
  await act(async () => {
    expect(await auth.signUp("operator", "operator@example.com", "password")).toEqual({ kind: "api", error: failure });
  });
  expect(authApi.login).not.toHaveBeenCalled();
  expect(sessionStorage.setItem).not.toHaveBeenCalled();
});

it("retains unexpected service failures as diagnostics", async () => {
  const cause = new Error("Unexpected service failure");
  jest.mocked(authApi.login).mockRejectedValueOnce(cause);
  await render();
  await act(async () => {
    expect(await auth.signIn("operator@example.com", "password")).toEqual({ kind: "unexpected", cause });
  });
  expect(auth.user).toBeNull();
});
