import { expect, it, jest } from "@jest/globals";
import { act } from "react";

import { useDashboardGnss } from "../../features/dashboard/hooks/use-dashboard-gnss";
import { getDashboardGnssStatus, GNSS_FIX_MAX_AGE_MS } from "../../features/dashboard/presentation/gnss-status";
import type { GgaFix } from "../../lib/gps/nmea";

jest.mock("../../features/gps/gps-context", () => ({ useGps: () => ({ bluetooth: mockBluetooth }) }));

const now = 1_700_000_000_000;
const fix: GgaFix = { sentence: "$GPGGA", receivedAt: now, quality: 4, satellites: 8, hdop: 0.9 };
let mockBluetooth: { connectedDevice: { address: string } | null; isConnecting: boolean; latestFix: GgaFix | null };
const { create } = jest.requireActual<{
  create: (element: React.ReactNode) => { update: (element: React.ReactNode) => void; unmount: () => void };
}>("react-test-renderer");

it("uses receiver state and fresh GGA quality instead of falling back to a demo fix", () => {
  const input = { connected: true, isConnecting: false, fix };
  expect(getDashboardGnssStatus(input, now)).toMatchObject({ source: "receiver", statusText: "RTK FIX", tone: "success", details: "Sat: 8 · HDOP: 0,9" });
  expect(getDashboardGnssStatus({ ...input, connected: false }, now)).toMatchObject({ statusText: "Niepołączony", tone: "muted" });
  expect(getDashboardGnssStatus({ ...input, isConnecting: true }, now).statusText).toBe("Łączenie…");
  expect(getDashboardGnssStatus({ ...input, fix: null }, now).statusText).toBe("Czeka na GGA");
  expect(getDashboardGnssStatus({ ...input, fix: { ...fix, quality: 0 } }, now)).toMatchObject({ statusText: "Brak pozycji", tone: "warning", details: undefined });
  expect(getDashboardGnssStatus({ ...input, fix: { ...fix, quality: 5 } }, now)).toMatchObject({ statusText: "RTK FLOAT", tone: "warning" });
  const stale = getDashboardGnssStatus(input, now + GNSS_FIX_MAX_AGE_MS);
  expect(stale).toMatchObject({ statusText: "Dane nieaktualne", tone: "warning" });
  expect(stale.details).toBeUndefined();
});

it("expires a fix without new messages, accepts a new fix, and clears the timeout on unmount", async () => {
  jest.useFakeTimers();
  jest.setSystemTime(now);
  mockBluetooth = { connectedDevice: { address: "receiver" }, isConnecting: false, latestFix: fix };
  let status!: ReturnType<typeof useDashboardGnss>;
  function Probe() { status = useDashboardGnss(); return null; }
  const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  const originalError = console.error;
  const errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).startsWith("react-test-renderer is deprecated")) originalError(...args);
  });
  const clearSpy = jest.spyOn(global, "clearTimeout");
  let root: ReturnType<typeof create> | undefined;

  try {
    await act(() => { root = create(<Probe />); });
    expect(status.statusText).toBe("RTK FIX");
    await act(() => jest.advanceTimersByTime(GNSS_FIX_MAX_AGE_MS - 1));
    expect(status.statusText).toBe("RTK FIX");
    await act(() => jest.advanceTimersByTime(1));
    expect(status.statusText).toBe("Dane nieaktualne");
    mockBluetooth.latestFix = { ...fix, receivedAt: Date.now(), quality: 5 };
    await act(() => root?.update(<Probe />));
    expect(status.statusText).toBe("RTK FLOAT");
    mockBluetooth.connectedDevice = null;
    await act(() => root?.update(<Probe />));
    expect(status.statusText).toBe("Niepołączony");
    mockBluetooth.connectedDevice = { address: "receiver" };
    await act(() => root?.update(<Probe />));
    clearSpy.mockClear();
    await act(() => root?.unmount());
    root = undefined;
    expect(clearSpy).toHaveBeenCalled();
  } finally {
    if (root) await act(() => root?.unmount());
    clearSpy.mockRestore();
    errorSpy.mockRestore();
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
    jest.useRealTimers();
  }
});
