# Excavator arm IMUs: ESP32 + MPU6050

Flash the **same `imu` firmware** to every board. No boom/arm/bucket ID is configured in the firmware. Choose the section in the Android app after pairing.

Each ESP32 derives a stable **UUIDv5** from its factory eFuse MAC bytes and the fixed project namespace `6d8f8ce2-4fe4-4f76-8f3c-0820e381b83d`. The UUID remains the same across power loss, normal reflashing, and flash erasure. Replacing the board changes the UUID. Do not change the namespace after deploying sensors. UUID construction follows [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.5); the UUID identifies a sensor and is not an authentication secret.

The Bluetooth name is `DualGPS-IMU-<full UUID>`, for example `DualGPS-IMU-3ea34a50-4d30-5c51-8fe3-b1249a7a3101`. Every telemetry packet includes the same UUID, without a section label or a separate MAC-based device field.

## Hardware and wiring

Use an **original ESP32**, such as an ESP32-WROOM-32 DevKit, with Bluetooth Classic SPP. ESP32-S3/C3/C6 and S2 do not support this transport. This matches the Android frontend's existing Bluetooth Classic library. See [Espressif's Bluetooth documentation](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/bluetooth.html).

Each board needs its own MPU6050, short I²C wiring, and a suitable regulated supply. Wire each assembly as follows:

| MPU6050 breakout | ESP32 DevKit |
| --- | --- |
| VCC | 3V3 on a breakout that supports a 3.3 V supply |
| GND | GND |
| SDA | GPIO 21 |
| SCL | GPIO 22 |
| AD0 | GND for address `0x68`, or 3V3 for `0x69` |
| INT | Unconnected |

The driver probes both I²C addresses. Use 3.3 V I²C pull-ups; do not pull the ESP32's pins up to 5 V. Check your particular breakout's regulator and pull-up wiring. Disconnect external machine power while making wiring changes.

Mount the sensor rigidly: **+X points from the section's hinge toward its next hinge**, or from the bucket hinge toward its cutting edge. **Y lies along the hinge axis. +Z points up when the section is horizontal.** The boom and stick frames use their respective hinge-to-hinge vectors; the bucket uses the hinge-to-cutting-edge vector. Those conventions are essential for matching the frontend's joint model.

## Build and flash

