import type { BluetoothDevice } from "react-native-bluetooth-classic";

export type ReceiverModel = "topcon" | "kolida";

export const TOPCON_SETUP_COMMANDS = [
  "%%dm,/cur/term",
  "%%set,/par/pos/mode/cur,pd",
  "%%set,/par/pos/mode/sp,on",
  "%%set,/par/pos/mode/cd,on",
  "%%set,/par/pos/pd/port,any",
  "%%set,/par/pos/pd/vrs,y",
  "%%set,/par/pos/pd/engine,on",
  "%%set,/par/pos/pd/scr/ext,on",
  "%%em,,nmea/GGA:1",
  "%%em,,nmea/GST:1",
  "%%em,,nmea/GSA:1",
  "%%set,/par/cur/term/imode,rtcm3",
] as const;

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function configureTopcon(
  device: BluetoothDevice,
  model: ReceiverModel,
): Promise<void> {
  if (model !== "topcon") return;

  for (const command of TOPCON_SETUP_COMMANDS) {
    await device.write(`${command}\r\n`, "ascii");
    await delay(100);
  }
}
