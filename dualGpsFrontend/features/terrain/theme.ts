import type { TextStyle } from "react-native";

export const terrainColors = {
  background: "#f8fafc",
  surface: "#ffffff",
  text: "#0f172a",
  heading: "#1e293b",
  muted: "#64748b",
  primary: "#0e7490",
  accent: "#0891b2",
  border: "#cbd5e1",
  selected: "#ecfeff",
  control: "#e2e8f0",
  controlText: "#334155",
  error: "#b91c1c",
  currentTerrain: "#a17b54",
  previewBackground: "#edf2f6",
};

export const terrainTypography = {
  title: { fontSize: 28, fontWeight: "700", color: terrainColors.text },
  caption: { fontSize: 14, color: terrainColors.muted },
  link: { fontSize: 14, fontWeight: "600", color: terrainColors.primary },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: terrainColors.muted },
} satisfies Record<string, TextStyle>;
