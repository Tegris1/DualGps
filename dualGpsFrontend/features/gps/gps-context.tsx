import { createContext, type ReactNode, useContext, useState } from "react";
import { ReceiverAssignments } from "@/features/gps/services/receiver-assignments";

import {
  useBluetoothSerial,
  type BluetoothSerialController,
} from "@/features/gps/hooks/use-bluetooth-serial";
import {
  useEuposSettings,
  type EuposSettingsController,
} from "@/features/gps/hooks/use-eupos-settings";

type GpsContextValue = {
  bluetooth: BluetoothSerialController;
  eupos: EuposSettingsController;
  secondBluetooth: BluetoothSerialController;
  secondEupos: EuposSettingsController;
};

const GpsContext = createContext<GpsContextValue | undefined>(undefined);

export function GpsProvider({ children }: { children: ReactNode }) {
  const [assignments] = useState(() => new ReceiverAssignments());
  const eupos = useEuposSettings(1);
  const secondEupos = useEuposSettings(2);
  const bluetooth = useBluetoothSerial(eupos.settings, assignments);
  const secondBluetooth = useBluetoothSerial(secondEupos.settings, assignments);

  return (
    <GpsContext.Provider value={{ bluetooth, eupos, secondBluetooth, secondEupos }}>
      {children}
    </GpsContext.Provider>
  );
}

export function useGps() {
  const context = useContext(GpsContext);

  if (!context) {
    throw new Error("useGps must be used within a GpsProvider");
  }

  return context;
}
