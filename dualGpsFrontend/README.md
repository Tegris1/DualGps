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

## Terrain rendering preview

The terrain preview displays the bundled `assets/terrain/Original.glb` and `assets/terrain/Target.glb` together. It provides layer switches, camera rotation, zoom, a top view, and reset. The current surface is brown; the target is a cyan wireframe overlay that stays visible through the current surface. Both models retain their exported placement and rotation, and the camera fits their combined bounds.

The `current-terrain` and `target-terrain` routes share `TerrainSelectionScreen` and `TerrainOptionCard` under `features/terrain/components`. The routes own terrain filtering and navigation; the shared components render the layout, selection state, and continue action. Terrain state and rendering also live under `features/terrain`, while the local sign-in session lives under `features/auth`.

From this directory, run in PowerShell:

```powershell
npm ci
$env:EXPO_PUBLIC_OFFLINE_MODE = "true"
npx expo run:android
```

Rebuild the native app after installing the new GL and file-system modules; restarting Metro alone cannot add them to an existing binary. Subsequent JavaScript changes can use `npm start` with the same offline environment variable. For development, the Android emulator connects to the local Metro server; models are bundled and require no external asset service.

On Windows, a long checkout path can cause Ninja to report `Filename longer than 260 characters` during native compilation. Use a short checkout path, such as `C:\src\DualGps`, or use the included Gradle init script. For an x86_64 Android emulator, with the offline environment variable still set:

```powershell
npx expo prebuild --platform android
Push-Location android
.\gradlew.bat --init-script ..\scripts\android-short-path.init.gradle app:assembleDebug "-PreactNativeArchitectures=x86_64"
adb install -r app\build\outputs\apk\debug\app-debug.apk
Pop-Location
npx expo start --offline
```

Press `a` once Metro is ready to open the installed app. The init script only changes generated CMake output placement for that invocation. Offline Metro also avoids a failing remote dependency check by using the installed SDK's local metadata.

Offline mode opens a local sign-in screen and does not mount the backend authentication or GPS providers. Use email `offline@dualgps.local` and password `Offline123!` (also shown on the sign-in screen). This public presentation account makes no backend requests. Its session lives only in memory and resets on a full reload or app restart.

Successful sign-in opens **Choose current terrain**. Select `Original.glb`, continue to **Choose target terrain**, select `Target.glb`, then **Open preview**. Both choices are required, role-validated, and must reference different files. Each step stays disabled until its required selection is valid. The renderer loads both selected catalog entries.

Use **Change** beside either filename in the preview to return to its selection screen. Choices are retained while navigating between screens and cleared on sign-out or app restart. Choosing a different current terrain clears the target choice.

The preview includes a procedural yellow excavator in a fixed pose. A downward raycast places its tracks on the current surface; its presentation proportions scale to the terrain footprint and are not surveyed machine dimensions. A bucket cutting-edge reference is available for the later cross-section. The camera frames the terrain and machine together. Terrain visibility switches leave the machine visible.

`getBucketCrossSections` calculates independent current/target triangle-intersection segments in a vertical plane through the bucket edge, aligned with the machine's digging direction. Each point contains signed horizontal distance from the bucket and world elevation in source-model units. Imported transforms and gaps are preserved; no intersection returns an empty profile. Point tangencies and coplanar triangles are excluded, and shared-edge duplicates are removed. This calculation is ready for the next increment's 2D panel; the preview does not display it yet.

**Sign out** returns to login and removes access to selection and preview, including through the Back button or a direct link. Excavator controls and cross-sections are later increments. Set `EXPO_PUBLIC_OFFLINE_MODE` to `false` and restart Metro to return to the existing authentication/hardware workflow.

Manual preview check: confirm both models load, switch each layer off/on, rotate in both directions, zoom, select top view, and reset. The models must remain aligned during camera changes. A loading failure displays an error with a retry action. This preview preserves source transforms; surveyed alignment and units still need confirmation against the source project.

Verified on an x86_64 Android API 37 emulator at 1080 x 2424 pixels, using React 19.1, Expo SDK 54, React Three Fiber 9.4.2, and Three.js 0.180.0. The existing normal-mode sign-in screen was also checked with offline mode disabled.

## Terrain asset inspection

Before adding models to the terrain catalog, inspect their packaging and mesh metadata:

```powershell
npm run inspect:terrain -- "C:\Models\current.glb" "C:\Models\target.gltf"
```

This command only needs Node.js; it works without `npm install`, Android, or the backend. It reads the files without modifying them and reports mesh names, triangle counts, referenced resources, and compression decoder requirements. Triangle counts describe mesh definitions once each, not scene instances. Both GLB and glTF resources are resolved relative to the model file; remote dependencies are reported without fetching them.

The command exits with `0` when the packaging checks pass, `1` for an unreadable/unsupported asset, malformed metadata, or unavailable resources, and `2` when no input paths are provided. Missing local resources, short external buffers, and remote dependencies fail the packaging check because the presentation must work offline. Compression extensions produce warnings to verify decoder support during renderer integration.

This is a metadata inspection tool, not a complete glTF validator. It does not decode geometry, textures, or data URI payloads, validate all accessor references, establish model alignment/units, identify the ground surface, or verify Android rendering. Those checks remain part of the rendering milestone.

Run its dependency-free tests with:

```powershell
npm run test:terrain
```

## Tests

Run the frontend tests from this directory:

```powershell
npm test
npm run test:coverage
```

Use `npm run test:watch` while developing. The Jest suite uses the Expo preset and tests NMEA parsing, NTRIP request validation, chunked binary response decoding, RTCM frame inspection, and the NTRIP connection lifecycle. It covers malformed inputs, checksum failures, coordinate boundaries, fragmented packets, write ordering, backpressure, timeouts, cleanup, and stale callbacks. Connection tests mock TCP/TLS sockets and Bluetooth writes, so no receiver or backend is required.

Coverage reports are written to `coverage/`. Physical-device checks are still needed for Bluetooth pairing, receiver configuration, correction delivery, and reaching an RTK fix.
