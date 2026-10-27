import type { DashboardReadings } from "./types";

// Presentation fixtures only; these values do not describe connected hardware.
export const dashboardDemoData: DashboardReadings = {
  source: "demo",
  crossSection: {
    current: [
      { distance: -3, elevation: 535.6 },
      { distance: 0, elevation: 536 },
      { distance: 3, elevation: 536.65 },
    ],
    target: [
      { distance: -3, elevation: 535.05 },
      { distance: 0, elevation: 535.49 },
      { distance: 3, elevation: 536.15 },
    ],
    bucket: { distance: 0, elevation: 536 },
  },
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
