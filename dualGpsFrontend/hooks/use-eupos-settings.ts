import { useEffect, useState } from "react";

import { DEFAULT_EUPOS_SETTINGS, parseStoredEuposSettings, toNtripSettings } from "@/lib/gps/eupos-settings";
import type { EuposSettings } from "@/lib/gps/types";
import { createSecureStorage } from "@/lib/secure-storage";

const STORAGE_KEY = "dualgps.asg-eupos-settings";
const settingsStorage = createSecureStorage("local");

export function useEuposSettings() {
  const [settings, setSettings] = useState<EuposSettings>(DEFAULT_EUPOS_SETTINGS);
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void settingsStorage.getItem(STORAGE_KEY)
      .then((value) => { if (value) setSettings(parseStoredEuposSettings(value)); })
      .catch((error) => console.error("Could not restore ASG-EUPOS settings:", error));
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
      const connectionSettings = toNtripSettings(settings);
      const normalized = { ...connectionSettings, port: String(connectionSettings.port) };
      await settingsStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
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
