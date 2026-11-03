import type { NtripConnectionStatus, NtripState } from "@/lib/gps/ntrip-connection";

import type { DiagnosticRow, StatusBanner } from "./types";

const fallbackMessages: Record<NtripState, string> = {
  idle: "Waiting for a valid GGA position from the receiver.",
  connecting: "Connecting to the NTRIP caster.",
  streaming: "NTRIP corrections active",
  error: "NTRIP connection failed.",
  disconnected: "NTRIP is disconnected.",
};

export function getNtripPresentation(status: NtripConnectionStatus) {
  const message = status.message ?? fallbackMessages[status.state];
  const banner: StatusBanner = {
    variant: status.state === "streaming" ? "success" : status.state === "error" ? "error" : "info",
    message: status.state === "streaming"
      ? `${message} ${status.rtcm.validFrames} valid RTCM frames, ${status.bytesSentToReceiver} bytes forwarded.`
      : message,
  };
  const details: readonly DiagnosticRow[] = [
    { label: "State", value: status.state },
    { label: "Message", value: banner.message },
    { label: "Correction bytes received", value: status.bytesReceived },
    { label: "Bytes written to receiver", value: status.bytesSentToReceiver },
    { label: "Valid RTCM frames", value: status.rtcm.validFrames },
    { label: "Invalid RTCM frames", value: status.rtcm.invalidFrames },
    { label: "Last RTCM message", value: status.rtcm.lastMessageType ?? "—" },
    { label: "Last GGA written", value: status.lastGgaSentAt === undefined
      ? "Not sent yet" : new Date(status.lastGgaSentAt).toLocaleTimeString() },
  ];

  return { banner, details };
}
