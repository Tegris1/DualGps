#include <Arduino.h>
#include <BluetoothSerial.h>
#include <Wire.h>
#include <esp_system.h>
#include <math.h>
#include <mbedtls/sha1.h>
#include "config.h"

#if !defined(CONFIG_BT_SPP_ENABLED)
#error "This firmware needs an original ESP32 with Bluetooth Classic SPP (e.g. WROOM-32)"
#endif

namespace {
BluetoothSerial bluetooth;
struct Packet { char text[512]; size_t length; };
QueueHandle_t outgoing;
char sensorUuid[37];
uint32_t bootId, sequence = 0;
uint8_t mpuAddress = 0;
float accel[3] = {}, gyro[3] = {}, bias[3] = {};
float angle = 0;
bool calibrated = false, angleInitialized = false;
uint32_t lastSample = 0, lastGravity = 0;

bool initializeUuid() {
  // UUIDv5: project namespace 6d8f8ce2-4fe4-4f76-8f3c-0820e381b83d,
  // followed by the six factory MAC bytes. Keep this namespace unchanged so
  // reflashing (even after erasing flash) preserves the board's identity.
  uint8_t input[22] = {0x6d, 0x8f, 0x8c, 0xe2, 0x4f, 0xe4, 0x4f, 0x76,
                       0x8f, 0x3c, 0x08, 0x20, 0xe3, 0x81, 0xb8, 0x3d};
  const uint64_t mac = ESP.getEfuseMac();
  for (unsigned i = 0; i < 6; ++i) input[16 + i] = static_cast<uint8_t>(mac >> (8*i));
  uint8_t digest[20];
  if (mbedtls_sha1_ret(input, sizeof(input), digest) != 0) return false;
  digest[6] = (digest[6] & 0x0f) | 0x50; // version 5
  digest[8] = (digest[8] & 0x3f) | 0x80; // RFC variant
  const char hex[] = "0123456789abcdef";
  unsigned out = 0;
  for (unsigned i = 0; i < 16; ++i) {
    if (i == 4 || i == 6 || i == 8 || i == 10) sensorUuid[out++] = '-';
    sensorUuid[out++] = hex[digest[i] >> 4];
    sensorUuid[out++] = hex[digest[i] & 0x0f];
  }
  sensorUuid[out] = '\0';
  return true;
}

float wrapAngle(float degrees) {
  while (degrees >= 180.0f) degrees -= 360.0f;
  while (degrees < -180.0f) degrees += 360.0f;
  return degrees;
}

// Gyro bias only: never zero the section's actual inclination at startup.
struct Calibration {
  unsigned count = 0;
  float sum[3] = {}, gyroMin[3] = {}, gyroMax[3] = {}, accelMin[3] = {}, accelMax[3] = {};

  void reset() { count = 0; for (float &value : sum) value = 0; }

  bool add() {
    const float norm = sqrtf(accel[0]*accel[0] + accel[1]*accel[1] + accel[2]*accel[2]);
    if (norm < 0.9f || norm > 1.1f) { reset(); return false; }
    for (unsigned axis = 0; axis < 3; ++axis) {
      if (fabsf(gyro[axis]) > 10.0f) { reset(); return false; }
      if (count == 0) {
        gyroMin[axis] = gyroMax[axis] = gyro[axis];
        accelMin[axis] = accelMax[axis] = accel[axis];
      } else {
        gyroMin[axis] = fminf(gyroMin[axis], gyro[axis]);
        gyroMax[axis] = fmaxf(gyroMax[axis], gyro[axis]);
        accelMin[axis] = fminf(accelMin[axis], accel[axis]);
        accelMax[axis] = fmaxf(accelMax[axis], accel[axis]);
        if (gyroMax[axis] - gyroMin[axis] > 1.0f || accelMax[axis] - accelMin[axis] > 0.06f) {
          reset(); return false;
        }
      }
    }
    for (unsigned axis = 0; axis < 3; ++axis) sum[axis] += gyro[axis];
    if (++count < 200) return false;
    for (unsigned axis = 0; axis < 3; ++axis) bias[axis] = sum[axis] / count;
    return true;
  }
} calibration;

bool writeRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(mpuAddress);
  Wire.write(reg); Wire.write(value);
  return Wire.endTransmission() == 0;
}

