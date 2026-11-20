import { useCallback, useEffect, useRef, useState } from "react";

import { useBluetoothReceiver } from "@/features/gps/hooks/use-bluetooth-receiver";
import type { ReceiverAssignments } from "@/features/gps/services/receiver-assignments";
import { getArmAngles, ImuStream, IMU_MAX_AGE_MS, type ImuReading, type ImuSection } from "@/lib/imu/imu-protocol";

const noConfiguration = async () => {};
const onReady = () => {};

function useImuSensor(section: ImuSection, assignments: ReceiverAssignments) {
  const stream = useRef(new ImuStream(section));
  const [reading, setReading] = useState<ImuReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reset = useCallback(() => {
    stream.current = new ImuStream(section);
    setReading(null);
    setError(null);
  }, [section]);
  const onData = useCallback((data: string) => {
    for (const line of data.split(/\r?\n/).filter((value) => value.trim())) {
      const next = stream.current.accept(line, Date.now());
      setError(stream.current.error);
      if (next) setReading(next);
      else if (stream.current.error) setReading(null);
    }
  }, []);
  const receiver = useBluetoothReceiver({
    onAttached: reset, onReady, onData, onReleased: reset, assignments, configureDevice: noConfiguration,
  });
  return { ...receiver, section, reading, error };
}

export function useArmImus(assignments: ReceiverAssignments) {
  const boom = useImuSensor("boom", assignments);
  const arm = useImuSensor("arm", assignments);
  const bucket = useImuSensor("bucket", assignments);
  const [clock, setClock] = useState(Date.now);
  const anyConnected = !!(boom.connectedDevice || arm.connectedDevice || bucket.connectedDevice);
  useEffect(() => {
    if (!anyConnected) return;
    const timer = setInterval(() => setClock(Date.now()), 100);
    return () => clearInterval(timer);
  }, [anyConnected]);
  const now = Math.max(clock, Date.now());
  const sensors = [boom, arm, bucket].map((sensor) => ({
    ...sensor,
    fresh: !!sensor.connectedDevice && !!sensor.reading && now - sensor.reading.receivedAt < IMU_MAX_AGE_MS,
  }));
  const readings = Object.fromEntries(sensors.map((sensor) => [sensor.section, sensor.fresh ? sensor.reading : null])) as Record<ImuSection, ImuReading | null>;
  return { sensors, pose: getArmAngles(readings, now) };
}

export type ArmImuController = ReturnType<typeof useArmImus>;
