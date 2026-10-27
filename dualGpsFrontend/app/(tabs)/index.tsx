import { useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-context";
import { DashboardScreen } from "@/features/dashboard/containers/dashboard-screen";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";

export default function Index() {
  const { signOut } = useAuth();
  const router = useRouter();
  const data = useDashboard();

  return (
    <DashboardScreen
      data={data}
      onOpenConnectionSetup={() => router.navigate("/(tabs)/connection_setup")}
      onOpenSettings={() => router.navigate("/(tabs)/settings")}
      onSignOut={() => { void signOut(); }}
    />
  );
}
