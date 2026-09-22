import { createContext, type ReactNode, useContext } from "react";

import {
  useBluetoothSerial,
  type BluetoothSerialController,
} from "@/hooks/use-bluetooth-serial";
import {
  useEuposSettings,
  type EuposSettingsController,
} from "@/hooks/use-eupos-settings";

type GpsContextValue = {
  bluetooth: BluetoothSerialController;
  eupos: EuposSettingsController;
};

const GpsContext = createContext<GpsContextValue | undefined>(undefined);

export function GpsProvider({ children }: { children: ReactNode }) {
  const eupos = useEuposSettings();
  const bluetooth = useBluetoothSerial(eupos.settings);

  return (
    <GpsContext.Provider value={{ bluetooth, eupos }}>
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
