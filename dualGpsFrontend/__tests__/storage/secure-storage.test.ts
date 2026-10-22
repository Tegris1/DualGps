import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { createSecureStorage } from "../../lib/secure-storage";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));

const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS")!;
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
const nativeRead = jest.mocked(SecureStore.getItemAsync);
const nativeWrite = jest.mocked(SecureStore.setItemAsync);
const nativeRemove = jest.mocked(SecureStore.deleteItemAsync);

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn((key: string) => { values.delete(key); }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  nativeRead.mockResolvedValue("native-value");
  nativeWrite.mockResolvedValue(undefined);
  nativeRemove.mockResolvedValue(undefined);
});

afterEach(() => {
  Object.defineProperty(Platform, "OS", platformDescriptor);
  if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
  else Reflect.deleteProperty(globalThis, "window");
});

it.each(["session", "local"] as const)("uses SecureStore for native %s storage", async (scope) => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
  Object.defineProperty(globalThis, "window", { configurable: true, value: undefined });
  const storage = createSecureStorage(scope);
  expect(await storage.getItem("key")).toBe("native-value");
  await storage.setItem("key", "value");
  await storage.removeItem("key");
  expect(nativeRead).toHaveBeenCalledWith("key");
  expect(nativeWrite).toHaveBeenCalledWith("key", "value");
  expect(nativeRemove).toHaveBeenCalledWith("key");
});

it("keeps browser session and local storage separate, including deletion", async () => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  const sessionStorage = memoryStorage();
  const localStorage = memoryStorage();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage, localStorage } });
  const session = createSecureStorage("session");
  const local = createSecureStorage("local");
  await session.setItem("key", "session-value");
  await local.setItem("key", "local-value");
  expect(await session.getItem("key")).toBe("session-value");
  expect(await local.getItem("key")).toBe("local-value");
  await session.removeItem("key");
  expect(await session.getItem("key")).toBeNull();
  expect(await local.getItem("key")).toBe("local-value");
  await local.removeItem("key");
  expect(await local.getItem("key")).toBeNull();
  expect(nativeRead).not.toHaveBeenCalled();
  expect(nativeWrite).not.toHaveBeenCalled();
  expect(nativeRemove).not.toHaveBeenCalled();
});

it("allows server-side reads but rejects writes when browser storage is unavailable", async () => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  Object.defineProperty(globalThis, "window", { configurable: true, value: undefined });
  const storage = createSecureStorage("session");
  await expect(storage.getItem("key")).resolves.toBeNull();
  await expect(storage.setItem("key", "value")).rejects.toThrow("unavailable");
  await expect(storage.removeItem("key")).rejects.toThrow("unavailable");
});

it("propagates native and browser storage failures to callers", async () => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
  nativeWrite.mockRejectedValueOnce(new Error("Native storage unavailable"));
  await expect(createSecureStorage("local").setItem("key", "value")).rejects.toThrow("Native storage unavailable");
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  const localStorage = memoryStorage();
  localStorage.getItem.mockImplementationOnce(() => { throw new Error("Browser storage blocked"); });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  await expect(createSecureStorage("local").getItem("key")).rejects.toThrow("Browser storage blocked");
});
