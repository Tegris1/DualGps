import { useCallback } from "react";
import type { BluetoothDevice } from "react-native-bluetooth-classic";

import { useBluetoothReceiver } from "@/features/gps/hooks/use-bluetooth-receiver";
import { useNtripSession } from "@/features/gps/hooks/use-ntrip-session";
import { useReceiverDiagnostics } from "@/features/gps/hooks/use-receiver-diagnostics";
import type { EuposSettings, ReceiverReleaseReason } from "@/features/gps/types";

// The provider creates this composition once. Each part owns its resources;
// screens continue to consume the same controller through useGps.
export function useBluetoothSerial(euposSettings: EuposSettings) {
  const { session, status } = useNtripSession(euposSettings);
  const { acceptData, resetReadings, ...diagnostics } = useReceiverDiagnostics();

  const handleReceiverData = useCallback((rawData: string, device: BluetoothDevice) => {
    for (const gga of acceptData(rawData)) session.acceptGga(device, gga);
  }, [acceptData, session]);

  const releaseReceiver = useCallback((reason: ReceiverReleaseReason) => {
    session.releaseReceiver(reason);
    if (reason !== "unmounted") resetReadings();
  }, [resetReadings, session]);

  const receiver = useBluetoothReceiver({
    onAttached: session.attachReceiver,
    onReady: session.receiverConfigured,
    onData: handleReceiverData,
    onReleased: releaseReceiver,
  });

  return { ...receiver, ...diagnostics, ntripStatus: status };
}

export type BluetoothSerialController = ReturnType<typeof useBluetoothSerial>;
