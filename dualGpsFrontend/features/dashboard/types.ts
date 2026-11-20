import type { CrossSectionData } from "./cross-section";
import type { ArmAngles } from "@/lib/imu/imu-protocol";

export type DashboardSensor = {
  id: string;
  label: string;
  status: "ok" | "rtk-fix" | "unavailable";
};

export type DashboardReadings = {
  source: "preset";
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
  source: "preset" | "receiver" | "imu";
  tone: "success" | "warning" | "muted";
  details?: string;
};

export type DashboardViewModel = {
  armPose?: ArmAngles | null;
  sourceLabel: string;
  heightDifference: string;
  heightDescription: string;
  heightDirection: "up" | "down" | "level";
  pitch: string;
  roll: string;
  imuSummary: string;
  imus: DashboardSensorViewModel[];
  gnss: DashboardSensorViewModel[];
};
