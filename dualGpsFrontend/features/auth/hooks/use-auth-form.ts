import { useRef, useState } from "react";

import { useAuth } from "@/features/auth/auth-context";
import { toAuthFailure } from "@/features/auth/errors";

import { getAuthErrorMessage, type AuthFormFailure } from "../error-messages";
import { validateAuthForm } from "../validation";

export function useAuthForm() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<AuthFormFailure | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function submit() {
    if (submittingRef.current) return;

    const validationError = validateAuthForm({ isSignUp, username, email, password });
    if (validationError) {
      setFailure({ kind: "validation", issue: validationError });
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setFailure(null);

    try {
      const authError = isSignUp
        ? await signUp(username, email, password)
        : await signIn(email, password);
      setFailure(authError);
    } catch (error) {
      setFailure(toAuthFailure(error));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  function toggleMode() {
    if (submittingRef.current) return;

    setIsSignUp((current) => !current);
    setFailure(null);
  }

  return {
    isSignUp,
    username,
    email,
    password,
    error: getAuthErrorMessage(failure),
    isSubmitting,
    onUsernameChange: setUsername,
    onEmailChange: setEmail,
    onPasswordChange: setPassword,
    onSubmit: submit,
    onToggleMode: toggleMode,
  };
}
