export type GgaFix = {
  sentence: string;
  receivedAt: number;
  utcTime?: string;
  quality: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  satellites?: number;
  hdop?: number;
  vdop?: number;
  pdop?: number;
};

function numberOrUndefined(value: string): number | undefined {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function parseCoordinate(
  value: string,
  hemisphere: string,
  latitude: boolean,
): number | undefined {
  const pattern = latitude
    ? /^(\d{2})(\d{2}(?:\.\d+)?)$/
    : /^(\d{3})(\d{2}(?:\.\d+)?)$/;
  const match = pattern.exec(value);
  if (!match || !(latitude ? /^[NS]$/ : /^[EW]$/).test(hemisphere)) {
    return undefined;
  }

  const degrees = Number(match[1]);
  const minutes = Number(match[2]);
  const maxDegrees = latitude ? 90 : 180;
  if (
    minutes >= 60 ||
    degrees > maxDegrees ||
    (degrees === maxDegrees && minutes !== 0)
  ) {
    return undefined;
  }

  const coordinate = degrees + minutes / 60;
  return hemisphere === "S" || hemisphere === "W" ? -coordinate : coordinate;
}

export function parseGgaSentence(
  sentence: string,
  receivedAt = Date.now(),
): GgaFix | null {
  const trimmed = sentence.trim();
  if (
    trimmed.length > 1024 ||
    trimmed.length < 9 ||
    !/^\$[A-Z0-9]{2}GGA,/.test(trimmed)
  ) {
    return null;
  }

  const star = trimmed.lastIndexOf("*");
  if (star < 0 || !/^[0-9A-Fa-f]{2}$/.test(trimmed.slice(star + 1))) {
    return null;
  }

  let checksum = 0;
  for (let index = 1; index < star; index += 1) {
    const code = trimmed.charCodeAt(index);
    if (code < 32 || code > 126) return null;
    checksum ^= code;
  }
  if (checksum !== parseInt(trimmed.slice(star + 1), 16)) return null;

  const fields = trimmed.slice(1, star).split(",");
  const quality = Number(fields[6]);
  if (
    fields.length < 10 ||
    !/^[0-8]$/.test(fields[6]) ||
    !Number.isInteger(quality)
  ) {
    return null;
  }

  const satellites = numberOrUndefined(fields[7]);
  const hdop = numberOrUndefined(fields[8]);
  const vdop = numberOrUndefined(fields[16]);
  const pdop = numberOrUndefined(fields[15]);
  const fix: GgaFix = {
    sentence: trimmed,
    receivedAt,
    utcTime: fields[1] || undefined,
    quality: quality as GgaFix["quality"],
    satellites:
      satellites !== undefined &&
      Number.isInteger(satellites) &&
      satellites >= 0
        ? satellites
        : undefined,
    hdop: hdop !== undefined && hdop >= 0 ? hdop : undefined,
    vdop: vdop !== undefined && vdop >= 0 ? vdop : undefined,
    pdop: pdop !== undefined && pdop >= 0 ? pdop : undefined,
  };

  if (quality === 0) return fix;

  const latitude = parseCoordinate(fields[2], fields[3], true);
  const longitude = parseCoordinate(fields[4], fields[5], false);
  if (latitude === undefined || longitude === undefined) return null;

  const altitude = numberOrUndefined(fields[9]);
  return {
    ...fix,
    latitude,
    longitude,
    altitude: fields[10] === "M" ? altitude : undefined,
  };
}

export function fixLabel(quality: GgaFix["quality"]): string {
  switch (quality) {
    case 4:
      return "RTK FIXED";
    case 5:
      return "RTK FLOAT";
    case 2:
      return "DGPS";
    case 1:
      return "AUTONOMOUS";
    case 6:
      return "ESTIMATED";
    case 7:
      return "MANUAL";
    case 8:
      return "SIMULATION";
    default:
      return "NO FIX";
  }
}