bool readRegisters(uint8_t reg, uint8_t *buffer, size_t count) {
  Wire.beginTransmission(mpuAddress);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(static_cast<uint16_t>(mpuAddress), count, true) != count) return false;
  for (size_t i = 0; i < count; ++i) buffer[i] = Wire.read();
  return true;
}

bool initializeMpu() {
  calibrated = angleInitialized = false;
  calibration.reset();
  for (uint8_t address : {0x68, 0x69}) {
    mpuAddress = address;
    uint8_t identity;
    if (!readRegisters(0x75, &identity, 1) || identity != 0x68) continue;
    if (!writeRegister(0x6B, 0x80)) continue; // reset
    delay(100);
    if (writeRegister(0x6B, 0x01) && // wake, PLL X gyro clock
        writeRegister(0x6C, 0x00) && // enable every axis
        writeRegister(0x1A, 0x04) && // DLPF: accel 21 Hz, gyro 20 Hz
        writeRegister(0x19, 0x09) && // 1 kHz / (9+1) = 100 Hz
        writeRegister(0x1B, 0x08) && // gyro +/-500 deg/s: 65.5 LSB/(deg/s)
        writeRegister(0x1C, 0x08)) { // accel +/-4 g: 8192 LSB/g
      lastSample = millis();
      Serial.printf("MPU6050 at 0x%02X; keep still for gyro calibration.\n", mpuAddress);
      return true;
    }
  }
  mpuAddress = 0;
  return false;
}

int16_t signedWord(const uint8_t *bytes) {
  return static_cast<int16_t>((static_cast<uint16_t>(bytes[0]) << 8) | bytes[1]);
}

bool sample(uint32_t now) {
  uint8_t bytes[14];
  if (!readRegisters(0x3B, bytes, sizeof(bytes))) return false;
  for (unsigned axis = 0; axis < 3; ++axis) {
    accel[axis] = signedWord(bytes + 2*axis) / 8192.0f;
    gyro[axis] = signedWord(bytes + 8 + 2*axis) / 65.5f;
  }
  const float dt = static_cast<uint32_t>(now - lastSample) / 1000.0f;
  lastSample = now;
  if (!calibrated) calibrated = calibration.add();
  if (!calibrated) return true;
  for (unsigned axis = 0; axis < 3; ++axis) gyro[axis] -= bias[axis];
  const float norm = sqrtf(accel[0]*accel[0] + accel[1]*accel[1] + accel[2]*accel[2]);
  // Gravity cannot correct pitch if the sensor is accelerating or its hinge
  // axis is far from horizontal. Gyro-only propagation lasts at most one second.
  const bool gravityTrusted = norm > 0.85f && norm < 1.15f && fabsf(accel[1]) < 0.35f;
  bool clipped = false;
  for (unsigned axis = 0; axis < 3; ++axis) {
    clipped |= fabsf(accel[axis]) > 3.95f || fabsf(gyro[axis]) > 490.0f;
  }
  if (clipped || dt > 0.1f) { angleInitialized = false; return true; }
  const float gravityAngle = atan2f(accel[0], accel[2]) * RAD_TO_DEG;
  if (!angleInitialized) {
    if (gravityTrusted) { angle = gravityAngle; angleInitialized = true; lastGravity = now; }
    return true;
  }
  angle = wrapAngle(angle - gyro[1] * dt);
  if (gravityTrusted) {
    const float weight = dt / (0.5f + dt);
    angle = wrapAngle(angle + weight * wrapAngle(gravityAngle - angle));
    lastGravity = now;
  } else if (static_cast<uint32_t>(now - lastGravity) > 1000) {
    angleInitialized = false;
  }
  return true;
}

