import { useAuth } from "@/features/auth/auth-context";
import { deleteTerrainFile, listTerrainFiles, saveTerrainFile, type TerrainFile } from "@/features/terrain/terrain-files-api";
import { terrainColors, terrainTypography } from "@/features/terrain/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function Action({
  label, onPress, disabled, primary = false, destructive = false, accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action, primary && styles.primaryAction, destructive && styles.deleteAction,
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <Text style={[styles.actionText, primary && styles.primaryText, destructive && styles.deleteText]}>{label}</Text>
    </Pressable>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "The request timed out. Refresh the file list and try again.";
    if (!(error instanceof TypeError)) return error.message;
  }
  return "Could not reach the file server. Check your connection and try again.";
}

function fileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KiB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MiB";
}

function TerrainFilesScreen({ token, signOut }: { token: string; signOut: () => Promise<void> }) {
  const [files, setFiles] = useState<TerrainFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TerrainFile | null>(null);
  const running = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void listTerrainFiles(token, controller.signal).then(
      (result) => { if (!controller.signal.aborted) setFiles(result); },
      (failure: unknown) => { if (!controller.signal.aborted) setError(getErrorMessage(failure)); },
    ).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);

  async function run(message: string, operation: () => Promise<void>) {
    if (running.current || loading) return;
    running.current = true;
    setBusy(message);
    setError(null);
    setNotice(null);
    try {
      await operation();
    } catch (failure) {
      setError(getErrorMessage(failure));
    } finally {
      running.current = false;
      setBusy(null);
    }
  }

  function chooseFile(existing?: TerrainFile) {
    void run(existing ? "Replacing file…" : "Adding file…", async () => {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, base64: false });
      if (result.canceled) return;
      const saved = await saveTerrainFile(token, result.assets[0], existing?.id);
      setFiles((previous) => existing
        ? previous.map((file) => file.id === existing.id ? saved : file)
        : [saved, ...previous]);
      setNotice(existing ? "File replaced." : "File added.");
    });
  }

  function confirmDelete(file: TerrainFile) {
    setDeleting(null);
    void run("Deleting file…", async () => {
      await deleteTerrainFile(token, file.id);
      setFiles((previous) => previous.filter((item) => item.id !== file.id));
      setNotice("File deleted.");
    });
  }

  const working = loading || busy !== null;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={terrainTypography.title}>Terrain files</Text>
              <Text style={terrainTypography.caption}>Upload .glb models up to 10 MiB per file.</Text>
            </View>
            <Action label="Sign out" onPress={() => void signOut()} />
          </View>

          <View style={styles.toolbar}>
            <Action label="Add terrain" primary onPress={() => chooseFile()} disabled={working || !!deleting} />
            <Action label="Refresh" disabled={working || !!deleting}
              onPress={() => void run("Refreshing files…", async () => setFiles(await listTerrainFiles(token)))} />
          </View>

          {working && (
            <View style={styles.status} accessibilityLiveRegion="polite">
              <ActivityIndicator color={terrainColors.primary} />
              <Text style={terrainTypography.caption}>{loading ? "Loading files…" : busy}</Text>
            </View>
          )}
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}

          {!working && !error && files.length === 0 && (
            <View style={styles.empty}>
              <MaterialIcons name="terrain" size={32} color={terrainColors.primary} />
              <Text style={styles.fileName}>No terrain files yet</Text>
            </View>
          )}
          {files.map((file) => (
            <View key={file.id} style={styles.card}>
              <View style={styles.fileInfo}>
                <View style={styles.icon}>
                  <MaterialIcons name="description" size={24} color={terrainColors.primary} />
                </View>
                <View style={styles.fileDetails}>
                  <Text numberOfLines={2} style={styles.fileName}>{file.originalFilename}</Text>
                  <Text style={terrainTypography.caption}>{fileSize(file.size)}</Text>
                </View>
              </View>
              {deleting?.id === file.id ? (
                <View style={styles.confirm}>
                  <Text style={styles.actionText}>Delete {file.originalFilename}?</Text>
                  <View style={styles.fileActions}>
                    <Action label="Cancel" onPress={() => setDeleting(null)} />
                    <Action label="Delete file" destructive onPress={() => confirmDelete(file)} />
                  </View>
                </View>
              ) : (
                <View style={styles.fileActions}>
                  <Action label="Replace" accessibilityLabel={"Replace " + file.originalFilename}
                    disabled={working || !!deleting} onPress={() => chooseFile(file)} />
                  <Action label="Delete" accessibilityLabel={"Delete " + file.originalFilename}
                    disabled={working || !!deleting} onPress={() => setDeleting(file)} />
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function TerrainFilesRoute() {
  const { user, token, signOut } = useAuth();
  if (user?.role !== "ARCHITECT" || !token) return null;
  return <TerrainFilesScreen key={token} token={token} signOut={signOut} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: terrainColors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", gap: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  heading: { flex: 1, gap: 6 },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  status: { flexDirection: "row", alignItems: "center", gap: 8 },
  error: { color: terrainColors.error, backgroundColor: "#fef2f2", padding: 12, borderRadius: 8 },
  notice: { color: "#166534", backgroundColor: "#f0fdf4", padding: 12, borderRadius: 8 },
  empty: {
    alignItems: "center", gap: 10, padding: 32, backgroundColor: terrainColors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: terrainColors.border,
  },
  card: {
    backgroundColor: terrainColors.surface, padding: 14, gap: 12, borderRadius: 12,
    borderWidth: 1, borderColor: terrainColors.border,
  },
  fileInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { padding: 10, borderRadius: 8, backgroundColor: terrainColors.selected },
  fileDetails: { flex: 1, gap: 3 },
  fileName: { fontSize: 16, fontWeight: "700", color: terrainColors.text },
  fileActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 },
  confirm: { paddingTop: 10, gap: 6, borderTopWidth: 1, borderTopColor: terrainColors.border },
  action: {
    minHeight: 44, paddingHorizontal: 14, justifyContent: "center", alignItems: "center",
    borderRadius: 8, borderWidth: 1, borderColor: terrainColors.border, backgroundColor: terrainColors.surface,
  },
  actionText: { fontWeight: "600", color: terrainColors.controlText },
  primaryAction: { backgroundColor: terrainColors.primary, borderColor: terrainColors.primary },
  primaryText: { color: terrainColors.surface },
  deleteAction: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  deleteText: { color: terrainColors.error },
  dimmed: { opacity: 0.55 },
});
