import { type ErrorBoundaryProps } from "expo-router";

import { useOfflineSession } from "@/features/auth/offline-session-context";
import { TerrainPreviewErrorView } from "@/features/terrain/components/terrain-preview-error-view";
import { DashboardScreen } from "@/features/dashboard/containers/dashboard-screen";
import { getOfflineDashboardPresentation } from "@/features/dashboard/presentation/dashboard-readings";
import { useTerrainProject } from "@/features/terrain/project-context";
import { clearTerrainPreviewCache } from "@/features/terrain/terrain-preview-scene";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { signOut } = useOfflineSession();
  const { currentTerrain, targetTerrain } = useTerrainProject();

  function retryPreview() {
    if (currentTerrain && targetTerrain) {
      clearTerrainPreviewCache(currentTerrain, targetTerrain);
    }
    return retry();
  }

  return <TerrainPreviewErrorView message={error.message} onRetry={retryPreview} onSignOut={signOut} />;
}

export default function TerrainPreview() {
  const { signOut } = useOfflineSession();
  return <DashboardScreen data={getOfflineDashboardPresentation()} onSignOut={signOut} />;
}
