import { useEffect, useState } from "react";

import { DEFAULT_EUPOS_SETTINGS, parseStoredEuposSettings, toNtripSettings } from "@/lib/gps/eupos-settings";
import type { EuposSettings } from "@/lib/gps/types";
import { createSecureStorage } from "@/lib/secure-storage";

const STORAGE_KEY = "dualgps.asg-eupos-settings";
const settingsStorage = createSecureStorage("local");
type SaveFeedback = { status: "success" | "error"; message: string };

export function useEuposSettings() {
  const [settings, setSettings] = useState<EuposSettings>(DEFAULT_EUPOS_SETTINGS);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
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
    setSaveFeedback(null);
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setIsSaving(true);
    setSaveFeedback(null);

    try {
      const connectionSettings = toNtripSettings(settings);
      const normalized = { ...connectionSettings, port: String(connectionSettings.port) };
      await settingsStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      setSettings(normalized);
      setSaveFeedback({ status: "success", message: "ASG-EUPOS settings saved." });
    } catch (error) {
      setSaveFeedback({ status: "error", message: "Could not save settings: " + String(error) });
    } finally {
      setIsSaving(false);
    }
  }

  return { isSaving, save, saveFeedback, settings, update };
}

export type EuposSettingsController = ReturnType<typeof useEuposSettings>;
