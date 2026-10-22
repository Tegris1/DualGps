import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

type WebStorageScope = "session" | "local";

function webStorage(scope: WebStorageScope): Storage | null {
  if (typeof window === "undefined") return null;
  return scope === "session" ? window.sessionStorage : window.localStorage;
}

export function createSecureStorage(scope: WebStorageScope) {
  return {
    async getItem(key: string): Promise<string | null> {
      if (Platform.OS !== "web") return SecureStore.getItemAsync(key);
      return webStorage(scope)?.getItem(key) ?? null;
    },

    async setItem(key: string, value: string): Promise<void> {
      if (Platform.OS !== "web") return SecureStore.setItemAsync(key, value);
      const storage = webStorage(scope);
      if (!storage) throw new Error("Browser storage is unavailable.");
      storage.setItem(key, value);
    },

    async removeItem(key: string): Promise<void> {
      if (Platform.OS !== "web") return SecureStore.deleteItemAsync(key);
      const storage = webStorage(scope);
      if (!storage) throw new Error("Browser storage is unavailable.");
      storage.removeItem(key);
    },
  };
}
