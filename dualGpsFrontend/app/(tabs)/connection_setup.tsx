import { Button, ScrollView, StyleSheet, Text } from "react-native";

import { GnssSolutionDetails } from "@/components/gps/gnss-solution-details";
import { ReceiverDeviceList } from "@/components/gps/receiver-device-list";
import { ReceiverProfileSelector } from "@/components/gps/receiver-profile-selector";
import { useGps } from "@/lib/gps-context";

export default function ConnectionSetup() {
  const { bluetooth } = useGps();
  const {
    connectedDevice,
    connectSelected,
    connectionMessage,
    devices,
    disconnect,
    gsaDop,
    latestFix,
    latestLine,
    ntripStatus,
    receiverModel,
    refreshDevices,
    selectedAddress,
    selectDevice,
    selectReceiverModel,
  } = bluetooth;

  async function connect(address: string) {
    selectDevice(address);
    await connectSelected(address);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Button
        title="Find paired GPS receivers"
        onPress={() => void refreshDevices()}
      />
      {!receiverModel && (
        <ReceiverProfileSelector
          value={receiverModel}
          disabled={!!connectedDevice}
          onChange={selectReceiverModel}
        />
      )}
      <ReceiverDeviceList
        devices={devices}
        selectedAddress={selectedAddress}
        connectedAddress={connectedDevice?.address}
        disabled={!receiverModel}
        onSelect={(address) => void connect(address)}
      />
      {!receiverModel && <Text>Select a receiver profile before connecting.</Text>}
      <Text>{connectionMessage}</Text>
      <Text>NTRIP: {ntripStatus.message ?? ntripStatus.state}</Text>
      <GnssSolutionDetails
        latestFix={latestFix}
        gsaDop={gsaDop}
        latestLine={latestLine}
        showUtc
      />
      <Button title="Disconnect" onPress={() => void disconnect()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 12 },
});
