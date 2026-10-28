import { createCrossSectionModel } from "../cross-section";
import { dashboardPresetData, dashboardPrimaryGnssPreset } from "../dashboard-data";
import type { DashboardSensor, DashboardSensorViewModel, DashboardViewModel } from "../types";

function signedNumber(value: number, digits: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits).replace(".", ",")}`;
}

export function getPresetSensorPresentation(sensor: DashboardSensor): DashboardSensorViewModel {
  return {
    id: sensor.id,
    label: sensor.label,
    statusText: sensor.status === "rtk-fix" ? "RTK FIX" : sensor.status === "ok" ? "OK" : "Brak danych",
    source: "preset",
    tone: sensor.status === "unavailable" ? "muted" : "success",
  };
}

export function getDashboardPresentation({ primaryGnss, sourceLabel }: {
  primaryGnss: DashboardSensorViewModel;
  sourceLabel: string;
}): DashboardViewModel {
  const data = dashboardPresetData;
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
    imus: data.imus.map(getPresetSensorPresentation),
    gnss: [primaryGnss, ...data.gnss.map(getPresetSensorPresentation)],
  };
}

export function getOfflineDashboardPresentation(): DashboardViewModel {
  return getDashboardPresentation({
    primaryGnss: getPresetSensorPresentation(dashboardPrimaryGnssPreset),
    sourceLabel: "TRYB OFFLINE",
  });
}
