export type NtripSettingsErrorCode =
  | "host-invalid"
  | "username-invalid"
  | "mountpoint-invalid"
  | "password-required"
  | "password-line-break"
  | "port-invalid";

export class NtripSettingsError extends Error {
  constructor(readonly code: NtripSettingsErrorCode) {
    super(`Invalid NTRIP setting: ${code}`);
    this.name = "NtripSettingsError";
  }
}
