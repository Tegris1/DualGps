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
- Android Studio, Android SDK tools, and JDK 17. React Native 0.81 recommends JDK 17; see its [environment setup guide](https://reactnative.dev/docs/0.81/set-up-your-environment) and [Expo's local build guide](https://docs.expo.dev/guides/local-app-development/).
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

If sign-in shows `Authentication is not configured.`, the selected API URL is missing or empty. Create `.env` from `.env.example` and fill in the URL for your target. The example includes the Android emulator URL for a backend running on this computer at port 8080. Fully reload the app after changing `.env` so Expo includes the new values in the JavaScript bundle; see [Expo environment variables](https://docs.expo.dev/guides/environment-variables/). Authentication also requires the backend to be running.

Select JDK 17 before running the Android build. For a Windows installation at `C:\Program Files\Java\jdk-17`, run in the same PowerShell terminal:

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\android\gradlew.bat --version
```

Confirm that the launcher and daemon JVMs use Java 17. These variables apply to the current terminal; set `JAVA_HOME` in your Windows user environment and open a new terminal to make that selection persistent. The project's Gradle 8.14.3 does not support running on Java 25 or 26; a `com.facebook.react.settings` resolution failure showing `26.0.2.1` can result from that mismatch. See the [Gradle Java compatibility matrix](https://docs.gradle.org/current/userguide/compatibility.html).

Gradle also needs the Android SDK location. Set `ANDROID_HOME` to the SDK directory shown in Android Studio's SDK Manager, or create an untracked `android/local.properties` file with a machine-specific path such as:

```properties
sdk.dir=C:/Users/Iwona/AppData/Local/Android/Sdk
```

Use your own Windows account path. `android/local.properties` is ignored by Git and must be recreated if the generated Android directory is removed. See [Android build properties](https://developer.android.com/build#properties-files).

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
app/                        Expo Router routes, layouts, and navigation guards
features/
  auth/
    api/                    Authentication HTTP client and typed transport errors
    components/             Authentication form UI
    hooks/                  Form workflow
    auth-context.tsx        Persistent online session
    offline-session-context.tsx  In-memory presentation session
    errors.ts               Authentication failure contracts
  gps/
    components/             Receiver, GNSS, and settings views
    hooks/                  Bluetooth, diagnostics, corrections, and settings state
    presentation/           Status summaries, eligibility, and feedback mapping
    services/               NTRIP session readiness and retry lifecycle
    gps-context.tsx         One shared receiver/correction session
    eupos-settings.ts       Caster form conversion and saved-value parsing
    bluetooth-permissions.ts  Android permission adapter
    types.ts                Receiver/session and settings models
  terrain/                  Project selection, preview controls, and rendering
components/ui/              Shared form controls, styles, and platform icons
components/                 App-wide themed and navigation components
hooks/                      Theme and color-scheme hooks
lib/gps/                    NMEA, NTRIP, RTCM, and receiver protocol/transport code
lib/secure-storage.ts       Shared native/browser storage adapter
```

[useBluetoothSerial](features/gps/hooks/use-bluetooth-serial.ts) composes receiver, corrections, and diagnostics once inside [GpsProvider](features/gps/gps-context.tsx), preserving the controller consumed by the routes. Screens share that provider session; mounting or unmounting a consumer does not create or stop a native connection.

- [useBluetoothReceiver](features/gps/hooks/use-bluetooth-receiver.ts) owns paired-device discovery, permissions, receiver configuration, and native subscriptions. Connection/session identities reject cancelled attempts, late native results, and stale listeners.
- [useReceiverDiagnostics](features/gps/hooks/use-receiver-diagnostics.ts) owns NMEA readings and the last 200 console entries. It returns usable GGA sentences for corrections, and resets readings separately from console history.
- [useNtripSession](features/gps/hooks/use-ntrip-session.ts) binds the React lifecycle and settings to [NtripSession](features/gps/services/ntrip-session.ts). The session caches early GGA until configuration finishes, manages retries from 2 seconds up to 30 seconds, and invalidates old callbacks before stopping. Settings updates apply to subsequent starts/retries without reconnecting Bluetooth.
- [NtripConnection](lib/gps/ntrip-connection.ts) retains socket timeouts, GGA writes, serialized correction forwarding, backpressure, and RTCM diagnostics. Protocol parsing and framing remain under [lib/gps](lib/gps).

The online authentication route [app/auth.tsx](app/auth.tsx) connects [useAuthForm](features/auth/hooks/use-auth-form.ts) to the prop-driven [AuthForm](features/auth/components/auth-form.tsx). Validation lives in [features/auth/validation.ts](features/auth/validation.ts); the hook owns form state, submission, and errors. API calls and session storage stay in the authentication provider, and the root layout's route guard handles successful sign-in redirects.

Authentication operations return `AuthFailure | null`, preserving API error kind, HTTP status/body details, and persistence causes. [Authentication message mapping](features/auth/error-messages.ts) translates those failures and form-validation issues into display text. The EUPOS hook exposes a typed `saveResult`; the settings route maps it through [EUPOS feedback](features/gps/presentation/eupos-feedback.ts) before passing messages and severity to the view. Validation uses typed NTRIP setting errors, while raw storage and unexpected-error diagnostics stay separate from user-facing feedback.

Settings views receive explicit values and callbacks. [useReceiverControls](features/gps/hooks/use-receiver-controls.ts) connects the provider to the routes and coordinates selection, connection, and disconnection actions. [Receiver presentation](features/gps/presentation/receiver-state.ts) supplies shared eligibility rules, while [NTRIP presentation](features/gps/presentation/ntrip-status.ts) supplies consistent summaries, severity, and diagnostics for setup, Bluetooth settings, and debug. Connecting requires a profile and selected device; profile/device selection is locked during a pending connection. Setup retains its select-and-connect behavior, and settings retains separate selection and Connect actions. The EUPOS hook sanitizes port edits; password visibility and console scrolling remain local UI state.

Feature code owns its API, context, hooks, and views. Routes connect providers/navigation to those views. [Shared form controls](components/ui/form-controls.tsx) keep their own styles and have no auth/GPS dependencies; feature layout styles stay beside the settings views. Protocol modules remain independent of feature contexts and UI. Imports and existing test mocks point directly at the feature paths, with no compatibility modules at the old locations.

## Terrain rendering preview

The terrain preview displays the bundled `assets/terrain/Original.glb` and `assets/terrain/Target.glb` together. It provides layer switches, camera rotation, zoom, a top view, and reset. The current surface is brown; the target is a cyan wireframe overlay that stays visible through the current surface. Both models retain their exported placement and rotation, and the camera fits their combined bounds.

The `current-terrain` and `target-terrain` routes share `TerrainSelectionScreen` and `TerrainOptionCard` under `features/terrain/components`. The routes own terrain filtering and navigation; the shared components render the layout, selection state, and continue action. Terrain state and rendering also live under `features/terrain`, while the local sign-in session lives under `features/auth`.

Sign-in and the initial terrain selection reuse `TerrainHeader` and `TerrainButton`. Both online and offline previews use the shared dashboard under `features/dashboard`, including camera controls, layer visibility, the model cross-section, and the responsive layout. Shared terrain colors and typography are defined in `features/terrain/theme.ts`, including the surface colors used by the renderer and layer indicators.

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

The preview opens the dashboard with **TRYB OFFLINE · DANE PRZYKŁADOWE** displayed in its header. Both GNSS indicators, all IMUs, inclination, and the upper height-difference card use sample data. The 3D panel renders the selected terrain models, and the cross-section slices those models through the simulated bucket edge. Use **Widok** for camera controls, **Reset** to restore the camera, and **Warstwy** for layer visibility and terrain selection. Changing surfaces uses an in-place picker. Choices are retained while navigating between screens and cleared on sign-out or app restart. Choosing a different current terrain clears the target choice without ejecting the dashboard; select a new target in the picker.

The preview includes a procedural yellow excavator in a fixed pose. A downward raycast places its tracks on the current surface; its presentation proportions scale to the terrain footprint and are not surveyed machine dimensions. A bucket cutting-edge reference is available for the later cross-section. The camera frames the terrain and machine together. Terrain visibility switches leave the machine visible.

The offline preview route supplies demo readings and local session sign-out to [DashboardScreen](features/dashboard/containers/dashboard-screen.tsx). The online Home route supplies readings from the existing GPS provider and callbacks for connection setup and settings. [Dashboard presentation](features/dashboard/presentation/dashboard-readings.ts) prepares display values without accessing either provider. The shared dashboard composes [useTerrainPreview](features/terrain/hooks/use-terrain-preview.ts), whose stable loading callback keeps camera and visibility changes from disposing the scene. Preview failures are contained inside the terrain panel, with cache clearing before retry; the route-level error boundary remains a fallback for other rendering errors. Three.js loading, camera synchronization, and resource disposal remain in the scene.

`getBucketCrossSections` calculates independent current/target triangle-intersection segments in a vertical plane through the bucket edge, aligned with the machine's digging direction. The scene calculates the section once for each loaded model pair and publishes plain segment data to the dashboard. The chart preserves gaps and overlapping layers, displays distance and height relative to the bucket in model units (`j.m.`), and labels the bucket position as simulated. It shows a comparison only when one unique design elevation exists beneath the bucket; gaps and overlapping design elevations do not produce a guessed value. Camera changes and layer visibility do not recompute the section. See [model cross-section details](docs/terrain-cross-section.md).

**Menu > Wyloguj** returns to login and removes access to selection and preview, including through the Back button or a direct link. Offline mode omits connection setup and settings from the dashboard menu. Set `EXPO_PUBLIC_OFFLINE_MODE` to `false` and restart Metro to return to the authentication/hardware workflow.

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
