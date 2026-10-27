import { useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-context";
import { DashboardScreen } from "@/features/dashboard/containers/dashboard-screen";

export default function Index() {
  const { signOut } = useAuth();
  const router = useRouter();

  return (
    <DashboardScreen
      onOpenConnectionSetup={() => router.navigate("/(tabs)/connection_setup")}
      onOpenSettings={() => router.navigate("/(tabs)/settings")}
      onSignOut={() => { void signOut(); }}
    />
  );
}
