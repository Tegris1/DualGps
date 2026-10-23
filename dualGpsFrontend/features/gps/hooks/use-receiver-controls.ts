import { useGps } from "@/lib/gps-context";
import type { ReceiverModel } from "@/lib/gps/receiver-profiles";

import { getNtripPresentation } from "../presentation/ntrip-status";
import { getReceiverPresentation } from "../presentation/receiver-state";
import type { ReceiverDevice } from "../presentation/types";

export function useReceiverControls() {
  const { bluetooth } = useGps();
  const connection = getReceiverPresentation(bluetooth);
  const devices: readonly ReceiverDevice[] = bluetooth.devices.map(({ address, name }) => ({ address, name }));

  function selectDevice(address: string) {
    if (connection.canSelectDevice && devices.some((device) => device.address === address)) {
      bluetooth.selectDevice(address);
    }
  }

  function selectReceiverModel(model: ReceiverModel) {
    if (connection.canSelectProfile) bluetooth.selectReceiverModel(model);
  }

  function connect() {
    if (connection.canConnect) return bluetooth.connectSelected();
  }

  function connectDevice(address: string) {
    if (!connection.canConnectToDevice || !devices.some((device) => device.address === address)) return;
    bluetooth.selectDevice(address);
    return bluetooth.connectSelected(address);
  }

  function disconnect() {
    if (connection.canDisconnect) return bluetooth.disconnect();
  }

  function runConnectionAction() {
    return connection.isConnected ? disconnect() : connect();
  }

  function refreshDevices() {
    if (!bluetooth.isRefreshing) return bluetooth.refreshDevices();
  }

  return {
    connection,
    ntrip: getNtripPresentation(bluetooth.ntripStatus),
    devices,
    selectedAddress: bluetooth.selectedAddress,
    receiverModel: bluetooth.receiverModel,
    isRefreshing: bluetooth.isRefreshing,
    latestFix: bluetooth.latestFix,
    gsaDop: bluetooth.gsaDop,
    latestLine: bluetooth.latestLine,
    consoleEntries: bluetooth.consoleEntries,
    onSelectDevice: selectDevice,
    onSelectReceiverModel: selectReceiverModel,
    onConnect: connect,
    onConnectDevice: connectDevice,
    onDisconnect: disconnect,
    onConnectionAction: runConnectionAction,
    onRefresh: refreshDevices,
    onClearConsole: bluetooth.clearConsole,
  };
}
