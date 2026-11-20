import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { CrossSectionModel, PlotSegment } from "../cross-section";
import { dashboardColors } from "../styles";

type Props = {
  model: CrossSectionModel | null;
  heightDifference: string;
  compact?: boolean;
  plotHeight?: number;
  elevationLabel: string;
  distanceLabel: string;
  emptyMessage: string;
};

const colors = { current: "#ad8057", target: "#0096b4", bucket: "#d85728", grid: "#dce5eb" };
const legend = [
  { label: "Pomiar", color: colors.current },
  { label: "Projekt", color: colors.target },
  { label: "Krawędź łyżki", color: colors.bucket },
];

function ProfileLine({ segment, width, height, color }: { segment: PlotSegment; width: number; height: number; color: string }) {
  const start = { x: segment.start.x * width, y: segment.start.y * height };
  const end = { x: segment.end.x * width, y: segment.end.y * height };
  const length = Math.hypot(end.x - start.x, end.y - start.y);

  return <View style={[styles.profileLine, {
    backgroundColor: color,
    width: length,
    left: (start.x + end.x - length) / 2,
    top: (start.y + end.y) / 2 - 1,
    transform: [{ rotate: `${Math.atan2(end.y - start.y, end.x - start.x)}rad` }],
  }]} />;
}

export function BucketCrossSection({ model, heightDifference, compact = false, plotHeight = 160, elevationLabel, distanceLabel, emptyMessage }: Props) {
  const [width, setWidth] = useState(0);

  if (!model) return <Text style={styles.note}>{emptyMessage}</Text>;

  const bucketX = model.bucket.x * width;
  const bucketY = model.bucket.y * plotHeight;
  const targetY = model.targetAtBucket ? model.targetAtBucket.y * plotHeight : null;

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <View style={[styles.legend, compact && styles.compactLegend]}>
        {legend.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
      {!compact && <Text style={styles.note}>{elevationLabel}</Text>}
      <View style={[styles.chart, compact && styles.compactChart]} accessible accessibilityRole="image" accessibilityLabel={`Przekrój pomiaru i projektu przez łyżkę. ${elevationLabel}. ${distanceLabel}. Różnica do projektu: ${heightDifference}.`}>
        <View style={{ height: plotHeight }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          {model.elevationTicks.filter((_, index) => !compact || index % 2 === 0).map((tick) => (
            <View key={tick.label} style={[styles.gridLine, { top: tick.position * plotHeight }]}>
              <Text maxFontSizeMultiplier={1.4} adjustsFontSizeToFit numberOfLines={1} style={styles.elevationLabel}>{tick.label}</Text>
            </View>
          ))}
          {width > 0 && <>
            {model.current.map((segment, index) => <ProfileLine key={`current-${index}`} segment={segment} width={width} height={plotHeight} color={colors.current} />)}
            {model.target.map((segment, index) => <ProfileLine key={`target-${index}`} segment={segment} width={width} height={plotHeight} color={colors.target} />)}
            {Array.from({ length: 14 }, (_, index) => (
              <View key={index} style={[styles.guideDash, { left: bucketX, top: index * plotHeight / 14, height: Math.min(6, plotHeight / 28) }]} />
            ))}
            {targetY !== null && <>
              <View style={[styles.differenceMarker, { left: bucketX + 8, top: Math.min(bucketY, targetY), height: Math.max(2, Math.abs(bucketY - targetY)) }]} />
              <Text maxFontSizeMultiplier={1.4} style={[styles.differenceLabel, { left: Math.max(0, Math.min(width - 76, bucketX + 16)), top: Math.min(bucketY, targetY) - 24 }]}>{heightDifference}</Text>
            </>}
            <View style={[styles.bucketEdge, { left: bucketX - 5, top: bucketY - 1 }]} />
            <View style={[styles.bucketPoint, { left: bucketX - 3, top: bucketY - 3 }]} />
            {model.distanceTicks.map((tick) => (
              <Text key={tick.position} maxFontSizeMultiplier={1.4} style={[styles.distanceLabel, { left: tick.position * width - 22, top: plotHeight + 5 }]}>{tick.label}</Text>
            ))}
          </>}
        </View>
      </View>
      <Text style={styles.axisTitle}>{distanceLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 8, justifyContent: "center" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: { width: 12, height: 3 },
  legendText: { fontSize: 10, color: dashboardColors.ink },
  note: { fontSize: 10, color: dashboardColors.muted },
  chart: { paddingLeft: 48, paddingRight: 24, paddingTop: 12, paddingBottom: 24 },
  gridLine: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.grid },
  elevationLabel: { position: "absolute", left: -48, top: -8, width: 40, textAlign: "right", color: dashboardColors.ink, fontSize: 10, fontVariant: ["tabular-nums"] },
  profileLine: { position: "absolute", height: 2 },
  guideDash: { position: "absolute", width: 1, height: 6, backgroundColor: "#95a7b2" },
  differenceMarker: { position: "absolute", width: 2, backgroundColor: colors.bucket },
  differenceLabel: { position: "absolute", color: colors.bucket, fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  bucketEdge: { position: "absolute", width: 10, height: 2, backgroundColor: colors.bucket },
  bucketPoint: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: colors.bucket },
  distanceLabel: { position: "absolute", width: 44, textAlign: "center", fontSize: 10, color: dashboardColors.ink, fontVariant: ["tabular-nums"] },
  axisTitle: { textAlign: "center", fontSize: 10, color: dashboardColors.ink },
  compactContainer: { gap: 4 },
  compactLegend: { gap: 8 },
  compactChart: { paddingTop: 8, paddingBottom: 20 },
});
