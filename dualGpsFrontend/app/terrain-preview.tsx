import { type ErrorBoundaryProps, useRouter } from "expo-router";

import { useOfflineSession } from "@/features/auth/offline-session-context";
import { TerrainPreviewErrorView } from "@/features/terrain/components/terrain-preview-error-view";
import { TerrainPreviewView } from "@/features/terrain/components/terrain-preview-view";
import { useTerrainPreview } from "@/features/terrain/hooks/use-terrain-preview";
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
  const { currentTerrain, targetTerrain } = useTerrainProject();
  const router = useRouter();
  const preview = useTerrainPreview(currentTerrain?.id ?? null, targetTerrain?.id ?? null);

  if (!currentTerrain || !targetTerrain) return null;

  return (
    <TerrainPreviewView
      {...preview}
      currentTerrain={currentTerrain}
      targetTerrain={targetTerrain}
      onSignOut={signOut}
      onChangeCurrentTerrain={() => router.navigate("/current-terrain")}
      onChangeTargetTerrain={() => router.navigate("/target-terrain")}
    />
  );
}
