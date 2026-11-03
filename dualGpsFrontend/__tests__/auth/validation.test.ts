import { expect, it } from "@jest/globals";

import { validateAuthForm } from "../../features/auth/validation";

const credentials = { isSignUp: false, username: "", email: "operator@example.com", password: "123456" };

it.each([
  [{ email: "" }, "credentials-required"],
  [{ password: "" }, "credentials-required"],
  [{ password: "12345" }, "password-too-short"],
  [{ isSignUp: true }, "username-required"],
  [{ isSignUp: true, username: "   " }, "username-required"],
  [{ isSignUp: true, email: "", password: "" }, "username-required"],
])("rejects invalid credentials %j with a structured validation issue", (fields, issue) => {
  expect(validateAuthForm({ ...credentials, ...fields })).toBe(issue);
});

it("accepts sign-in without a username and sign-up with a nonblank username at the password length boundary", () => {
  expect(validateAuthForm(credentials)).toBeNull();
  expect(validateAuthForm({ ...credentials, isSignUp: true, username: " operator " })).toBeNull();
});
