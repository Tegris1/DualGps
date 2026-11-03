import { useCallback, useRef, useState } from "react";

import { parseGgaSentence, parseGsaSentence, type GgaFix, type GsaDop } from "@/lib/gps/nmea";
import type { ConsoleEntry } from "@/features/gps/types";

const CONSOLE_ENTRY_LIMIT = 200;

export function useReceiverDiagnostics() {
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [latestLine, setLatestLine] = useState("");
  const [latestFix, setLatestFix] = useState<GgaFix | null>(null);
  const [gsaDop, setGsaDop] = useState<GsaDop | null>(null);
  const consoleIdRef = useRef(0);

  const acceptData = useCallback((rawData: string): string[] => {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const sentences = rawData.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const entries = sentences.map((message) => ({ id: consoleIdRef.current++, message, time }));
    if (entries.length) {
      setConsoleEntries((current) => [...current, ...entries].slice(-CONSOLE_ENTRY_LIMIT));
    }

    const usableGga: string[] = [];
    for (const sentence of sentences) {
      setLatestLine(sentence);
      const dop = parseGsaSentence(sentence);
      if (dop) setGsaDop(dop);
      const fix = parseGgaSentence(sentence);
      if (fix) setLatestFix(fix);
      if (fix && fix.quality !== 0 && fix.latitude !== undefined && fix.longitude !== undefined) {
        usableGga.push(fix.sentence);
      }
    }
    return usableGga;
  }, []);

  const resetReadings = useCallback(() => {
    setLatestLine("");
    setLatestFix(null);
    setGsaDop(null);
  }, []);
  const clearConsole = useCallback(() => setConsoleEntries([]), []);

  return { consoleEntries, latestLine, latestFix, gsaDop, acceptData, resetReadings, clearConsole };
}
