import type { DashboardReadings } from "./types";

// Presentation fixtures only; these values do not describe connected hardware.
export const dashboardDemoData: DashboardReadings = {
  source: "demo",
  heightDifferenceMeters: 0.51,
  pitchDegrees: 1.2,
  rollDegrees: -0.4,
  imus: [
    { id: "body", label: "Korpus", status: "ok" },
    { id: "boom", label: "Wysięgnik", status: "ok" },
    { id: "arm", label: "Ramię", status: "ok" },
    { id: "bucket", label: "Łyżka", status: "ok" },
  ],
  gnss: [
    { id: "gps-1", label: "GPS 1", status: "rtk-fix" },
    { id: "gps-2", label: "GPS 2", status: "rtk-fix" },
  ],
};
