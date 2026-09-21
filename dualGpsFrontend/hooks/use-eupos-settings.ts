import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import type { EuposSettings } from "@/components/settings/types";

const STORAGE_KEY = "dualgps.asg-eupos-settings";
const INITIAL_SETTINGS: EuposSettings = {
  username: "",
  password: "",
  host: "",
  port: "2101",
  mountpoint: "",
  useTls: false,
};

async function readSettings(): Promise<EuposSettings | null> {
  const value =
    Platform.OS === "web"
      ? typeof window === "undefined"
        ? null
        : window.localStorage.getItem(STORAGE_KEY)
      : await SecureStore.getItemAsync(STORAGE_KEY);

  if (!value) return null;

  try {
    return { ...INITIAL_SETTINGS, ...JSON.parse(value) };
  } catch {
    return null;
  }
}

async function writeSettings(settings: EuposSettings) {
  const value = JSON.stringify(settings);

  if (Platform.OS === "web") {
    window.localStorage.setItem(STORAGE_KEY, value);
  } else {
    await SecureStore.setItemAsync(STORAGE_KEY, value);
  }
}

export function useEuposSettings() {
  const [settings, setSettings] =
    useState<EuposSettings>(INITIAL_SETTINGS);
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void readSettings().then((saved) => saved && setSettings(saved));
  }, []);

  function update<Key extends keyof EuposSettings>(
    key: Key,
    value: EuposSettings[Key],
  ) {
    setSaveMessage("");
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setIsSaving(true);
    setSaveMessage("");

    try {
      const normalized = {
        ...settings,
        username: settings.username.trim(),
        host: settings.host.trim(),
        port: settings.port.trim(),
        mountpoint: settings.mountpoint.trim(),
      };
      await writeSettings(normalized);
      setSettings(normalized);
      setSaveMessage("ASG-EUPOS settings saved.");
    } catch (error) {
      setSaveMessage("Could not save settings: " + String(error));
    } finally {
      setIsSaving(false);
    }
  }

  return { isSaving, save, saveMessage, settings, update };
}

export type EuposSettingsController = ReturnType<typeof useEuposSettings>;
