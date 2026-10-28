import { PermissionsAndroid, Platform } from "react-native";

export async function ensureBluetoothConnectPermission(): Promise<boolean> {
  // Android 11 and lower do not use the Android 12 Nearby Devices permission.
  if (Platform.OS !== "android" || Platform.Version < 31) {
    return true;
  }

  const permission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;

  const alreadyGranted = await PermissionsAndroid.check(permission);
  if (alreadyGranted) {
    return true;
  }

  const result = await PermissionsAndroid.request(permission, {
    title: "Bluetooth access required",
    message:
      "Dual GPS needs Bluetooth access to communicate with your paired GNSS receiver.",
    buttonPositive: "Allow",
    buttonNegative: "Cancel"
  });

  return result === PermissionsAndroid.RESULTS.GRANTED;
}