type AuthFormInput = {
  isSignUp: boolean;
  username: string;
  email: string;
  password: string;
};

export function validateAuthForm({
  isSignUp,
  username,
  email,
  password,
}: AuthFormInput): string | null {
  if (isSignUp && !username.trim()) {
    return "Please enter a username.";
  }

  if (!email || !password) {
    return "Please fill in both email and password fields.";
  }

  if (password.length < 6) {
    return "Password must be at least 6 characters long.";
  }

  return null;
}
