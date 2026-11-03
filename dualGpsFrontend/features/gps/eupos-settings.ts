import { validateNtripSettings, type NtripSettings } from "@/lib/gps/ntrip-protocol";
import { NtripSettingsError } from "@/lib/gps/settings-errors";
import type { EuposSettings } from "./types";

export type EuposSaveResult =
  | { status: "success" }
  | {
    status: "error";
    failure:
      | { kind: "validation"; error: NtripSettingsError }
      | { kind: "persistence"; cause: unknown }
      | { kind: "unexpected"; cause: unknown };
  };

export const DEFAULT_EUPOS_SETTINGS: EuposSettings = {
  username: "",
  password: "",
  host: "system.asgeupos.pl",
  port: "2101",
  mountpoint: "RTN_VRS_3_1",
  useTls: false,
};

export function toNtripSettings(settings: EuposSettings): NtripSettings {
  if (!settings.password) throw new NtripSettingsError("password-required");
  return validateNtripSettings({ ...settings, port: Number(settings.port) });
}

export function parseStoredEuposSettings(value: string | null): EuposSettings {
  const settings = { ...DEFAULT_EUPOS_SETTINGS };
  if (!value) return settings;

  try {
    const stored: unknown = JSON.parse(value);
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return settings;
    const fields = stored as Record<string, unknown>;
    for (const key of ["username", "password", "host", "port", "mountpoint"] as const) {
      if (typeof fields[key] === "string") settings[key] = fields[key];
    }
    if (typeof fields.useTls === "boolean") settings.useTls = fields.useTls;
  } catch {
    // Invalid saved data is replaced with editable defaults.
  }

  return settings;
}
