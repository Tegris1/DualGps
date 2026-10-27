import { useAuth } from "@/features/auth/auth-context";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { DashboardTerrainPanel } from "@/features/dashboard/containers/dashboard-terrain-panel";

export default function Index() {
  const { signOut } = useAuth();
  const dashboard = useDashboard();

  return (
    <DashboardView
      data={dashboard}
      terrain={<DashboardTerrainPanel />}
      onSignOut={() => { void signOut(); }}
    />
  );
}
