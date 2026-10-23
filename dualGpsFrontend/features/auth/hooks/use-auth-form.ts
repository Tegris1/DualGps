import { useRef, useState } from "react";

import { useAuth } from "@/lib/auth-context";

import { validateAuthForm } from "../validation";

export function useAuthForm() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function submit() {
    if (submittingRef.current) return;

    const validationError = validateAuthForm({ isSignUp, username, email, password });
    if (validationError) {
      setError(validationError);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const authError = isSignUp
        ? await signUp(username, email, password)
        : await signIn(email, password);
      setError(authError);
    } catch {
      setError("An unexpected authentication error occurred.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  function toggleMode() {
    if (submittingRef.current) return;

    setIsSignUp((current) => !current);
    setError(null);
  }

  return {
    isSignUp,
    username,
    email,
    password,
    error,
    isSubmitting,
    onUsernameChange: setUsername,
    onEmailChange: setEmail,
    onPasswordChange: setPassword,
    onSubmit: submit,
    onToggleMode: toggleMode,
  };
}