Open this directory in PlatformIO, or install PlatformIO Core in a local environment. The pinned platform uses Arduino-ESP32 2.0.17 and requires no additional MPU6050 library. [Platform release](https://github.com/platformio/platform-espressif32/releases/tag/v6.12.0), [MPU6050 register map](https://www.invensense.com/wp-content/uploads/2015/02/MPU-6000-Register-Map1.pdf).

PowerShell setup, from this directory:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install platformio==6.1.18
$env:PLATFORMIO_CORE_DIR = Join-Path (Get-Location) '.pio-core'
.\.venv\Scripts\python.exe -m platformio run -e imu
```

Connect one board over USB, find its port, and upload the generic firmware. Change `COM5` to its actual port. Repeat the same command for the other boards; no source or ID changes are needed:

```powershell
.\.venv\Scripts\python.exe -m platformio device list
.\.venv\Scripts\python.exe -m platformio run -e imu -t upload --upload-port COM5
```

Inspect startup and I²C diagnostics over USB:

```powershell
.\.venv\Scripts\python.exe -m platformio device monitor --port COM5 --baud 115200
```

The build outputs are `.pio/build/imu/firmware.bin`; use PlatformIO's upload command to install the matching bootloader and partition table as well. Nothing in the build automatically flashes a connected board.

## Calibration and angle convention

At startup, keep each section stationary for approximately **two seconds**. The program estimates gyro bias from 200 consecutive stable samples. Movement restarts that window. Calibration removes gyro bias; it **does not declare the startup pose to be horizontal**. Bias is recalculated after reboot or an I²C fault.

The sensor reports the section's **absolute inclination relative to horizontal**, in degrees, upward positive, in `[-180, 180]`. It uses `atan2(ax, az)` for gravity tilt and integrates `-gyroY` between measurements. A complementary filter handles the angle wrap at ±180°. The MPU6050 is sampled at 100 Hz, with ±4 g acceleration, ±500 °/s gyro range, and approximately 20 Hz hardware low-pass filtering. Telemetry is sent at 20 Hz.

For a fixed mounting offset, add `-DIMU_ANGLE_OFFSET_DEG=-2.5f` (example only) to `build_flags` in `platformio.ini`. This is a mounting adjustment, independent of section assignment. `IMU_ANGLE_SIGN` can be `1.0f` or `-1.0f`. Compare at least two independently measured angles before selecting a sign or offset. These settings do not replace correct axis alignment or accelerometer scale calibration.

Large acceleration, clipping, sampling gaps, or excessive hinge-axis inclination make the angle unreliable. Gyro-only propagation is limited to one second before a new trustworthy gravity reading is required. Acceleration with a magnitude near 1 g can still contaminate gravity tilt: a six-axis MPU6050 cannot perfectly distinguish sustained machine acceleration from tilt. This implementation estimates planar section inclination; it provides no absolute yaw and does not integrate acceleration into a position estimate.

## Bluetooth protocol

The ESP32 is an SPP server; the Android app initiates the connection. Pair in Android settings first. With the pinned Arduino core, use `1234` if Android requests a legacy pairing PIN. Each message is one ASCII JSON object followed by `\n`, with a maximum of 512 characters. Example:

```json
{"type":"dualgps.imu","v":2,"uuid":"3ea34a50-4d30-5c51-8fe3-b1249a7a3101","boot":123456,"seq":42,"ms":2100,"accel":[0.8660,0.0000,0.5000],"gyro":[0.000,0.000,0.000],"angle":60.000,"calibrated":true,"status":"ok"}
```

| Field | Meaning |
| --- | --- |
| `type`, `v` | Protocol marker and version |
| `uuid` | Stable sensor UUIDv5; the section is assigned in the app |
| `boot` | Random unsigned 32-bit boot/session identifier |
| `seq` | Unsigned 32-bit packet counter, wraps naturally |
| `ms` | Board uptime from `millis()`, wraps naturally |
| `accel` | X/Y/Z acceleration **including gravity**, in g |
| `gyro` | X/Y/Z angular velocity in °/s; bias corrected after calibration |
| `angle` | Section inclination in degrees; `null` if unusable |
| `calibrated` | Whether stationary gyro bias calibration has completed |
| `status` | `ok`, `calibrating`, `unreliable`, or `sensor-error` |

Missing or failed MPU6050 reads produce `sensor-error` packets with `angle:null`; the firmware probes again once per second. An unavailable angle is never encoded as a valid zero. A separate Bluetooth transmit task and a queue with one pending packet keep slow transmission from blocking sensor sampling. No text diagnostics or GNSS correction commands are mixed into the Bluetooth stream.

Board uptime is not synchronized between sensors. The frontend records local arrival time, expires samples after one second, and requires the three latest samples to arrive within 200 ms of one another. This bounds arrival skew; it is not precise acquisition-time synchronization.

## Use in Dual GPS

This is protocol **v2**. Update both firmware and app together. An older v1 app cannot read these packets; the updated app rejects v1 packets. If Android caches the old role-based Bluetooth name, unpair and pair the board again.

1. Flash the same firmware to all three boards, power them, and keep them still until calibrated.
2. Pair their `DualGPS-IMU-<UUID>` names in Android Bluetooth settings.
3. Open the native Dual GPS app in online mode, then **Settings > IMU**.
4. Select **boom**, refresh the paired sensors, choose the UUID mounted on the boom, and press **Assign and connect IMU**. Repeat for **arm** and **bucket**. Any board can be used for any section.
5. The app saves each UUID/address-to-section mapping. It restores assignments after restart but connects only when requested. A UUID cannot be assigned to two sections. To move a board, disconnect it and **Clear assignment** in its old section, then assign it in the new section.
6. Incoming telemetry must match the selected UUID. Identity mismatches and stale data do not move the model. Three fresh `ok` samples drive the boom, arm, and bucket pivots; offline mode keeps its demonstration pose without Bluetooth.

The existing excavator model still uses presentation proportions, terrain-based scale and placement, and a fixed heading. Moving it from IMU angles is **not yet a surveyed bucket position**: that requires measured hinge/link geometry, sensor mounting calibration, machine base attitude, and a calibrated transform from the GNSS receivers into the terrain coordinate system. The three arm sensors also do not measure the body pitch/roll, so online body inclination is shown as unavailable.

## Validation

The single `imu` firmware environment should compile before flashing. Frontend tests cover protocol validation, UUID validation, saved section assignments, sequence rollover, mismatched-UUID rejection, sample freshness/skew, independent Bluetooth lifecycles, and absolute-to-relative arm kinematics. Compilation and software tests do not replace checking actual I²C hardware, mounting signs, vibration, Bluetooth range, or five simultaneous connections (two GNSS receivers plus three IMUs) on the intended Android phone.
