type AuthFormInput = {
  isSignUp: boolean;
  username: string;
  email: string;
  password: string;
};

export type AuthValidationIssue = "username-required" | "credentials-required" | "password-too-short";

export function validateAuthForm({
  isSignUp,
  username,
  email,
  password,
}: AuthFormInput): AuthValidationIssue | null {
  if (isSignUp && !username.trim()) {
    return "username-required";
  }

  if (!email || !password) {
    return "credentials-required";
  }

  if (password.length < 6) {
    return "password-too-short";
  }

  return null;
}
