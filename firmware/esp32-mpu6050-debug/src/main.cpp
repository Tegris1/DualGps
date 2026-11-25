#include <Arduino.h>
#include <Wire.h>
#include <math.h>

namespace {
constexpr int SdaPin = 21;
constexpr int SclPin = 22;
constexpr uint32_t StandardClock = 100000;
constexpr uint32_t ProductionClock = 400000;
constexpr uint32_t ProbeIntervalMs = 2000;
constexpr uint32_t SampleIntervalMs = 200;
constexpr uint8_t MpuAddresses[] = {0x68, 0x69};
constexpr uint8_t WhoAmI = 0x75;
constexpr uint8_t Mpu6050Identity = 0x68;
constexpr uint8_t PowerManagement1 = 0x6B;
constexpr uint8_t FirstSampleRegister = 0x3B;

uint32_t busClock = StandardClock;
bool busReady = false;
uint8_t sensorAddress = 0;
uint32_t lastProbe = 0;
uint32_t lastSample = 0;

void printCommands() {
  Serial.println("Commands: s = scan I2C bus, r = retry, 1 = 100 kHz, 4 = 400 kHz, ? = help");
}

void restartBus() {
  sensorAddress = 0;
  if (busReady) Wire.end();
  pinMode(SdaPin, INPUT);
  pinMode(SclPin, INPUT);
  delay(1);
  Serial.printf("Bus before I2C start: SDA GPIO %d %s, SCL GPIO %d %s\n",
                SdaPin, digitalRead(SdaPin) ? "HIGH" : "LOW",
                SclPin, digitalRead(SclPin) ? "HIGH" : "LOW");
  busReady = Wire.begin(SdaPin, SclPin, busClock);
  Wire.setTimeOut(20);
  Serial.printf("I2C at %lu Hz: %s\n", static_cast<unsigned long>(busClock),
                busReady ? "started" : "initialization failed");
  lastProbe = millis() - ProbeIntervalMs;
}

uint8_t probeAddress(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission();
}

void scanBus() {
  if (!busReady) {
    Serial.println("I2C unavailable. Send r to retry initialization.");
    return;
  }
  unsigned found = 0;
  Serial.println("Scanning 7-bit I2C addresses 0x08 through 0x77");
  for (uint8_t address = 0x08; address <= 0x77; ++address) {
    const uint8_t status = probeAddress(address);
    if (status == 0) {
      Serial.printf("  ACK at 0x%02X\n", address);
      ++found;
    } else if (status != 2) {
      Serial.printf("  Scan stopped at 0x%02X: Wire status %u\n", address, status);
      return;
    }
  }
  Serial.printf("Scan complete: %u address(es) answered\n", found);
}

bool readRegisters(uint8_t address, uint8_t reg, uint8_t *buffer, size_t count) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  const uint8_t status = Wire.endTransmission(false);
  if (status != 0) {
    Serial.printf("Address 0x%02X register 0x%02X: register select failed (Wire status %u)\n",
                  address, reg, status);
    return false;
  }
  const size_t received = Wire.requestFrom(static_cast<uint16_t>(address), count, true);
  if (received != count) {
    Serial.printf("Address 0x%02X register 0x%02X: read %u of %u bytes\n",
                  address, reg, static_cast<unsigned>(received), static_cast<unsigned>(count));
    return false;
  }
  for (size_t i = 0; i < count; ++i) buffer[i] = Wire.read();
  return true;
}

bool writeRegister(uint8_t address, uint8_t reg, uint8_t value) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.write(value);
  const uint8_t status = Wire.endTransmission();
  if (status == 0) return true;
  Serial.printf("Address 0x%02X register 0x%02X: write 0x%02X failed (Wire status %u)\n",
                address, reg, value, status);
  return false;
}

