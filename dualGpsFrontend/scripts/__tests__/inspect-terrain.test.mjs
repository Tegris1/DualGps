import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { inspectTerrain } from "../inspect-terrain.mjs";

const directory = mkdtempSync(join(tmpdir(), "dualgps-terrain-"));
const script = join(dirname(fileURLToPath(import.meta.url)), "../inspect-terrain.mjs");
after(() => {
  // Only individual files created in this test's temporary directory are removed.
  for (const name of readdirSync(directory)) rmSync(join(directory, name));
  rmdirSync(directory);
});

function model(uri) {
  return {
    asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ name: "Terrain", primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3",
      min: [0, 0, 0], max: [1, 0, 1] }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36, ...(uri === undefined ? {} : { uri }) }],
  };
}

function save(name, content) {
  const path = join(directory, name);
  writeFileSync(path, content);
  return path;
}

function glb(document = model(), binaryLength = 36) {
  const json = Buffer.from(JSON.stringify(document));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(padded);
  const bytes = Buffer.alloc(12 + 8 + padded.length + 8 + binaryLength);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(padded.length, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(bytes, 20);
  bytes.writeUInt32LE(binaryLength, 20 + padded.length);
  bytes.writeUInt32LE(0x004e4942, 24 + padded.length);
  if (binaryLength >= 36) {
    // Actual triangle positions: (0,0,0), (1,0,0), (0,0,1).
    bytes.writeFloatLE(1, 28 + padded.length + 12);
    bytes.writeFloatLE(1, 28 + padded.length + 32);
  }
  return bytes;
}

test("inspects an embedded GLB without changing its contents", () => {
  const bytes = glb();
  const path = save("embedded.glb", bytes);
  const report = inspectTerrain(path);
  assert.equal(report.meshTriangles, 1);
  assert.deepEqual(report.meshes, [{ index: 0, name: "Terrain", triangles: 1, otherPrimitives: 0 }]);
  assert.deepEqual(report.errors, []);
  assert.equal(report.resources[0].status, "embedded");
  assert.equal(report.bytes, bytes.length);
  assert.deepEqual(readFileSync(path), bytes);
});

test("resolves percent-encoded buffers and textures relative to a glTF file", () => {
  save("terrain data.bin", Buffer.alloc(36));
  save("color.png", Buffer.from("texture placeholder"));
  const document = { ...model("terrain%20data.bin"), images: [{ uri: "color.png" }] };
  const report = inspectTerrain(save("external.gltf", JSON.stringify(document)));
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.resources.map((resource) => resource.status), ["available", "available"]);
});

test("reports missing files, short buffers, and remote dependencies for offline use", () => {
  save("short.bin", Buffer.alloc(4));
  for (const [uri, expected] of [["absent.bin", /Missing resource/],
    ["short.bin", /shorter/], ["https://example.com/data.bin", /offline use/]]) {
    const report = inspectTerrain(save("unavailable.gltf", JSON.stringify(model(uri))));
    assert.match(report.errors.join("\n"), expected);
  }
});

test("recognizes embedded data URIs and reports decoder requirements", () => {
  const document = model(`data:application/octet-stream;base64,${Buffer.alloc(36).toString("base64")}`);
  document.extensionsUsed = ["KHR_draco_mesh_compression"];
  const report = inspectTerrain(save("data.gltf", JSON.stringify(document)));
  assert.deepEqual(report.errors, []);
  assert.equal(report.resources[0].status, "embedded");
  assert.match(report.warnings[0], /decoder support/);
});

test("counts indexed triangles, strips, and fans without counting lines", () => {
  const document = model();
  document.accessors.push({ componentType: 5123, count: 6, type: "SCALAR" });
  document.meshes[0].primitives = [4, 5, 6, 1].map((mode) => ({ mode, indices: 1, attributes: { POSITION: 0 } }));
  const report = inspectTerrain(save("modes.glb", glb(document)));
  assert.equal(report.meshTriangles, 10);
  assert.equal(report.meshes[0].otherPrimitives, 1);
});

test("rejects malformed GLB headers, chunk boundaries, and missing binary data", () => {
  for (const corrupt of [
    (bytes) => bytes.writeUInt32LE(0, 0),
    (bytes) => bytes.writeUInt32LE(1, 4),
    (bytes) => bytes.writeUInt32LE(bytes.length + 4, 8),
    (bytes) => bytes.writeUInt32LE(bytes.length, 12),
    (bytes) => bytes.writeUInt32LE(0, 16),
  ]) {
    const bytes = glb();
    corrupt(bytes);
    assert.throws(() => inspectTerrain(save("broken.glb", bytes)), /GLB/);
  }
  const report = inspectTerrain(save("short-embedded.glb", glb(model(), 32)));
  assert.match(report.errors.join("\n"), /binary data/);
});

test("rejects unsupported versions and invalid geometry metadata", () => {
  for (const document of [
    { ...model(), asset: { version: "1.0" } },
    { ...model(), accessors: [] },
    { ...model(), accessors: [{ count: 4 }] },
  ]) assert.throws(() => inspectTerrain(save("invalid.glb", glb(document))));
  const report = inspectTerrain(save("empty.gltf", '{"asset":{"version":"2.0"}}'));
  assert.match(report.errors[0], /No triangle/);
});

test("CLI reports all input files and returns failure if any cannot be inspected", () => {
  const valid = save("cli.glb", glb());
  const invalid = save("cli-invalid.glb", Buffer.from("not a GLB"));
  const result = spawnSync(process.execPath, [script, invalid, valid], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid GLB/);
  assert.match(result.stdout, /Packaging check: PASSED/);
  assert.equal(spawnSync(process.execPath, [script, valid]).status, 0);
  assert.equal(spawnSync(process.execPath, [script]).status, 2);
});
