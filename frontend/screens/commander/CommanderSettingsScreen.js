import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing } from "../../styles/CommanderTheme";

const SETTINGS_SECTIONS = [
  { icon: "globe", title: "General", desc: "Organization name, contact, timezone" },
  { icon: "activity", title: "Response", desc: "Priority thresholds, auto-dispatch" },
  { icon: "bell", title: "Notifications", desc: "Email, SMS, push, incident alerts" },
  { icon: "lock", title: "Security", desc: "Two-factor, password expiry, session" },
  { icon: "shield", title: "Permissions", desc: "Default role, registration, access" },
];

export default function CommanderSettingsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Settings</Text>
      <Text style={styles.subheader}>
        System and command preferences. Full settings can be wired to your backend when integrated.
      </Text>
      {SETTINGS_SECTIONS.map((s) => (
        <View key={s.title} style={styles.card}>
          <Feather name={s.icon} size={22} color={colors.pennBlue} />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardDesc}>{s.desc}</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.textSecondary} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  header: { fontSize: 22, fontWeight: "700", color: colors.pennBlue, marginBottom: 4 },
  subheader: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    gap: 12,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  cardDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
