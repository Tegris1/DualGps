import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { CrossSectionModel, PlotSegment } from "../cross-section";
import { dashboardColors } from "../styles";

type Props = {
  model: CrossSectionModel | null;
  heightDifference: string;
};

const colors = { current: "#ad8057", target: "#0096b4", bucket: "#d85728", grid: "#dce5eb" };
const PLOT_HEIGHT = 160;
const legend = [
  { label: "Pomiar", color: colors.current },
  { label: "Projekt", color: colors.target },
  { label: "Krawędź łyżki", color: colors.bucket },
];

function ProfileLine({ segment, width, color }: { segment: PlotSegment; width: number; color: string }) {
  const start = { x: segment.start.x * width, y: segment.start.y * PLOT_HEIGHT };
  const end = { x: segment.end.x * width, y: segment.end.y * PLOT_HEIGHT };
  const length = Math.hypot(end.x - start.x, end.y - start.y);

  return <View style={[styles.profileLine, {
    backgroundColor: color,
    width: length,
    left: (start.x + end.x - length) / 2,
    top: (start.y + end.y) / 2 - 1,
    transform: [{ rotate: `${Math.atan2(end.y - start.y, end.x - start.x)}rad` }],
  }]} />;
}

export function BucketCrossSection({ model, heightDifference }: Props) {
  const [width, setWidth] = useState(0);

  if (!model) return <Text style={styles.note}>Brak danych przekroju.</Text>;

  const bucketX = model.bucket.x * width;
  const bucketY = model.bucket.y * PLOT_HEIGHT;
  const targetY = model.targetAtBucket ? model.targetAtBucket.y * PLOT_HEIGHT : null;

  return (
    <View style={styles.container}>
      <View style={styles.legend}>
        {legend.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>Przykładowe wysokości [m]</Text>
      <View style={styles.chart} accessible accessibilityRole="image" accessibilityLabel={`Przykładowy przekrój pomiaru i projektu przez łyżkę. Różnica do projektu: ${heightDifference}.`}>
        <View style={styles.plot} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          {model.elevationTicks.map((tick) => (
            <View key={tick.label} style={[styles.gridLine, { top: tick.position * PLOT_HEIGHT }]}>
              <Text maxFontSizeMultiplier={1.4} style={styles.elevationLabel}>{tick.label}</Text>
            </View>
          ))}
          {width > 0 && <>
            {model.current.map((segment, index) => <ProfileLine key={`current-${index}`} segment={segment} width={width} color={colors.current} />)}
            {model.target.map((segment, index) => <ProfileLine key={`target-${index}`} segment={segment} width={width} color={colors.target} />)}
            {Array.from({ length: 14 }, (_, index) => (
              <View key={index} style={[styles.guideDash, { left: bucketX, top: index * PLOT_HEIGHT / 14 }]} />
            ))}
            {targetY !== null && <>
              <View style={[styles.differenceMarker, { left: bucketX + 8, top: Math.min(bucketY, targetY), height: Math.max(2, Math.abs(bucketY - targetY)) }]} />
              <Text maxFontSizeMultiplier={1.4} style={[styles.differenceLabel, { left: Math.max(0, Math.min(width - 76, bucketX + 16)), top: Math.min(bucketY, targetY) - 24 }]}>{heightDifference}</Text>
            </>}
            <View style={[styles.bucketEdge, { left: bucketX - 5, top: bucketY - 1 }]} />
            <View style={[styles.bucketPoint, { left: bucketX - 3, top: bucketY - 3 }]} />
            {model.distanceTicks.map((tick) => (
              <Text key={tick.position} maxFontSizeMultiplier={1.4} style={[styles.distanceLabel, { left: tick.position * width - 22 }]}>{tick.label}</Text>
            ))}
          </>}
        </View>
      </View>
      <Text style={styles.axisTitle}>Odległość od łyżki [m]</Text>
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
  plot: { height: PLOT_HEIGHT },
  gridLine: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.grid },
  elevationLabel: { position: "absolute", left: -48, top: -8, width: 40, textAlign: "right", color: dashboardColors.ink, fontSize: 10, fontVariant: ["tabular-nums"] },
  profileLine: { position: "absolute", height: 2 },
  guideDash: { position: "absolute", width: 1, height: 6, backgroundColor: "#95a7b2" },
  differenceMarker: { position: "absolute", width: 2, backgroundColor: colors.bucket },
  differenceLabel: { position: "absolute", color: colors.bucket, fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  bucketEdge: { position: "absolute", width: 10, height: 2, backgroundColor: colors.bucket },
  bucketPoint: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: colors.bucket },
  distanceLabel: { position: "absolute", top: PLOT_HEIGHT + 7, width: 44, textAlign: "center", fontSize: 10, color: dashboardColors.ink, fontVariant: ["tabular-nums"] },
  axisTitle: { textAlign: "center", fontSize: 10, color: dashboardColors.ink },
});
