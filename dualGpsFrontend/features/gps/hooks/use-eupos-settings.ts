import { useEffect, useState } from "react";

import {
  DEFAULT_EUPOS_SETTINGS,
  parseStoredEuposSettings,
  toNtripSettings,
  type EuposSaveResult,
} from "@/features/gps/eupos-settings";
import { NtripSettingsError } from "@/lib/gps/settings-errors";
import type { EuposSettings } from "@/features/gps/types";
import { createSecureStorage } from "@/lib/secure-storage";

const STORAGE_KEY = "dualgps.asg-eupos-settings";
const settingsStorage = createSecureStorage("local");

export function useEuposSettings() {
  const [settings, setSettings] = useState<EuposSettings>(DEFAULT_EUPOS_SETTINGS);
  const [saveResult, setSaveResult] = useState<EuposSaveResult | null>(null);
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
    setSaveResult(null);
    const normalizedValue = key === "port" && typeof value === "string"
      ? value.replace(/\D/g, "") : value;
    setSettings((current) => ({ ...current, [key]: normalizedValue }));
  }

  async function save() {
    setIsSaving(true);
    setSaveResult(null);

    try {
      let normalized: EuposSettings;
      try {
        const connectionSettings = toNtripSettings(settings);
        normalized = { ...connectionSettings, port: String(connectionSettings.port) };
      } catch (error) {
        setSaveResult({
          status: "error",
          failure: error instanceof NtripSettingsError
            ? { kind: "validation", error }
            : { kind: "unexpected", cause: error },
        });
        return;
      }

      try {
        await settingsStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } catch (cause) {
        setSaveResult({ status: "error", failure: { kind: "persistence", cause } });
        return;
      }
      setSettings(normalized);
      setSaveResult({ status: "success" });
    } finally {
      setIsSaving(false);
    }
  }

  return { isSaving, save, saveResult, settings, update };
}

export type EuposSettingsController = ReturnType<typeof useEuposSettings>;
