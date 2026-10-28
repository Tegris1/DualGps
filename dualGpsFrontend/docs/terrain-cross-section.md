# Terrain model cross-section

The dashboard slices the selected terrain models in the same world coordinates used by the 3D preview. The cutting plane passes through the procedural excavator's bucket edge and follows its digging direction.

The scene computes the intersections once per loaded model pair and sends ordinary segment arrays to the dashboard. Camera rotation, zoom, orientation, and surface visibility preserve the existing section. Changing models or retrying a failed load invalidates the previous result; callbacks from a previous scene cannot replace the current section.

The chart retains separate triangle segments, including gaps and overlapping surface layers. It compares the bucket elevation with the design only if there is one distinct design elevation at the bucket distance. Shared-edge duplicates count as one elevation. A missing surface, a gap, or several design elevations produces an unavailable comparison.

## Units and data sources

- Distances and elevations use metres (`m`), following the [glTF coordinate and unit convention](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units). Assets must use one scene unit per metre; exported transforms remain applied.
- Both axes are relative to the bucket: signed horizontal distance and relative elevation.
- The bucket belongs to the procedural excavator. GNSS and IMU readings do not position it.
- The upper height-difference card uses a fixed value in metres. Its value is not the model chart's comparison.
- The section includes both surfaces even when a surface is hidden in the 3D preview.

Surveyed alignment, machine dimensions, and the measured bucket pose must be established before this preview can provide physical guidance.
