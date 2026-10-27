import { createCrossSectionModel } from "../cross-section";
import { dashboardDemoData } from "../demo-data";
import type { DashboardSensor, DashboardSensorViewModel, DashboardViewModel } from "../types";
import { useDashboardGnss } from "./use-dashboard-gnss";

function signedNumber(value: number, digits: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits).replace(".", ",")}`;
}

function sensorViewModel(sensor: DashboardSensor): DashboardSensorViewModel {
  return {
    id: sensor.id,
    label: sensor.label,
    statusText: sensor.status === "rtk-fix" ? "RTK FIX" : sensor.status === "ok" ? "OK" : "Brak danych",
    source: "demo",
    tone: sensor.status === "unavailable" ? "muted" : "warning",
  };
}

export function useDashboard(): DashboardViewModel {
  const data = dashboardDemoData;
  const receiverGnss = useDashboardGnss();
  const crossSection = createCrossSectionModel(data.crossSection);
  const difference = crossSection?.heightDifferenceMeters ?? null;
  const centimeters = difference === null ? null : Math.round(Math.abs(difference) * 100);

  return {
    sourceLabel: "GNSS 1: ODBIORNIK · RESZTA: DEMO",
    heightDifference: difference === null ? "—" : `${signedNumber(difference, 2)} m`,
    heightDescription: difference === null ? "Brak danych projektu pod łyżką" : difference === 0 ? "Na poziomie projektu" : `${centimeters} cm ${difference > 0 ? "powyżej" : "poniżej"} projektu`,
    heightDirection: difference === null || difference === 0 ? "level" : difference > 0 ? "down" : "up",
    crossSection,
    pitch: `${signedNumber(data.pitchDegrees, 1)}°`,
    roll: `${signedNumber(data.rollDegrees, 1)}°`,
    imuSummary: `${data.imus.filter((sensor) => sensor.status === "ok").length}/${data.imus.length} OK`,
    imus: data.imus.map(sensorViewModel),
    gnss: [receiverGnss, ...data.gnss.map(sensorViewModel)],
  };
}
