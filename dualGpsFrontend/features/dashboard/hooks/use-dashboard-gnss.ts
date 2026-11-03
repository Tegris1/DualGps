import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { useGps } from "@/features/gps/gps-context";

import { getDashboardGnssStatus, GNSS_FIX_MAX_AGE_MS } from "../presentation/gnss-status";

export function useDashboardGnss() {
  const { bluetooth } = useGps();
  const [now, setNow] = useState(Date.now);
  const address = bluetooth.connectedDevice?.address ?? null;
  const receivedAt = bluetooth.latestFix?.receivedAt ?? null;
  const isConnecting = bluetooth.isConnecting;

  useEffect(() => {
    const currentTime = Date.now();
    setNow(currentTime);
    if (!address || isConnecting || receivedAt === null || !Number.isFinite(receivedAt)) return;

    const delay = receivedAt + GNSS_FIX_MAX_AGE_MS - currentTime;
    if (delay <= 0) return;
    const timeout = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timeout);
  }, [address, isConnecting, receivedAt]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);

  return getDashboardGnssStatus({ connected: address !== null, isConnecting, fix: bluetooth.latestFix }, now);
}
