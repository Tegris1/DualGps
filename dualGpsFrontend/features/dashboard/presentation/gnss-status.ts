import type { GgaFix } from "@/lib/gps/nmea";

import type { DashboardSensorViewModel } from "../types";

export const GNSS_FIX_MAX_AGE_MS = 10_000;

type GnssInput = {
  connected: boolean;
  isConnecting: boolean;
  fix: GgaFix | null;
};

const qualityLabels: Record<GgaFix["quality"], string> = {
  0: "Brak pozycji",
  1: "GPS",
  2: "DGPS",
  3: "GGA: 3",
  4: "RTK FIX",
  5: "RTK FLOAT",
  6: "Estymowana",
  7: "Ręczna",
  8: "Symulacja",
};

export function getDashboardGnssStatus({ connected, isConnecting, fix }: GnssInput, now: number): DashboardSensorViewModel {
  const sensor: DashboardSensorViewModel = {
    id: "gps-1", label: "GPS 1", source: "receiver", statusText: "Niepołączony", tone: "muted",
  };

  if (isConnecting) return { ...sensor, statusText: "Łączenie…" };
  if (!connected) return sensor;
  if (!fix) return { ...sensor, statusText: "Czeka na GGA", tone: "warning" };
  if (!Number.isFinite(fix.receivedAt) || now - fix.receivedAt >= GNSS_FIX_MAX_AGE_MS) {
    return { ...sensor, statusText: "Dane nieaktualne", tone: "warning" };
  }

  const details = [
    fix.satellites === undefined ? null : `Sat: ${fix.satellites}`,
    fix.hdop === undefined ? null : `HDOP: ${fix.hdop.toFixed(1).replace(".", ",")}`,
  ].filter(Boolean).join(" · ");

  return {
    ...sensor,
    statusText: qualityLabels[fix.quality],
    tone: fix.quality === 4 ? "success" : "warning",
    details: fix.quality === 0 ? undefined : details || undefined,
  };
}