bool configureSensor(uint8_t address) {
  if (!writeRegister(address, PowerManagement1, 0x80)) return false;
  delay(100);

  // Match the production ranges and sample settings so the same setup is exercised.
  const uint8_t settings[][2] = {
    {PowerManagement1, 0x01},  // Wake, PLL with X gyro reference
    {0x6C, 0x00},             // Enable all axes
    {0x1A, 0x04},             // Low-pass filter at about 20 Hz
    {0x19, 0x09},             // 100 Hz sample rate
    {0x1B, 0x08},             // Gyro +/-500 deg/s
    {0x1C, 0x08},             // Accel +/-4 g
  };
  for (const auto &setting : settings) {
    const uint8_t reg = setting[0];
    const uint8_t expected = setting[1];
    uint8_t actual;
    if (!writeRegister(address, reg, expected) || !readRegisters(address, reg, &actual, 1)) return false;
    if (actual != expected) {
      Serial.printf("Address 0x%02X register 0x%02X: expected 0x%02X, read 0x%02X\n",
                    address, reg, expected, actual);
      return false;
    }
  }
  return true;
}

void findSensor() {
  for (uint8_t address : MpuAddresses) {
    const uint8_t status = probeAddress(address);
    if (status != 0) {
      Serial.printf("Probe 0x%02X: no ACK (Wire status %u)\n", address, status);
      continue;
    }
    Serial.printf("Probe 0x%02X: ACK\n", address);
    uint8_t identity;
    if (!readRegisters(address, WhoAmI, &identity, 1)) continue;
    Serial.printf("  WHO_AM_I=0x%02X (expected 0x%02X)\n", identity, Mpu6050Identity);
    if (identity != Mpu6050Identity || !configureSensor(address)) continue;
    sensorAddress = address;
    Serial.printf("MPU6050 ready at 0x%02X. Live samples at 5 Hz.\n", sensorAddress);
    return;
  }
  Serial.println("Waiting for a usable MPU6050. Retrying in 2 seconds.");
}

int16_t signedWord(const uint8_t *bytes) {
  return static_cast<int16_t>((static_cast<uint16_t>(bytes[0]) << 8) | bytes[1]);
}

bool printSample(uint32_t now) {
  uint8_t data[14]; // Three accelerometer axes, temperature, three gyro axes.
  if (!readRegisters(sensorAddress, FirstSampleRegister, data, sizeof(data))) return false;

  const float ax = signedWord(data) / 8192.0f;
  const float ay = signedWord(data + 2) / 8192.0f;
  const float az = signedWord(data + 4) / 8192.0f;
  const float temp = signedWord(data + 6) / 340.0f + 36.53f;
  const float gx = signedWord(data + 8) / 65.5f;
  const float gy = signedWord(data + 10) / 65.5f;
  const float gz = signedWord(data + 12) / 65.5f;
  const float norm = sqrtf(ax * ax + ay * ay + az * az);
  Serial.printf("DATA %lu ms accel[g]=(%+.3f,%+.3f,%+.3f) gyro[deg/s]=(%+.2f,%+.2f,%+.2f) norm[g]=%.3f temp[C]=%.1f\n",
                static_cast<unsigned long>(now), ax, ay, az, gx, gy, gz, norm, temp);
  return true;
}

void handleCommand() {
  switch (Serial.read()) {
    case 's': scanBus(); break;
    case 'r': restartBus(); break;
    case '1': busClock = StandardClock; restartBus(); break;
    case '4': busClock = ProductionClock; restartBus(); break;
    case '?': printCommands(); break;
  }
}
} // namespace

void setup() {
  Serial.begin(115200);
  Serial.println("\nDualGPS MPU6050 USB diagnostic");
  printCommands();
  restartBus();
}

void loop() {
  if (Serial.available()) handleCommand();
  const uint32_t now = millis();
  if (sensorAddress == 0 && now - lastProbe >= ProbeIntervalMs) {
    if (!busReady) restartBus();
    lastProbe = millis();
    if (busReady) findSensor();
  } else if (sensorAddress != 0 && now - lastSample >= SampleIntervalMs) {
    lastSample = now;
    if (!printSample(now)) {
      sensorAddress = 0;
      lastProbe = now;
      Serial.println("Lost sensor data. Retrying in 2 seconds.");
    }
  }
  delay(1);
}
