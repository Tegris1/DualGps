import type { AuthFailure } from "@/features/auth/errors";

import type { AuthValidationIssue } from "./validation";

export type AuthFormFailure = AuthFailure | { kind: "validation"; issue: AuthValidationIssue };

const validationMessages: Record<AuthValidationIssue, string> = {
  "username-required": "Please enter a username.",
  "credentials-required": "Please fill in both email and password fields.",
  "password-too-short": "Password must be at least 6 characters long.",
};

function serverMessage(body: unknown): string | null {
  if (typeof body === "string") return body.trim() || null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  const fields = body as Record<string, unknown>;
  for (const key of ["message", "error"]) {
    if (typeof fields[key] === "string" && fields[key].trim()) return fields[key];
  }

  const messages = ["username", "email", "password", "firstName", "lastName", "birthDate", "phoneNumber", "loyaltyProgram"]
    .map((field) => fields[field])
    .filter((value): value is string => typeof value === "string" && !!value.trim());
  return messages.length ? messages.join("\n") : null;
}

export function getAuthErrorMessage(failure: AuthFormFailure | null): string | null {
  if (!failure) return null;
  switch (failure.kind) {
    case "validation":
      return validationMessages[failure.issue];
    case "persistence":
      return "Could not save your sign-in session. Please try again.";
    case "unexpected":
      return "An unexpected authentication error occurred.";
    case "api": {
      const { kind, status, details } = failure.error;
      switch (kind) {
        case "configuration":
          return "Authentication is not configured.";
        case "network":
          return "Could not connect to the authentication server.";
        case "timeout":
          return "The authentication request timed out.";
        case "invalid-response":
          return "The authentication server returned an invalid response.";
        case "http":
          if (status !== null && status >= 500) {
            return "The authentication server is unavailable. Please try again later.";
          }
          return serverMessage(details) ?? (status === 401
            ? "Incorrect email or password."
            : `Authentication request failed (${status}).`);
      }
    }
  }
}
