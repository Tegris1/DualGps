import { expect, it } from "@jest/globals";

import { getEuposSaveFeedback } from "../../features/gps/presentation/eupos-feedback";
import { NtripSettingsError, type NtripSettingsErrorCode } from "../../lib/gps/settings-errors";

it.each<[NtripSettingsErrorCode, string]>([
  ["password-required", "Enter your ASG-EUPOS password"],
  ["password-line-break", "NTRIP password contains an invalid line break"],
  ["host-invalid", "NTRIP host is invalid"],
  ["username-invalid", "NTRIP username is invalid"],
  ["mountpoint-invalid", "NTRIP mountpoint is invalid"],
  ["port-invalid", "NTRIP port must be between 1 and 65535"],
])("maps %s to actionable validation feedback", (code, message) => {
  expect(getEuposSaveFeedback({ status: "error", failure: { kind: "validation", error: new NtripSettingsError(code) } }))
    .toEqual({ status: "error", message });
});

it("distinguishes successful saves and persistence failures without exposing raw diagnostics", () => {
  expect(getEuposSaveFeedback(null)).toBeNull();
  expect(getEuposSaveFeedback({ status: "success" }))
    .toEqual({ status: "success", message: "ASG-EUPOS settings saved." });
  expect(getEuposSaveFeedback({ status: "error", failure: { kind: "persistence", cause: "Native storage details" } }))
    .toEqual({ status: "error", message: "Could not save settings. Please try again." });
  expect(getEuposSaveFeedback({ status: "error", failure: { kind: "unexpected", cause: "Internal details" } }))
    .toEqual({ status: "error", message: "An unexpected settings error occurred." });
});
