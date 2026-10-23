import { AuthForm } from "@/features/auth/components/auth-form";
import { useAuthForm } from "@/features/auth/hooks/use-auth-form";

export default function AuthScreen() {
  const form = useAuthForm();

  return <AuthForm {...form} />;
}
