import { Button, ScrollView, StyleSheet, Text } from "react-native";

import { GnssSolutionDetails } from "@/components/gps/gnss-solution-details";
import { ReceiverDeviceList } from "@/components/gps/receiver-device-list";
import { ReceiverProfileSelector } from "@/components/gps/receiver-profile-selector";
import type { GgaFix, GsaDop } from "@/lib/gps/nmea";
import type { ReceiverModel } from "@/lib/gps/receiver-profiles";

import type { ReceiverDevice } from "../presentation/types";

type ConnectionSetupViewProps = {
  devices: readonly ReceiverDevice[];
  selectedAddress: string | null;
  connectedAddress: string | null;
  receiverModel: ReceiverModel | null;
  profileDisabled: boolean;
  deviceSelectionDisabled: boolean;
  isRefreshing: boolean;
  disconnectDisabled: boolean;
  connectionMessage: string;
  ntripMessage: string;
  latestFix: GgaFix | null;
  gsaDop: GsaDop | null;
  latestLine: string;
  onRefresh: () => void;
  onSelectReceiverModel: (model: ReceiverModel) => void;
  onConnectDevice: (address: string) => void;
  onDisconnect: () => void;
};

export function ConnectionSetupView({
  devices,
  selectedAddress,
  connectedAddress,
  receiverModel,
  profileDisabled,
  deviceSelectionDisabled,
  isRefreshing,
  disconnectDisabled,
  connectionMessage,
  ntripMessage,
  latestFix,
  gsaDop,
  latestLine,
  onRefresh,
  onSelectReceiverModel,
  onConnectDevice,
  onDisconnect,
}: ConnectionSetupViewProps) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Button title="Find paired GPS receivers" disabled={isRefreshing} onPress={onRefresh} />
      {!receiverModel && (
        <ReceiverProfileSelector
          value={receiverModel}
          disabled={profileDisabled}
          onChange={onSelectReceiverModel}
        />
      )}
      <ReceiverDeviceList
        devices={devices}
        selectedAddress={selectedAddress}
        connectedAddress={connectedAddress}
        disabled={deviceSelectionDisabled}
        onSelect={onConnectDevice}
      />
      {!receiverModel && <Text>Select a receiver profile before connecting.</Text>}
      <Text>{connectionMessage}</Text>
      <Text>NTRIP: {ntripMessage}</Text>
      <GnssSolutionDetails latestFix={latestFix} gsaDop={gsaDop} latestLine={latestLine} showUtc />
      <Button title="Disconnect" disabled={disconnectDisabled} onPress={onDisconnect} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 12 },
});
