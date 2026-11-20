import type { ImuPacket, ImuSection } from "../../lib/imu/imu-protocol";

export const IMU_TEST_UUIDS = {
  boom: "3ea34a50-4d30-5c51-8fe3-b1249a7a3101",
  arm: "3ea34a50-4d30-5c51-8fe3-b1249a7a3102",
  bucket: "3ea34a50-4d30-5c51-8fe3-b1249a7a3103",
};
export function imuPacket(id: ImuSection, overrides: Partial<ImuPacket> = {}): ImuPacket {
  return {
    type: "dualgps.imu", v: 2, uuid: IMU_TEST_UUIDS[id], boot: 123456, seq: 42, ms: 2100,
    accel: [0.866, 0, 0.5], gyro: [0, 0, 0], angle: 60, calibrated: true, status: "ok",
    ...overrides,
  };
}
