# MPU6050 USB diagnostic

This standalone PlatformIO project uses the original ESP32 DevKit pinout from DualGPS. Connect SDA to GPIO 21, SCL to GPIO 22 and share ground. Use the breakout's 3.3 V supply and I²C pull-ups as described in the [production wiring guide](../esp32-mpu6050/README.md#hardware-and-wiring).

## Run on one board

From the repository root, connect the ESP32 by USB and find its serial port. Replace `COM5` in the examples with the port for your board.

```powershell
pio device list
pio run -d firmware/esp32-mpu6050-debug -t upload --upload-port COM5
pio device monitor --port COM5 --baud 115200
```

If your PlatformIO installation is in `firmware/esp32-mpu6050/.venv`, use `& $pioPython -m platformio` in place of `pio` in those commands:

```powershell
$pioPython = '.\firmware\esp32-mpu6050\.venv\Scripts\python.exe'
$env:PLATFORMIO_CORE_DIR = (Resolve-Path '.\firmware\esp32-mpu6050\.pio-core').Path
```

Press the board's **EN/RESET** button with the monitor open to see the startup report. The diagnostic probes `0x68` and `0x69`, checks `WHO_AM_I`, and verifies the sensor configuration. It retries every two seconds while the sensor is unavailable. Once the sensor is ready, readings arrive at about 5 Hz without a calibration step.

| Key | Action |
| --- | --- |
| `s` | Scan the I²C bus for responding addresses |
| `r` | Restart the I²C bus and probe the sensor again |
| `1` | Use the default test speed of 100 kHz |
| `4` | Use 400 kHz, the production firmware's bus speed |
| `?` | Print the commands |

## Interpret the output

- **No serial output after reset** points to the COM port, baud rate, USB cable, or firmware upload. Start by looking for the diagnostic banner.
- **Neither address answers**. Look at the reported idle levels for SDA and SCL, then try `s`. I²C lines normally idle high with pull-ups. Wire status `2` indicates a transfer with no ACK in this probe. Status `5` indicates a timeout.
- **An address answers but `WHO_AM_I` differs from `0x68`**. Check the chip model and the exact value returned. `0x69` is a valid I²C address when AD0 is high, and an MPU6050 at that address still reports `WHO_AM_I=0x68`. [MPU6050 register map](https://www.invensense.com/wp-content/uploads/2015/02/MPU-6000-Register-Map1.pdf)
- **`DATA` lines appear**. With the sensor still, the acceleration norm should be around 1 g and the gyro readings should be near zero. Tilt or rotate the sensor to see the axes respond. Try `4` to repeat the check at production speed. Read errors that appear only at 400 kHz point to a speed-dependent I²C problem.

The upload replaces the ESP32's current firmware. After the check, close the serial monitor and restore the Bluetooth firmware to resume normal operation.

```powershell
pio run -d firmware/esp32-mpu6050 -e imu -t upload --upload-port COM5
```
