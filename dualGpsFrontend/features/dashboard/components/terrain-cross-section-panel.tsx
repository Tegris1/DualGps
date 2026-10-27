import { StyleSheet, Text, View } from "react-native";

import type { getTerrainCrossSectionPresentation } from "../presentation/terrain-cross-section";
import { dashboardColors, dashboardStyles } from "../styles";
import { BucketCrossSection } from "./bucket-cross-section";

type Props = {
  section: ReturnType<typeof getTerrainCrossSectionPresentation>;
  compact: boolean;
  plotHeight: number;
};

export function TerrainCrossSectionPanel({ section, compact, plotHeight }: Props) {
  return <View style={styles.panel}>
    <Text style={[dashboardStyles.panelHeading, compact && dashboardStyles.compactCardTitle]}>PRZEKRÓJ PRZEZ ŁYŻKĘ</Text>
    <Text style={styles.note}>{section.sourceLabel}</Text>
    <BucketCrossSection
      model={section.model}
      heightDifference={section.comparisonLabel}
      compact={compact}
      plotHeight={plotHeight}
      elevationLabel={section.elevationLabel}
      distanceLabel={compact ? "Odległość i wysokość względem łyżki [j.m.]" : section.distanceLabel}
      emptyMessage={section.emptyMessage}
    />
    {(!compact || section.model?.comparison !== "available") && <Text style={styles.note}>{section.comparisonNote}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { flex: 1, gap: 4 },
  note: { fontSize: 9, lineHeight: 13, color: dashboardColors.muted },
});
