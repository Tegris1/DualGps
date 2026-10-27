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
  heightDifferenceMeters: number | null;
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

function elevationAt(profile: readonly CrossSectionPoint[], distance: number) {
  for (let index = 1; index < profile.length; index++) {
    const start = profile[index - 1], end = profile[index];
    if (distance >= start.distance && distance <= end.distance) {
      const fraction = (distance - start.distance) / (end.distance - start.distance);
      return start.elevation + fraction * (end.elevation - start.elevation);
    }
  }
  return null;
}

export function createCrossSectionModel(data: CrossSectionData): CrossSectionModel | null {
  if (!validPoint(data.bucket) || !validProfile(data.current) || !validProfile(data.target)) return null;

  const points = [...data.current, ...data.target, data.bucket];
  const minimumDistance = Math.min(...points.map((point) => point.distance));
  const maximumDistance = Math.max(...points.map((point) => point.distance));
  const minimumElevation = Math.floor(Math.min(...points.map((point) => point.elevation))) - 1;
  const maximumElevation = Math.ceil(Math.max(...points.map((point) => point.elevation))) + 1;
  const project = (point: CrossSectionPoint): PlotPoint => ({
    x: (point.distance - minimumDistance) / (maximumDistance - minimumDistance),
    y: (maximumElevation - point.elevation) / (maximumElevation - minimumElevation),
  });
  const segments = (profile: readonly CrossSectionPoint[]): PlotSegment[] => profile.slice(1).map((point, index) => ({
    start: project(profile[index]), end: project(point),
  }));
  const targetElevation = elevationAt(data.target, data.bucket.distance);
  const tickLabel = (value: number) => value.toFixed(1).replace(".", ",");
  const distances = [minimumDistance, data.bucket.distance, maximumDistance]
    .filter((value, index, values) => values.indexOf(value) === index);

  return {
    current: segments(data.current),
    target: segments(data.target),
    bucket: project(data.bucket),
    targetAtBucket: targetElevation === null ? null : project({ distance: data.bucket.distance, elevation: targetElevation }),
    heightDifferenceMeters: targetElevation === null ? null : data.bucket.elevation - targetElevation,
    distanceTicks: distances.map((distance) => ({
      position: project({ distance, elevation: minimumElevation }).x,
      label: tickLabel(distance - data.bucket.distance),
    })),
    elevationTicks: Array.from({ length: 5 }, (_, index) => {
      const elevation = minimumElevation + index * (maximumElevation - minimumElevation) / 4;
      return { position: project({ distance: minimumDistance, elevation }).y, label: tickLabel(elevation) };
    }),
  };
}
