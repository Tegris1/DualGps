# Excavator arm IMUs: ESP32 + MPU6050

Flash one board per section. The same source builds three firmware images:

| Build environment | Packet `id` | Section | Bluetooth name |
| --- | --- | --- | --- |
| `boom` | `boom` | Main boom / wysięgnik | `DualGPS-IMU-boom-xxxxxx` |
| `arm` | `arm` | Stick / dipper / ramię | `DualGPS-IMU-arm-xxxxxx` |
| `bucket` | `bucket` | Bucket / łyżka | `DualGPS-IMU-bucket-xxxxxx` |

`xxxxxx` is a hardware-derived suffix. Every packet also contains a full 12-digit hexadecimal `device` ID derived from the ESP32's factory eFuse MAC value. The section identifies the machine part; the hardware ID distinguishes individual boards, including replacement boards with the same section firmware. It is an identifier, not an authentication secret or the displayed Bluetooth MAC address.

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
.\.venv\Scripts\python.exe -m platformio run
```

Connect one board over USB, find its port, and flash the environment for that board. Change `COM5` to its actual port. Run **one** of these commands for each board:

```powershell
.\.venv\Scripts\python.exe -m platformio run -e boom -t upload --upload-port COM5
.\.venv\Scripts\python.exe -m platformio run -e arm -t upload --upload-port COM5
.\.venv\Scripts\python.exe -m platformio run -e bucket -t upload --upload-port COM5
```

Inspect startup and I²C diagnostics over USB:

```powershell
.\.venv\Scripts\python.exe -m platformio device monitor --port COM5 --baud 115200
```

The build outputs are `.pio/build/<environment>/firmware.bin`; use PlatformIO's upload command to install the matching bootloader and partition table as well. Nothing in the build automatically flashes a connected board.

## Calibration and angle convention

At startup, keep each section stationary for approximately **two seconds**. The program estimates gyro bias from 200 consecutive stable samples. Movement restarts that window. Calibration removes gyro bias; it **does not declare the startup pose to be horizontal**. Bias is recalculated after reboot or an I²C fault.

The sensor reports the section's **absolute inclination relative to horizontal**, in degrees, upward positive, in `[-180, 180]`. It uses `atan2(ax, az)` for gravity tilt and integrates `-gyroY` between measurements. A complementary filter handles the angle wrap at ±180°. The MPU6050 is sampled at 100 Hz, with ±4 g acceleration, ±500 °/s gyro range, and approximately 20 Hz hardware low-pass filtering. Telemetry is sent at 20 Hz.

For a fixed mounting offset, add `-DIMU_ANGLE_OFFSET_DEG=-2.5f` (example only) to that board's `build_flags` in `platformio.ini`; retain its `-DIMU_SECTION` flag. `IMU_ANGLE_SIGN` can be `1.0f` or `-1.0f`. Compare at least two independently measured angles before selecting a sign or offset. These settings do not replace correct axis alignment or accelerometer scale calibration.

Large acceleration, clipping, sampling gaps, or excessive hinge-axis inclination make the angle unreliable. Gyro-only propagation is limited to one second before a new trustworthy gravity reading is required. Acceleration with a magnitude near 1 g can still contaminate gravity tilt: a six-axis MPU6050 cannot perfectly distinguish sustained machine acceleration from tilt. This implementation estimates planar section inclination; it provides no absolute yaw and does not integrate acceleration into a position estimate.

## Bluetooth protocol

The ESP32 is an SPP server; the Android app initiates the connection. Pair in Android settings first. With the pinned Arduino core, use `1234` if Android requests a legacy pairing PIN. Each message is one ASCII JSON object followed by `\n`, with a maximum of 512 characters. Example:

```json
{"type":"dualgps.imu","v":1,"id":"boom","device":"AABBCCDDEEFF","boot":123456,"seq":42,"ms":2100,"accel":[0.8660,0.0000,0.5000],"gyro":[0.000,0.000,0.000],"angle":60.000,"calibrated":true,"status":"ok"}
```

| Field | Meaning |
| --- | --- |
| `type`, `v` | Protocol marker and version |
| `id`, `device` | Section role and unique physical board ID |
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

1. Flash the three correct roles, power the boards, and keep them still until calibrated.
2. Pair their distinct `DualGPS-IMU-…` names in Android Bluetooth settings.
3. Open the native Dual GPS app in online mode, then **Settings > IMU**.
4. Select **boom**, refresh the paired sensors, select its device, and connect. Repeat for **arm** and **bucket**.
5. Check the reported hardware IDs, angles, raw measurements, and calibration status. A role or hardware mismatch is rejected. One Bluetooth address cannot be assigned to both a GNSS receiver and an IMU.
6. Return to the dashboard. Three fresh `ok` samples drive the separate boom, arm, and bucket pivots. The scene converts absolute angles into relative joint rotations and updates the bucket cross-section at up to 5 Hz. If any section is unavailable, the arm and its cross-section are hidden until the three valid readings return. Offline mode retains the demonstration pose and creates no hardware connections.

The existing excavator model still uses presentation proportions, terrain-based scale and placement, and a fixed heading. Moving it from IMU angles is **not yet a surveyed bucket position**: that requires measured hinge/link geometry, sensor mounting calibration, machine base attitude, and a calibrated transform from the GNSS receivers into the terrain coordinate system. The three arm sensors also do not measure the body pitch/roll, so online body inclination is shown as unavailable.

## Validation

All three firmware environments should compile before flashing. Frontend tests cover protocol validation, distinct IDs, sequence rollover, wrong-role rejection, sample freshness/skew, independent Bluetooth lifecycles, and absolute-to-relative arm kinematics. Compilation and software tests do not replace checking actual I²C hardware, mounting signs, vibration, Bluetooth range, or five simultaneous connections (two GNSS receivers plus three IMUs) on the intended Android phone.
