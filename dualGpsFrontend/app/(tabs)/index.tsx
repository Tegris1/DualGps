import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";

import { useAuth } from "@/features/auth/auth-context";
import { DashboardScreen } from "@/features/dashboard/containers/dashboard-screen";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";

export default function Index() {
  const { signOut } = useAuth();
  const router = useRouter();
  const data = useDashboard();
  const isActive = useIsFocused();

  return (
    <DashboardScreen
      data={data}
      isActive={isActive}
      onOpenConnectionSetup={() => router.navigate({ pathname: "/(tabs)/settings", params: { section: "debug" } })}
      onOpenSettings={() => router.navigate({ pathname: "/(tabs)/settings", params: { section: "bluetooth" } })}
      onSignOut={() => { void signOut(); }}
    />
  );
}
