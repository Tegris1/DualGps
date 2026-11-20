import { expect, it } from "@jest/globals";
import { getArmAngles, ImuStream, IMU_MAX_AGE_MS, parseImuPacket, type ImuReading } from "../../lib/imu/imu-protocol";
import { imuPacket } from "../fixtures/imu";

it("reads distinct section/hardware IDs, physical units and fault states", () => {
  for (const id of ["boom", "arm", "bucket"] as const) {
    const packet = imuPacket(id);
    expect(parseImuPacket(JSON.stringify(packet))).toEqual(packet);
    expect(parseImuPacket(JSON.stringify({ ...packet, status: "calibrating", calibrated: false, angle: null })))
      .toMatchObject({ id, status: "calibrating", angle: null });
    expect(parseImuPacket(JSON.stringify({ ...packet, status: "sensor-error", calibrated: false, angle: null })))
      .toMatchObject({ id, status: "sensor-error", angle: null });
  }
});

it.each([
  { v: 2 }, { type: "nmea" }, { id: "body" }, { device: "same" }, { seq: -1 }, { seq: 1.1 },
  { seq: 0x100000000 }, { boot: "1" }, { ms: null }, { angle: 181 }, { angle: "60" },
  { angle: null }, { calibrated: false }, { accel: [0, 0] }, { accel: [0, 0, 10] },
  { accel: [0, "0", 1] }, { gyro: [0, 0, 1000] }, { status: "unknown" },
  { status: "sensor-error", angle: 0 },
])("rejects malformed or unsupported telemetry %j", (invalid) => {
  expect(parseImuPacket(JSON.stringify({ ...imuPacket("boom"), ...invalid }))).toBeNull();
});

it("rejects corrupt JSON, oversized frames and nonobjects", () => {
  for (const line of ["{", "null", "[]", "1", "x".repeat(513), '{"angle":NaN}']) {
    expect(parseImuPacket(line)).toBeNull();
  }
});

it("pins a connection to its section and hardware ID and rejects repeated/out-of-order packets", () => {
  const stream = new ImuStream("arm");
  expect(stream.accept(JSON.stringify(imuPacket("boom")), 1000)).toBeNull();
  expect(stream.error).toContain("Expected arm");
  expect(stream.accept(JSON.stringify(imuPacket("arm")), 1000)?.angle).toBe(60);
  expect(stream.error).toBeNull();
  expect(stream.accept(JSON.stringify(imuPacket("arm", { seq: 42 })), 1100)).toBeNull();
  expect(stream.accept(JSON.stringify(imuPacket("arm", { seq: 41 })), 1100)).toBeNull();
  expect(stream.accept(JSON.stringify(imuPacket("arm", { seq: 43, device: "FFFFFFFFFFFF" })), 1100)).toBeNull();
  expect(stream.error).toContain("hardware ID changed");
  expect(stream.accept(JSON.stringify(imuPacket("arm", { seq: 43 })), 1200)?.receivedAt).toBe(1200);
});

it("handles packet counter rollover and board reboot without using board uptime as phone time", () => {
  const stream = new ImuStream("bucket");
  expect(stream.accept(JSON.stringify(imuPacket("bucket", { seq: 0xffffffff, ms: 0xffffffff })), 1000)).not.toBeNull();
  expect(stream.accept(JSON.stringify(imuPacket("bucket", { seq: 0, ms: 10 })), 1050)?.seq).toBe(0);
  expect(stream.accept(JSON.stringify(imuPacket("bucket", { seq: 0, ms: 0, boot: 999 })), 1100)?.boot).toBe(999);
});

it("requires three valid, fresh, distinct boards with bounded arrival skew", () => {
  const readings: Record<"boom" | "arm" | "bucket", ImuReading> = {
    boom: { ...imuPacket("boom", { angle: 60 }), receivedAt: 1000 },
    arm: { ...imuPacket("arm", { angle: -50 }), receivedAt: 1100 },
    bucket: { ...imuPacket("bucket", { angle: -90 }), receivedAt: 1200 },
  };
  expect(getArmAngles(readings, 1200)).toEqual({ boom: 60, arm: -50, bucket: -90 });
  expect(getArmAngles({ ...readings, arm: null }, 1200)).toBeNull();
  expect(getArmAngles(readings, 1000 + IMU_MAX_AGE_MS)).toBeNull();
  expect(getArmAngles({ ...readings, bucket: { ...readings.bucket, receivedAt: 1201 } }, 1201)).toBeNull();
  expect(getArmAngles({ ...readings, bucket: { ...readings.bucket, status: "unreliable", angle: null } }, 1200)).toBeNull();
  expect(getArmAngles({ ...readings, bucket: { ...readings.bucket, device: readings.boom.device } }, 1200)).toBeNull();
});
