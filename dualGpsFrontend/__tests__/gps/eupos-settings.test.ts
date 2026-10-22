import { describe, expect, it } from "@jest/globals";

import { DEFAULT_EUPOS_SETTINGS, parseStoredEuposSettings, toNtripSettings } from "../../lib/gps/eupos-settings";
import type { EuposSettings } from "../../lib/gps/types";

const settings: EuposSettings = {
  host: "caster.example.com", port: "2101", mountpoint: "STREAM",
  username: "operator", password: "secret", useTls: false,
};

describe("EUPOS form conversion", () => {
  it("normalizes the saved form and connection values together without altering the password or input", () => {
    const input = { ...settings, host: " caster.example.com ", username: " operator ", mountpoint: " //STREAM ", port: " 002101 ", password: " secret " };
    expect(toNtripSettings(input)).toEqual({ ...settings, port: 2101, password: " secret " });
    expect(input.port).toBe(" 002101 ");
    expect(input.mountpoint).toBe(" //STREAM ");
  });

  it.each(["", "0", "65536", "2101.5", "not-a-port"])("rejects invalid form port %j", (port) => {
    expect(() => toNtripSettings({ ...settings, port })).toThrow("port");
  });

  it("requires a password and applies protocol validation to the form", () => {
    expect(() => toNtripSettings({ ...settings, password: "" })).toThrow("password");
    expect(() => toNtripSettings({ ...settings, host: "caster\r\nInjected: value" })).toThrow("host");
    expect(() => toNtripSettings({ ...settings, mountpoint: "bad stream" })).toThrow("mountpoint");
  });
});

describe("saved EUPOS settings", () => {
  it.each([null, "", "{invalid", "null", "[]", '"text"', "42"])("restores defaults for unusable storage value %j", (value) => {
    expect(parseStoredEuposSettings(value)).toEqual(DEFAULT_EUPOS_SETTINGS);
  });

  it("keeps valid partial fields while replacing wrong types and ignoring unknown properties", () => {
    expect(parseStoredEuposSettings(JSON.stringify({
      username: "operator", password: null, host: [], port: 2101, mountpoint: {}, useTls: true, unknown: "ignored",
    }))).toEqual({ ...DEFAULT_EUPOS_SETTINGS, username: "operator", useTls: true });
    expect(parseStoredEuposSettings(JSON.stringify({ useTls: "false" })).useTls).toBe(false);
  });

  it("round-trips a saved form and returns independent defaults", () => {
    expect(parseStoredEuposSettings(JSON.stringify(settings))).toEqual(settings);
    const restored = parseStoredEuposSettings(null);
    restored.host = "changed.example.com";
    expect(parseStoredEuposSettings(null).host).toBe(DEFAULT_EUPOS_SETTINGS.host);
  });
});
