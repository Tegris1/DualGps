import { useEffect, useState } from "react";

import { INITIAL_NTRIP_STATUS, NtripSession } from "@/features/gps/services/ntrip-session";
import type { EuposSettings } from "@/features/gps/types";

export function useNtripSession(settings: EuposSettings) {
  const [status, setStatus] = useState(INITIAL_NTRIP_STATUS);
  const [session] = useState(() => new NtripSession(settings, setStatus));

  useEffect(() => {
    session.setSettings(settings);
  }, [session, settings]);

  useEffect(() => {
    session.activate();
    return () => session.dispose();
  }, [session]);

  return { session, status };
}
