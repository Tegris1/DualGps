#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function readGlb(bytes) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67) {
    throw new Error("Invalid GLB header or truncated file.");
  }
  if (bytes.readUInt32LE(4) !== 2) {
    throw new Error("Only GLB version 2 is supported.");
  }
  if (bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error("GLB declared length does not match the file size.");
  }

  let document;
  let binaryLength;
  for (let offset = 12; offset < bytes.length; ) {
    if (offset + 8 > bytes.length) throw new Error("Truncated GLB chunk header.");
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const end = offset + 8 + length;
    if (length % 4 !== 0 || end > bytes.length) {
      throw new Error("Invalid GLB chunk length or alignment.");
    }
    if (offset === 12 && type !== JSON_CHUNK) {
      throw new Error("The first GLB chunk must contain JSON.");
    }
    if (type === JSON_CHUNK) {
      if (document !== undefined) throw new Error("Duplicate GLB JSON chunk.");
      document = JSON.parse(bytes.toString("utf8", offset + 8, end));
    } else if (type === BIN_CHUNK) {
      if (binaryLength !== undefined) throw new Error("Duplicate GLB binary chunk.");
      binaryLength = length;
    }
    offset = end;
  }
  if (document === undefined) throw new Error("GLB JSON chunk is missing.");
  return { document, binaryLength };
}

function inspectResource(uri, baseUrl) {
  if (typeof uri !== "string" || !uri) throw new Error("Invalid resource URI.");
  if (uri.startsWith("data:")) return { uri: "data: (embedded)", status: "embedded" };

  const url = new URL(uri, baseUrl);
  if (url.protocol !== "file:") return { uri, status: "remote" };

  try {
    const info = statSync(fileURLToPath(url));
    if (!info.isFile()) return { uri, status: "missing" };
    return { uri, status: "available", bytes: info.size };
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return { uri, status: "missing" };
    }
    throw error;
  }
}

function summarizeMeshes(document) {
  return (document.meshes ?? []).map((mesh, index) => {
    let triangles = 0;
    let otherPrimitives = 0;
    for (const primitive of mesh.primitives ?? []) {
      const mode = primitive.mode ?? 4;
      if (!Number.isInteger(mode) || mode < 0 || mode > 6) {
        throw new Error(`Mesh ${index} has an invalid primitive mode.`);
      }
      const position = document.accessors?.[primitive.attributes?.POSITION];
      const accessor = primitive.indices === undefined
        ? position
        : document.accessors?.[primitive.indices];
      if (!position || !Number.isInteger(accessor?.count) || accessor.count < 1) {
        throw new Error(`Mesh ${index} has missing or invalid geometry accessors.`);
      }
      if (mode === 4) {
        if (accessor.count % 3 !== 0) {
          throw new Error(`Mesh ${index} triangle count is not divisible by three.`);
        }
        triangles += accessor.count / 3;
      } else if (mode === 5 || mode === 6) {
        triangles += Math.max(0, accessor.count - 2);
      } else {
        otherPrimitives++;
      }
    }
    return { index, name: mesh.name ?? `Mesh ${index}`, triangles, otherPrimitives };
  });
}

/** Inspect packaging and mesh metadata without decoding or modifying the asset. */
export function inspectTerrain(filename) {
  const file = resolve(filename);
  const format = extname(file).toLowerCase();
  if (format !== ".gltf" && format !== ".glb") {
    throw new Error("Expected a .glb or .gltf file.");
  }
  const bytes = readFileSync(file);
  const { document, binaryLength } = format === ".glb"
    ? readGlb(bytes)
    : { document: JSON.parse(bytes.toString("utf8")) };
  if (document?.asset?.version !== "2.0") {
    throw new Error("Expected a glTF 2.0 asset.");
  }

  const errors = [];
  const warnings = [];
  const resources = [];
  const baseUrl = pathToFileURL(file);
  for (const [index, buffer] of (document.buffers ?? []).entries()) {
    if (!Number.isInteger(buffer.byteLength) || buffer.byteLength < 1) {
      throw new Error(`Buffer ${index} has an invalid byte length.`);
    }
    let resource;
    if (buffer.uri === undefined) {
      resource = { uri: `GLB buffer ${index}`, status: "embedded", bytes: binaryLength };
      if (index !== 0 || binaryLength === undefined
        || binaryLength < buffer.byteLength || binaryLength > buffer.byteLength + 3) {
        errors.push(`Buffer ${index} has no matching GLB binary data.`);
      }
    } else {
      resource = inspectResource(buffer.uri, baseUrl);
      if (resource.status === "available" && resource.bytes < buffer.byteLength) {
        errors.push(`Buffer ${index} is shorter than its declared byte length.`);
      }
    }
    resources.push(resource);
  }
  for (const image of document.images ?? []) {
    if (image.uri !== undefined) resources.push(inspectResource(image.uri, baseUrl));
  }
  for (const resource of resources) {
    if (resource.status === "missing") errors.push(`Missing resource: ${resource.uri}`);
    if (resource.status === "remote") {
      errors.push(`Resource must be bundled for offline use: ${resource.uri}`);
    }
  }

  const meshes = summarizeMeshes(document);
  const meshTriangles = meshes.reduce((sum, mesh) => sum + mesh.triangles, 0);
  if (meshTriangles === 0) errors.push("No triangle geometry found for a terrain surface.");
  if (meshes.some((mesh) => mesh.otherPrimitives > 0)) {
    warnings.push("Point/line primitives are excluded from triangle totals.");
  }
  const extensions = document.extensionsUsed ?? [];
  for (const extension of ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"]) {
    if (extensions.includes(extension)) {
      warnings.push(`${extension} requires decoder support in the renderer.`);
    }
  }

  return { file, format: format.slice(1), bytes: bytes.length, meshes, meshTriangles,
    resources, extensions, errors, warnings };
}

function main(filenames) {
  if (filenames.length === 0) {
    console.error("Usage: npm run inspect:terrain -- <current.glb> [target.gltf ...]");
    return 2;
  }
  let failed = false;
  for (const filename of filenames) {
    try {
      const report = inspectTerrain(filename);
      console.log(`\n${report.file}\n${report.format.toUpperCase()} | ${report.bytes} bytes | ${report.meshes.length} mesh definitions | ${report.meshTriangles} triangles`);
      for (const mesh of report.meshes) {
        console.log(`  Mesh ${mesh.index}: ${mesh.name} (${mesh.triangles} triangles)`);
      }
      for (const resource of report.resources) {
        console.log(`  Resource: ${resource.status} - ${resource.uri}`);
      }
      for (const warning of report.warnings) console.log(`  Warning: ${warning}`);
      for (const error of report.errors) console.error(`  Error: ${error}`);
      console.log(report.errors.length ? "Packaging check: FAILED" : "Packaging check: PASSED");
      if (report.errors.length) failed = true;
    } catch (error) {
      console.error(`\n${filename}\n  Error: ${error.message}`);
      failed = true;
    }
  }
  console.log("\nMetadata inspection only: alignment, units, surface identity, geometry validity, and Android rendering still require verification.");
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
