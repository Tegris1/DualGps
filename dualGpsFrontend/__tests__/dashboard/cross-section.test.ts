import { expect, it } from "@jest/globals";

import { createSegmentCrossSectionModel } from "../../features/dashboard/cross-section";
import { getTerrainCrossSectionPresentation } from "../../features/dashboard/presentation/terrain-cross-section";
import type { BucketCrossSections, SectionSegment } from "../../features/terrain/terrain-cross-section";

const segment = (from: number, to: number, height: number): SectionSegment => [
  { distance: from, elevation: height }, { distance: to, elevation: height },
];
const data: BucketCrossSections = {
  current: [segment(-3, 3, 2)], target: [segment(-3, 0, 1), segment(0, 3, 1)],
  bucket: { distance: 0, elevation: 2 },
};

it("projects independent model segments and deduplicates a shared edge beneath the bucket", () => {
  const model = createSegmentCrossSectionModel(data)!;
  expect(model.comparison).toBe("available");
  expect(model.heightDifference).toBe(1);
  expect(model.bucket.y).toBeLessThan(model.targetAtBucket!.y);
  expect(model.target).toHaveLength(2);
  for (const line of [...model.current, ...model.target]) {
    for (const point of [line.start, line.end]) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    }
  }
});

it("preserves gaps and withholds comparisons for missing or overlapping design surfaces", () => {
  const gap = createSegmentCrossSectionModel({ ...data, target: [segment(-3, -1, 1), segment(1, 3, 1)] })!;
  expect(gap.target).toHaveLength(2);
  expect(gap.target[0].end.x).toBeLessThan(gap.target[1].start.x);
  expect(gap.comparison).toBe("missing");
  expect(gap.heightDifference).toBeNull();
  const overlap = createSegmentCrossSectionModel({ ...data, target: [segment(-3, 3, 1), segment(-3, 3, 0)] })!;
  expect(overlap.comparison).toBe("ambiguous");
  expect(overlap.targetAtBucket).toBeNull();
  expect(overlap.heightDifference).toBeNull();
});

it("keeps flat or vertical extents finite and rejects empty and invalid geometry", () => {
  const flat = createSegmentCrossSectionModel({ ...data, target: data.current })!;
  expect(flat.heightDifference).toBe(0);
  const vertical = createSegmentCrossSectionModel({ ...data, current: [segment(0, 0, 2)], target: [] })!;
  expect(vertical.elevationTicks.every((tick) => Number.isFinite(tick.position))).toBe(true);
  expect(vertical.distanceTicks.every((tick) => Number.isFinite(tick.position))).toBe(true);
  expect(createSegmentCrossSectionModel({ ...data, current: [], target: [] })).toBeNull();
  expect(createSegmentCrossSectionModel({ ...data, bucket: { distance: 0, elevation: NaN } })).toBeNull();
});

it("displays metres and never substitutes preset readings for missing model data", () => {
  const ready = getTerrainCrossSectionPresentation(data, "ready");
  expect(ready.comparisonLabel).toBe("+1,000 m");
  expect(ready.elevationLabel).toContain("względem łyżki");
  for (const state of ["unselected", "loading", "error"] as const) {
    const result = getTerrainCrossSectionPresentation(data, state);
    expect(result.model).toBeNull();
    expect(result.comparisonLabel).toBe("—");
  }
});