void queueTelemetry(uint32_t now, bool sensorPresent) {
  const bool valid = sensorPresent && calibrated && angleInitialized;
  const char *status = !sensorPresent ? "sensor-error" : !calibrated ? "calibrating" : !valid ? "unreliable" : "ok";
  char angleText[24] = "null";
  if (valid) snprintf(angleText, sizeof(angleText), "%.3f", wrapAngle(IMU_ANGLE_SIGN * angle + IMU_ANGLE_OFFSET_DEG));
  Packet packet{};
  const int length = snprintf(packet.text, sizeof(packet.text),
    "{\"type\":\"dualgps.imu\",\"v\":2,\"uuid\":\"%s\","
    "\"boot\":%lu,\"seq\":%lu,\"ms\":%lu,\"accel\":[%.4f,%.4f,%.4f],"
    "\"gyro\":[%.3f,%.3f,%.3f],\"angle\":%s,\"calibrated\":%s,\"status\":\"%s\"}\n",
    sensorUuid, static_cast<unsigned long>(bootId), static_cast<unsigned long>(sequence++),
    static_cast<unsigned long>(now), accel[0], accel[1], accel[2], gyro[0], gyro[1], gyro[2],
    angleText, calibrated ? "true" : "false", status);
  if (length <= 0 || static_cast<size_t>(length) >= sizeof(packet.text)) return;
  packet.length = length;
  xQueueOverwrite(outgoing, &packet); // bounded: retain only the newest unsent sample
}

void sendTelemetry(void *) {
  Packet packet;
  for (;;) {
    if (xQueueReceive(outgoing, &packet, portMAX_DELAY) == pdTRUE) {
      if (bluetooth.hasClient()) bluetooth.write(reinterpret_cast<const uint8_t *>(packet.text), packet.length);
    }
  }
}
} // namespace

void setup() {
  Serial.begin(115200);
  if (!initializeUuid()) {
    Serial.println("Sensor UUID initialization failed; reboot the board.");
    for (;;) delay(1000);
  }
  bootId = esp_random();
  char name[64];
  snprintf(name, sizeof(name), "DualGPS-IMU-%s", sensorUuid);
  Wire.begin(SDA_PIN, SCL_PIN, 400000);
  Wire.setTimeOut(20);
  outgoing = xQueueCreate(1, sizeof(Packet));
  if (!outgoing || !bluetooth.begin(name) ||
      xTaskCreate(sendTelemetry, "imu-bt", 4096, nullptr, 1, nullptr) != pdPASS) {
    Serial.println("Bluetooth/task initialization failed; reboot the board.");
    for (;;) delay(1000);
  }
  Serial.printf("Sensor UUID: %s; pair with %s; assign the section in the app.\n", sensorUuid, name);
}

void loop() {
  static bool present = false;
  static uint32_t retryAt = millis() - 1000, sampledAt = 0, sentAt = 0;
  uint32_t now = millis();
  if (!present && static_cast<uint32_t>(now - retryAt) >= 1000) {
    retryAt = now;
    present = initializeMpu();
    if (!present) Serial.println("MPU6050 not found; checking SDA/SCL/AD0 again in one second.");
    now = millis();
    sampledAt = now;
  }
  if (present && static_cast<uint32_t>(now - sampledAt) >= SAMPLE_PERIOD_MS) {
    sampledAt = now;
    if (!sample(now)) {
      present = calibrated = angleInitialized = false;
      calibration.reset();
    }
  }
  if (static_cast<uint32_t>(now - sentAt) >= SEND_PERIOD_MS) {
    sentAt = now;
    queueTelemetry(now, present);
  }
  // Discard incoming bytes: these sensors do not accept GNSS/RTCM commands.
  for (unsigned count = 0; count < 64 && bluetooth.available(); ++count) bluetooth.read();
  delay(1);
}
