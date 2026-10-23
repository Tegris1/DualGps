import { expect, it } from "@jest/globals";

import { validateAuthForm } from "../../features/auth/validation";

const credentials = { isSignUp: false, username: "", email: "operator@example.com", password: "123456" };

it.each([
  [{ email: "" }, "Please fill in both email and password fields."],
  [{ password: "" }, "Please fill in both email and password fields."],
  [{ password: "12345" }, "Password must be at least 6 characters long."],
  [{ isSignUp: true }, "Please enter a username."],
  [{ isSignUp: true, username: "   " }, "Please enter a username."],
  [{ isSignUp: true, email: "", password: "" }, "Please enter a username."],
])("rejects invalid credentials %j with the existing validation message", (fields, message) => {
  expect(validateAuthForm({ ...credentials, ...fields })).toBe(message);
});

it("accepts sign-in without a username and sign-up with a nonblank username at the password length boundary", () => {
  expect(validateAuthForm(credentials)).toBeNull();
  expect(validateAuthForm({ ...credentials, isSignUp: true, username: " operator " })).toBeNull();
});
