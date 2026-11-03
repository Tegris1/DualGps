import { expect, it } from "@jest/globals";

import { AuthApiError, type AuthApiErrorKind } from "../../features/auth/api/auth-errors";
import { getAuthErrorMessage } from "../../features/auth/error-messages";
import type { AuthValidationIssue } from "../../features/auth/validation";

it.each<[AuthValidationIssue, string]>([
  ["username-required", "Please enter a username."],
  ["credentials-required", "Please fill in both email and password fields."],
  ["password-too-short", "Password must be at least 6 characters long."],
])("maps %s to the existing form message", (issue, message) => {
  expect(getAuthErrorMessage({ kind: "validation", issue })).toBe(message);
});

it.each<[AuthApiErrorKind, string]>([
  ["configuration", "Authentication is not configured."],
  ["network", "Could not connect to the authentication server."],
  ["timeout", "The authentication request timed out."],
  ["invalid-response", "The authentication server returned an invalid response."],
])("maps %s failures without exposing diagnostics", (kind, message) => {
  expect(getAuthErrorMessage({ kind: "api", error: new AuthApiError(kind, null, "private diagnostics") })).toBe(message);
});

it.each([
  ["Invalid credentials", "Invalid credentials"],
  [{ message: "Email already registered" }, "Email already registered"],
  [{ error: "Account blocked" }, "Account blocked"],
  [{ email: "Invalid email", password: "Too short", timestamp: "technical", path: "/api/auth" }, "Invalid email\nToo short"],
])("extracts supported server messages from %j in the feature layer", (body, message) => {
  expect(getAuthErrorMessage({ kind: "api", error: new AuthApiError("http", 400, body) })).toBe(message);
});

it("uses controlled fallbacks for server failures, unusable bodies, and persistence errors", () => {
  expect(getAuthErrorMessage({ kind: "api", error: new AuthApiError("http", 500, { message: "Private server trace" }) }))
    .toBe("The authentication server is unavailable. Please try again later.");
  expect(getAuthErrorMessage({ kind: "api", error: new AuthApiError("http", 401, { timestamp: "technical" }) }))
    .toBe("Incorrect email or password.");
  expect(getAuthErrorMessage({ kind: "api", error: new AuthApiError("http", 403, []) }))
    .toBe("Authentication request failed (403).");
  expect(getAuthErrorMessage({ kind: "persistence", cause: new Error("Native storage details") }))
    .toBe("Could not save your sign-in session. Please try again.");
  expect(getAuthErrorMessage({ kind: "unexpected", cause: "private diagnostics" }))
    .toBe("An unexpected authentication error occurred.");
  expect(getAuthErrorMessage(null)).toBeNull();
});
