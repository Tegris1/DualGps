import { useAuth } from "@/features/auth/auth-context";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";

export default function Index() {
  const { signOut } = useAuth();
  const dashboard = useDashboard();

  return <DashboardView data={dashboard} onSignOut={() => { void signOut(); }} />;
}
