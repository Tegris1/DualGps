import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import type { EuposSettingsController } from "@/hooks/use-eupos-settings";

import {
  FormField,
  InfoBanner,
  PrimaryButton,
  SectionIntro,
} from "./settings-controls";
import { styles } from "./styles";

export function EuposSettings({
  controller,
}: {
  controller: EuposSettingsController;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const { isSaving, save, saveMessage, settings, update } = controller;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SectionIntro
        icon="cell-tower"
        title="ASG-EUPOS corrections"
        description="Configure the NTRIP caster used to receive RTK corrections."
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <Text style={styles.cardCaption}>
          Credentials issued for your ASG-EUPOS account
        </Text>
        <FormField
          icon="person-outline"
          label="Username"
          placeholder="Enter username"
          value={settings.username}
          onChangeText={(value) => update("username", value)}
        />

        <View style={styles.formGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputShell}>
            <MaterialIcons name="lock-outline" size={20} color="#64748B" />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => update("password", value)}
              placeholder="Enter password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPassword}
              style={styles.input}
              value={settings.password}
            />
            <Pressable
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              hitSlop={8}
              onPress={() => setShowPassword((current) => !current)}
            >
              <MaterialIcons
                name={showPassword ? "visibility-off" : "visibility"}
                size={20}
                color="#64748B"
              />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>NTRIP server</Text>
        <Text style={styles.cardCaption}>
          Caster address and correction stream
        </Text>
        <FormField
          icon="language"
          keyboardType="url"
          label="IP address or hostname"
          placeholder="e.g. caster.example.com"
          value={settings.host}
          onChangeText={(value) => update("host", value)}
        />

        <View style={styles.formRow}>
          <View style={styles.formRowPort}>
            <FormField
              icon="settings-ethernet"
              keyboardType="number-pad"
              label="Port"
              maxLength={5}
              placeholder="2101"
              value={settings.port}
              onChangeText={(value) =>
                update("port", value.replace(/\D/g, ""))
              }
            />
          </View>
          <View style={styles.formRowMountpoint}>
            <FormField
              autoCapitalize="characters"
              icon="router"
              label="Mountpoint"
              placeholder="Stream name"
              value={settings.mountpoint}
              onChangeText={(value) => update("mountpoint", value)}
            />
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Secure connection (TLS)</Text>
            <Text style={styles.switchDescription}>
              Encrypt communication with the NTRIP caster
            </Text>
          </View>
          <Switch
            onValueChange={(value) => update("useTls", value)}
            thumbColor="#FFFFFF"
            trackColor={{ false: "#CBD5E1", true: "#0EA5E9" }}
            value={settings.useTls}
          />
        </View>
      </View>

      {!!saveMessage && <InfoBanner positive message={saveMessage} />}
      <PrimaryButton
        loading={isSaving}
        icon="save"
        label={isSaving ? "Saving…" : "Save ASG-EUPOS settings"}
        onPress={() => void save()}
      />
    </ScrollView>
  );
}
