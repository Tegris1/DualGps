import { getApiBaseUrl } from "@/features/auth/api/auth-api";
import type { DocumentPickerAsset } from "expo-document-picker";

const FILES_PATH = "/api/terrain-files";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export type TerrainFile = {
  id: string;
  originalFilename: string;
  size: number;
};

function isTerrainFile(value: unknown): value is TerrainFile {
  if (!value || typeof value !== "object") return false;
  const file = value as Partial<TerrainFile>;
  return typeof file.id === "string" && typeof file.originalFilename === "string" && typeof file.size === "number";
}

async function request(
  token: string,
  path: string,
  options: RequestInit,
): Promise<unknown> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = setTimeout(cancel, options.body ? 60_000 : 15_000);

  try {
    const response = await fetch(getApiBaseUrl() + path, {
      ...options,
      headers: { Accept: "application/json", Authorization: "Bearer " + token },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("Your session may have expired. Sign out and sign in again.");
    }
    if (response.status === 413) throw new Error("The file exceeds 10 MiB.");
    if (response.status === 404) throw new Error("This file is no longer available. Refresh the list.");
    if (response.status === 400) {
      const detail = await response.json().catch(() => null) as { message?: unknown } | null;
      throw new Error(typeof detail?.message === "string" ? detail.message : "Choose a valid .glb file.");
    }
    if (!response.ok) throw new Error("The server could not complete the request. Try again.");
    return response.status === 204 ? null : await response.json();
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}

export async function listTerrainFiles(token: string, signal?: AbortSignal): Promise<TerrainFile[]> {
  const result = await request(token, FILES_PATH, { method: "GET", signal });
  if (Array.isArray(result) && result.every(isTerrainFile)) return result;
  throw new Error("The server returned an invalid file list.");
}

export async function saveTerrainFile(token: string, document: DocumentPickerAsset, id?: string): Promise<TerrainFile> {
  if (!document.name.toLowerCase().endsWith(".glb")) throw new Error("Choose a .glb terrain file.");
  if (document.size === 0 || (document.size ?? 0) > MAX_FILE_SIZE) {
    throw new Error("The file must be nonempty and at most 10 MiB.");
  }

  const body = new FormData();
  const nativeFile = { uri: document.uri, name: document.name, type: "model/gltf-binary" };
  // React Native FormData accepts a URI part. The browser picker supplies a File.
  body.append("file", document.file ?? (nativeFile as unknown as Blob));
  const path = id ? FILES_PATH + "/" + encodeURIComponent(id) : FILES_PATH;
  const result = await request(token, path, { method: id ? "PUT" : "POST", body });
  if (isTerrainFile(result)) return result;
  throw new Error("The server returned invalid file details. Refresh the list.");
}

export async function deleteTerrainFile(token: string, id: string) {
  await request(token, FILES_PATH + "/" + encodeURIComponent(id), { method: "DELETE" });
}
