import { ConnectionSetupView } from "@/features/gps/components/connection-setup-view";
import { useReceiverControls } from "@/features/gps/hooks/use-receiver-controls";

export default function ConnectionSetup() {
  const receiver = useReceiverControls();
  const { connection } = receiver;

  return (
    <ConnectionSetupView
      devices={receiver.devices}
      selectedAddress={receiver.selectedAddress}
      connectedAddress={connection.connectedAddress}
      receiverModel={receiver.receiverModel}
      profileDisabled={!connection.canSelectProfile}
      deviceSelectionDisabled={!connection.canConnectToDevice}
      isRefreshing={receiver.isRefreshing}
      disconnectDisabled={!connection.canDisconnect}
      connectionMessage={connection.connectionBanner.message}
      ntripMessage={receiver.ntrip.banner.message}
      latestFix={receiver.latestFix}
      gsaDop={receiver.gsaDop}
      latestLine={receiver.latestLine}
      onRefresh={receiver.onRefresh}
      onSelectReceiverModel={receiver.onSelectReceiverModel}
      onConnectDevice={receiver.onConnectDevice}
      onDisconnect={receiver.onDisconnect}
    />
  );
}
