import { expect, it, jest } from "@jest/globals";
import { ImuAssignments, IMU_ASSIGNMENTS_KEY, parseImuBindings } from "../../features/imu/imu-assignments";
import { IMU_TEST_UUIDS } from "../fixtures/imu";

const boom = { uuid: IMU_TEST_UUIDS.boom, address: "AA" };
const arm = { uuid: IMU_TEST_UUIDS.arm, address: "BB" };
function storage(value: string | null = null) {
  return { getItem: jest.fn(async (_key: string) => value), setItem: jest.fn<(_key: string, _value: string) => Promise<void>>().mockResolvedValue(undefined) };
}

it("restores and persists section assignments by UUID and permits any board in any role", async () => {
  const disk = storage(JSON.stringify({ bucket: boom }));
  const saved = new ImuAssignments(disk);
  expect(await saved.restore()).toEqual({ bucket: boom });
  expect(await saved.assign("boom", arm)).toEqual({ bucket: boom, boom: arm });
  expect(disk.setItem).toHaveBeenCalledWith(IMU_ASSIGNMENTS_KEY, JSON.stringify({ boom: arm, bucket: boom }));
  expect(await new ImuAssignments(storage(disk.setItem.mock.calls[0][1])).restore()).toEqual(saved.bindings);
});

it("prevents duplicate UUIDs even with different addresses, and allows reassignment after clearing", async () => {
  const saved = new ImuAssignments(storage());
  await saved.assign("boom", boom);
  await expect(saved.assign("arm", { ...boom, address: "CC" })).rejects.toThrow("assigned to boom");
  await expect(saved.assign("arm", { ...arm, address: "aa" })).rejects.toThrow("assigned to boom");
  await saved.assign("boom", null);
  expect(await saved.assign("arm", boom)).toEqual({ arm: boom });
});

it("serializes concurrent claims while storage is pending", async () => {
  const disk = storage();
  let complete!: () => void;
  disk.setItem.mockImplementationOnce(() => new Promise<void>((resolve) => { complete = resolve; }));
  const saved = new ImuAssignments(disk);
  const first = saved.assign("boom", boom);
  const second = saved.assign("arm", { ...boom, address: "CC" });
  const rejected = expect(second).rejects.toThrow("assigned to boom");
  await Promise.resolve();
  expect(disk.setItem).toHaveBeenCalledTimes(1);
  complete();
  await first; await rejected;
  expect(saved.bindings).toEqual({ boom });
});

it("keeps the previous mapping if saving fails and allows a retry", async () => {
  const disk = storage(JSON.stringify({ boom }));
  const saved = new ImuAssignments(disk);
  await saved.restore();
  disk.setItem.mockRejectedValueOnce(new Error("Unavailable"));
  await expect(saved.assign("boom", arm)).rejects.toThrow("Unavailable");
  expect(saved.bindings).toEqual({ boom });
  expect(await saved.assign("boom", arm)).toEqual({ boom: arm });
});

it("shares a single restore across repeated React effect activation", async () => {
  const disk = storage(JSON.stringify({ boom }));
  const saved = new ImuAssignments(disk);
  await Promise.all([saved.restore(), saved.restore()]);
  await saved.assign("arm", arm);
  expect(await saved.restore()).toEqual({ boom, arm });
  expect(saved.bindings).toEqual({ boom, arm });
  expect(disk.getItem).toHaveBeenCalledTimes(1);
});

it("rejects corrupt, duplicate or invalid persisted identities", () => {
  expect(parseImuBindings(null)).toEqual({});
  for (const value of ["{", "[]", "null", JSON.stringify({ boom, arm: boom }), JSON.stringify({ boom: { uuid: "invalid", address: "AA" } })]) {
    expect(() => parseImuBindings(value)).toThrow();
  }
});
