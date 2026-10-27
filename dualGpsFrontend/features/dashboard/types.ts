import type { CrossSectionData, CrossSectionModel } from "./cross-section";

export type DashboardSensor = {
  id: string;
  label: string;
  status: "ok" | "rtk-fix" | "unavailable";
};

export type DashboardReadings = {
  source: "demo";
  crossSection: CrossSectionData;
  pitchDegrees: number;
  rollDegrees: number;
  imus: readonly DashboardSensor[];
  gnss: readonly DashboardSensor[];
};

export type DashboardSensorViewModel = {
  id: string;
  label: string;
  statusText: string;
  source: "demo" | "receiver";
  tone: "success" | "warning" | "muted";
  details?: string;
};

export type DashboardViewModel = {
  sourceLabel: string;
  heightDifference: string;
  heightDescription: string;
  heightDirection: "up" | "down" | "level";
  crossSection: CrossSectionModel | null;
  pitch: string;
  roll: string;
  imuSummary: string;
  imus: DashboardSensorViewModel[];
  gnss: DashboardSensorViewModel[];
};
