import { getDashboardPresentation } from "../presentation/dashboard-readings";
import type { DashboardViewModel } from "../types";
import { useDashboardGnss } from "./use-dashboard-gnss";
import { useGps } from "@/features/gps/gps-context";
import type { DashboardSensorViewModel } from "../types";

export function useDashboard(): DashboardViewModel {
  const receiverGnss = useDashboardGnss();
  const secondReceiverGnss = useDashboardGnss(2);
  const { imus } = useGps();
  const labels = { boom: "Wysięgnik", arm: "Ramię", bucket: "Łyżka" };
  const sensors: DashboardSensorViewModel[] = imus.sensors.map((sensor) => {
    const ok = sensor.fresh && sensor.reading?.status === "ok";
    return {
      id: sensor.section, label: labels[sensor.section], source: "imu",
      statusText: !sensor.connectedDevice ? "Niepołączony" : sensor.error ? "Błąd danych"
        : !sensor.fresh ? "Brak aktualnych danych" : sensor.reading?.status === "calibrating" ? "Kalibracja"
        : ok ? `${sensor.reading!.angle!.toFixed(1)}°` : "Brak pomiaru",
      tone: ok ? "success" : sensor.connectedDevice ? "warning" : "muted",
    };
  });

  return { ...getDashboardPresentation({
    primaryGnss: receiverGnss,
    secondaryGnss: secondReceiverGnss,
    sourceLabel: "GNSS 1 / 2: ODBIORNIKI",
  }), armPose: imus.pose, imus: sensors,
    imuSummary: `${sensors.filter((sensor) => sensor.tone === "success").length}/3 OK`,
    pitch: "—", roll: "—",
    heightDifference: "—", heightDirection: "level",
    heightDescription: "Wymiary i pozycja maszyny wymagają kalibracji",
  };
}
