import { createCrossSectionModel } from "../cross-section";
import { dashboardDemoData, dashboardDemoPrimaryGnss } from "../demo-data";
import type { DashboardSensor, DashboardSensorViewModel, DashboardViewModel } from "../types";

function signedNumber(value: number, digits: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits).replace(".", ",")}`;
}

export function getDemoSensorPresentation(sensor: DashboardSensor): DashboardSensorViewModel {
  return {
    id: sensor.id,
    label: sensor.label,
    statusText: sensor.status === "rtk-fix" ? "RTK FIX" : sensor.status === "ok" ? "OK" : "Brak danych",
    source: "demo",
    tone: sensor.status === "unavailable" ? "muted" : "warning",
  };
}

export function getDashboardPresentation({ primaryGnss, sourceLabel }: {
  primaryGnss: DashboardSensorViewModel;
  sourceLabel: string;
}): DashboardViewModel {
  const data = dashboardDemoData;
  const crossSection = createCrossSectionModel(data.crossSection);
  const difference = crossSection?.heightDifference ?? null;
  const centimeters = difference === null ? null : Math.round(Math.abs(difference) * 100);

  return {
    sourceLabel,
    heightDifference: difference === null ? "—" : `${signedNumber(difference, 2)} m`,
    heightDescription: difference === null ? "Brak danych projektu pod łyżką" : difference === 0 ? "Na poziomie projektu" : `${centimeters} cm ${difference > 0 ? "powyżej" : "poniżej"} projektu`,
    heightDirection: difference === null || difference === 0 ? "level" : difference > 0 ? "down" : "up",
    pitch: `${signedNumber(data.pitchDegrees, 1)}°`,
    roll: `${signedNumber(data.rollDegrees, 1)}°`,
    imuSummary: `${data.imus.filter((sensor) => sensor.status === "ok").length}/${data.imus.length} OK`,
    imus: data.imus.map(getDemoSensorPresentation),
    gnss: [primaryGnss, ...data.gnss.map(getDemoSensorPresentation)],
  };
}

export function getOfflineDashboardPresentation(): DashboardViewModel {
  return getDashboardPresentation({
    primaryGnss: getDemoSensorPresentation(dashboardDemoPrimaryGnss),
    sourceLabel: "TRYB OFFLINE · DANE PRZYKŁADOWE",
  });
}
