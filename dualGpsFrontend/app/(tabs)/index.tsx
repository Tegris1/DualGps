import { useAuth } from "@/features/auth/auth-context";
import { DashboardScreen } from "@/features/dashboard/containers/dashboard-screen";

export default function Index() {
  const { signOut } = useAuth();
  return <DashboardScreen onSignOut={() => { void signOut(); }} />;
}
