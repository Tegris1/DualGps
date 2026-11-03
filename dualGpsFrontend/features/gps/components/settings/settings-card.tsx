import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { styles } from "./styles";

type SettingsCardProps = {
  title: string;
  caption?: string;
  headerAction?: ReactNode;
  children: ReactNode;
};

export function SettingsCard({ title, caption, headerAction, children }: SettingsCardProps) {
  return (
    <View style={styles.card}>
      <View style={headerAction ? styles.cardHeader : undefined}>
        <View style={headerAction ? styles.cardHeaderText : undefined}>
          <Text style={styles.cardTitle}>{title}</Text>
          {caption && <Text style={styles.cardCaption}>{caption}</Text>}
        </View>
        {headerAction}
      </View>
      {children}
    </View>
  );
}
