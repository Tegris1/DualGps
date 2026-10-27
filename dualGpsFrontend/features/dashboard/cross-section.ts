import type { BucketCrossSections, SectionPoint, SectionSegment } from "@/features/terrain/terrain-cross-section";

export type CrossSectionPoint = { distance: number; elevation: number };

export type CrossSectionData = {
  current: readonly CrossSectionPoint[];
  target: readonly CrossSectionPoint[];
  bucket: CrossSectionPoint;
};

// Coordinates are normalized to the plot area, independently of screen size.
export type PlotPoint = { x: number; y: number };
export type PlotSegment = { start: PlotPoint; end: PlotPoint };
export type PlotTick = { position: number; label: string };

export type CrossSectionModel = {
  current: PlotSegment[];
  target: PlotSegment[];
  bucket: PlotPoint;
  targetAtBucket: PlotPoint | null;
  heightDifference: number | null;
  comparison: "available" | "missing" | "ambiguous";
  distanceTicks: PlotTick[];
  elevationTicks: PlotTick[];
};

function validPoint(point: CrossSectionPoint) {
  return Number.isFinite(point.distance) && Number.isFinite(point.elevation);
}

function validProfile(profile: readonly CrossSectionPoint[]) {
  return profile.length >= 2 && profile.every((point, index) =>
    validPoint(point) && (index === 0 || point.distance > profile[index - 1].distance),
  );
}

export function createCrossSectionModel(data: CrossSectionData): CrossSectionModel | null {
  if (!validPoint(data.bucket) || !validProfile(data.current) || !validProfile(data.target)) return null;

  const segments = (profile: readonly CrossSectionPoint[]): SectionSegment[] => profile.slice(1).map((point, index) => [profile[index], point]);
  return createSegmentCrossSectionModel({ current: segments(data.current), target: segments(data.target), bucket: data.bucket });
}

// Sample independent segments without bridging holes or selecting an arbitrary
// elevation when several design surfaces intersect beneath the bucket.
function elevationsAt(segments: readonly SectionSegment[], distance: number) {
  const values: number[] = [];
  const add = (elevation: number) => {
    if (!values.some((value) => Math.abs(value - elevation) <= 1e-6)) values.push(elevation);
  };
  for (const [start, end] of segments) {
    if (distance < Math.min(start.distance, end.distance) || distance > Math.max(start.distance, end.distance)) continue;
    if (start.distance === end.distance) {
      add(start.elevation);
      add(end.elevation);
    } else {
      const fraction = (distance - start.distance) / (end.distance - start.distance);
      add(start.elevation + fraction * (end.elevation - start.elevation));
    }
  }
  return values;
}

export function createSegmentCrossSectionModel(data: BucketCrossSections): CrossSectionModel | null {
  const points = [data.bucket, ...data.current.flat(), ...data.target.flat()];
  if ((!data.current.length && !data.target.length) || !points.every(validPoint)) return null;

  let minimumDistance = Infinity, maximumDistance = -Infinity, minimumElevation = Infinity, maximumElevation = -Infinity;
  for (const point of points) {
    minimumDistance = Math.min(minimumDistance, point.distance);
    maximumDistance = Math.max(maximumDistance, point.distance);
    minimumElevation = Math.min(minimumElevation, point.elevation);
    maximumElevation = Math.max(maximumElevation, point.elevation);
  }
  if (maximumDistance - minimumDistance < 1e-6) { minimumDistance -= 0.5; maximumDistance += 0.5; }
  const padding = Math.max((maximumElevation - minimumElevation) * 0.1, 0.001);
  minimumElevation -= padding;
  maximumElevation += padding;
  const project = (point: SectionPoint): PlotPoint => ({
    x: (point.distance - minimumDistance) / (maximumDistance - minimumDistance),
    y: (maximumElevation - point.elevation) / (maximumElevation - minimumElevation),
  });
  const segments = (profile: readonly SectionSegment[]): PlotSegment[] => profile.map(([start, end]) => ({ start: project(start), end: project(end) }));
  const elevations = elevationsAt(data.target, data.bucket.distance);
  const targetElevation = elevations.length === 1 ? elevations[0] : null;
  const tickLabel = (value: number, span: number) => {
    const digits = Math.max(1, Math.min(6, Math.ceil(-Math.log10(span / 4)) + 1));
    return (Math.abs(value) < 10 ** -digits / 2 ? 0 : value).toFixed(digits).replace(".", ",");
  };
  const distances = [minimumDistance, data.bucket.distance, maximumDistance]
    .filter((value, index, values) => values.indexOf(value) === index);

  return {
    current: segments(data.current),
    target: segments(data.target),
    bucket: project(data.bucket),
    targetAtBucket: targetElevation === null ? null : project({ distance: data.bucket.distance, elevation: targetElevation }),
    heightDifference: targetElevation === null ? null : data.bucket.elevation - targetElevation,
    comparison: elevations.length === 1 ? "available" : elevations.length ? "ambiguous" : "missing",
    distanceTicks: distances.map((distance) => ({
      position: project({ distance, elevation: minimumElevation }).x,
      label: tickLabel(distance - data.bucket.distance, maximumDistance - minimumDistance),
    })),
    elevationTicks: Array.from({ length: 5 }, (_, index) => {
      const elevation = minimumElevation + index * (maximumElevation - minimumElevation) / 4;
      return { position: project({ distance: minimumDistance, elevation }).y, label: tickLabel(elevation - data.bucket.elevation, maximumElevation - minimumElevation) };
    }),
  };
}
