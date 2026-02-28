import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, spacing } from "../../styles/CommanderTheme";

const MENU_ITEMS = [
  { name: "Dashboard", screen: "CommanderDashboard", icon: "layout" },
  { name: "Drill Setup", screen: "CommanderDrillSetup", icon: "play-circle" },
  { name: "Officer Checklist", screen: "CommanderChecklist", icon: "clipboard" },
  { name: "Users Management", screen: "CommanderUsers", icon: "users" },
  { name: "Profile & Events", screen: "CommanderProfile", icon: "user" },
  { name: "Settings", screen: "CommanderSettings", icon: "settings" },
];

export default function CommanderMenuScreen({ navigation, onLogout }) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="arrow-left" size={22} color={colors.pennBlue} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Menu</Text>
      {MENU_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.screen}
          style={styles.menuItem}
          onPress={() => navigation.navigate(item.screen)}
          activeOpacity={0.7}
        >
          <Feather name={item.icon} size={22} color={colors.pennBlue} />
          <Text style={styles.menuLabel}>{item.name}</Text>
          <Feather name="chevron-right" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      ))}
      <View style={styles.divider} />
      <TouchableOpacity style={styles.logoutItem} onPress={onLogout} activeOpacity={0.7}>
        <Feather name="log-out" size={22} color={colors.red} />
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  backRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: 6 },
  backText: { fontSize: 16, fontWeight: "600", color: colors.pennBlue },
  title: { fontSize: 20, fontWeight: "700", color: colors.pennBlue, marginBottom: spacing.lg },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    marginBottom: 4,
    gap: 12,
  },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: "500", color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  logoutItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: 12,
  },
  logoutText: { fontSize: 16, fontWeight: "600", color: colors.red },
});
