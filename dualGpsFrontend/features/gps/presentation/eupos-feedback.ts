import type { EuposSaveResult } from "@/features/gps/eupos-settings";
import type { NtripSettingsErrorCode } from "@/lib/gps/settings-errors";

export type EuposSaveFeedback = { status: "success" | "error"; message: string };

const validationMessages: Record<NtripSettingsErrorCode, string> = {
  "password-required": "Enter your ASG-EUPOS password",
  "password-line-break": "NTRIP password contains an invalid line break",
  "host-invalid": "NTRIP host is invalid",
  "username-invalid": "NTRIP username is invalid",
  "mountpoint-invalid": "NTRIP mountpoint is invalid",
  "port-invalid": "NTRIP port must be between 1 and 65535",
};

export function getEuposSaveFeedback(result: EuposSaveResult | null): EuposSaveFeedback | null {
  if (!result) return null;
  if (result.status === "success") {
    return { status: "success", message: "ASG-EUPOS settings saved." };
  }

  switch (result.failure.kind) {
    case "validation":
      return { status: "error", message: validationMessages[result.failure.error.code] };
    case "persistence":
      return { status: "error", message: "Could not save settings. Please try again." };
    case "unexpected":
      return { status: "error", message: "An unexpected settings error occurred." };
  }
}
