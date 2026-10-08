# Dual GPS frontend

The mobile client for [Dual GPS](../README.md), built with TypeScript, React Native, and Expo SDK 54. It connects to an external GNSS receiver over Bluetooth Classic, reads live positioning messages, and forwards NTRIP corrections to the receiver.

## Features

- Registration, login, sign-out, and authentication route guards.
- Native session and NTRIP credential storage using Expo SecureStore.
- Paired-device selection and Android Bluetooth permission handling.
- Topcon receiver configuration commands and a Kolida profile using existing receiver settings.
- Checksum-validated NMEA GGA/GSA parsing for position, fix quality, satellite count, and DOP values.
- Direct NTRIP connections over TCP or TLS, with chunked response decoding and periodic GGA updates.
- Serialized correction writes, socket read backpressure, timeouts, and NTRIP retries.
- A debug screen with serial output, byte counters, and CRC-checked RTCM frame statistics.

## Requirements

- Node.js 20.19.x or newer compatible with Expo SDK 54, plus npm. See the [SDK compatibility table](https://docs.expo.dev/versions/v54.0.0/).
- Android Studio, Android SDK tools, and the JDK required by the Android build toolchain. See [Expo's local build guide](https://docs.expo.dev/guides/local-app-development/).
- A running [Dual GPS backend](../DualGpsBackend/README.md) for authentication. Both the Spring Boot API and PostgreSQL database can run entirely in Docker; a local backend Java or Maven installation is not required for that setup.
- For this app's intended RTK setup: two GNSS receivers, each supporting at least L1 and L2 frequencies, are required to establish a stable RTK fix.
- For the receiver workflow: an Android phone, Bluetooth Classic connectivity to the receiver, and NTRIP service credentials.

The Bluetooth and TCP libraries contain native code. Use a locally compiled Android app; Expo Go cannot supply arbitrary native modules. See [Expo's explanation of native library support](https://docs.expo.dev/develop/development-builds/introduction/).

## Setup

Run from this directory:

```powershell
npm install
Copy-Item .env.example .env
```

Configure `.env` with the backend's base URL

```dotenv
EXPO_PUBLIC_API_URL_EMULATOR=http://10.0.2.2:8080
EXPO_PUBLIC_API_URL_DEVICE=http://192.168.1.100:8080
```

The app selects the emulator variable on an Android emulator and the device variable elsewhere. Replace the device address with your backend computer's LAN IP.

Connect your Android phone with USB debugging enabled, then run:

```powershell
npx expo run:android --device
```

This compiles the native app, installs it, and starts Metro. After the initial build, use `npm start` for JavaScript/TypeScript changes and reopen the installed app. Rebuild when native dependencies or native configuration change, as described in the [local build guide](https://docs.expo.dev/guides/local-app-development/).

## Receiver workflow

1. Start the backend, open the app, and register or sign in.
2. Pair the receivers in Android's Bluetooth settings. The app lists already paired devices.
3. Open **Settings > ASG-EUPOS**, enter your caster credentials and connection details, and save.
4. Open **Settings > Bluetooth**, choose the receiver profile, select the paired device, and connect. Grant Bluetooth access if prompted.
5. Wait for a valid GGA position. With complete caster settings, the app starts NTRIP automatically and forwards corrections to the receiver.
6. Open **Settings > Debug** to inspect the position, correction stream, RTCM statistics, and serial messages.

The initial caster settings are `system.asgeupos.pl`, port `2101`, mountpoint `RTN_VRS_3_1`, with TLS disabled.

The debug console retains the latest 200 entries. Disconnecting Bluetooth also stops the correction connection.

## Code organization

```text
app/                 Expo Router screens, layouts, and route guards
api/                 Authentication HTTP client and error handling
components/settings/ Bluetooth, caster settings, and diagnostics UI
hooks/               Connection orchestration and persisted settings
lib/auth-context.tsx Shared authentication state
lib/gps-context.tsx  Shared receiver and correction state
lib/gps/             NMEA, NTRIP, RTCM, and receiver configuration logic
utils/               Android permission helper
```

The main integration point is [use-bluetooth-serial.ts](hooks/use-bluetooth-serial.ts). The protocol modules under [lib/gps](lib/gps) keep parsing and stream handling separate from the screens. [ntrip-connection.ts](lib/gps/ntrip-connection.ts) manages the socket, GGA updates, correction forwarding, and diagnostics.
