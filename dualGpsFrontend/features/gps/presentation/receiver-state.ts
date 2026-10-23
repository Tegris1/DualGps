import type { ReceiverModel } from "@/lib/gps/receiver-profiles";

import type { ConnectionAction, ReceiverDevice, StatusBanner } from "./types";

type ReceiverStateInput = {
  connectedDevice: ReceiverDevice | null;
  selectedDevice: ReceiverDevice | null | undefined;
  receiverModel: ReceiverModel | null;
  isConnecting: boolean;
  connectionMessage: string;
};

export function getReceiverPresentation({
  connectedDevice,
  selectedDevice,
  receiverModel,
  isConnecting,
  connectionMessage,
}: ReceiverStateInput) {
  const isConnected = !!connectedDevice;
  const canConnectToDevice = !!receiverModel && !isConnecting;
  const canConnect = !isConnected && !!selectedDevice && canConnectToDevice;
  const device = connectedDevice ?? selectedDevice;
  const connectAction: ConnectionAction = {
    label: isConnecting ? "Connecting…" : "Connect selected device",
    disabled: !canConnect,
    loading: isConnecting,
  };
  const connectionAction: ConnectionAction = {
    label: isConnected ? "Disconnect" : isConnecting ? "Connecting…" : "Connect",
    disabled: !isConnected && !canConnect,
    loading: !isConnected && isConnecting,
  };
  const connectionBanner: StatusBanner = {
    variant: isConnected ? "success" : "info",
    message: connectionMessage,
  };

  return {
    isConnected,
    connectedAddress: connectedDevice?.address ?? null,
    deviceName: device ? (device.name ?? device.address) : "No device selected",
    canConnect,
    canDisconnect: isConnected || isConnecting,
    canConnectToDevice,
    canSelectDevice: !isConnecting,
    canSelectProfile: !isConnected && !isConnecting,
    showDevicePrompt: !connectedDevice && !selectedDevice,
    connectAction,
    connectionAction,
    connectionBanner,
  };
}
