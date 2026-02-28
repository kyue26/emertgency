import React, { useState, useCallback, useContext } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { AuthContext } from "../../context/AuthContext";
import { colors, spacing, radius, shadows } from "../../styles/CommanderTheme";
import commanderApi from "../../services/commanderApi";

const ROLES = [
  { id: "ic", name: "Incident Commander", desc: "Overall incident management and coordination" },
  { id: "staging", name: "Staging Officer", desc: "Manage staging area and EMT check-in/out" },
  { id: "triage", name: "Triage Officer", desc: "Patient assessment and priority assignment" },
  { id: "treatment", name: "Treatment Officer", desc: "Coordinate patient treatment operations" },
  { id: "transport", name: "Transport Officer", desc: "Manage patient transport and ambulance coordination" },
];

const SETTINGS_SECTIONS = [
  { icon: "globe", title: "General", desc: "Organization name, contact, timezone" },
  { icon: "activity", title: "Response", desc: "Priority thresholds, auto-dispatch" },
  { icon: "bell", title: "Notifications", desc: "Email, SMS, push, incident alerts" },
  { icon: "lock", title: "Security", desc: "Two-factor, password expiry, session" },
  { icon: "shield", title: "Permissions", desc: "Default role, registration, access" },
];

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function CommanderProfileScreen() {
  const { handleLogout } = useContext(AuthContext);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState("Mass Casualty - Campus Building Collapse");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = await commanderApi.getCurrentUser().catch(() => null);
      setUser(u);
    } catch (e) {
      console.warn("Profile load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.pennBlue} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile card with avatar */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{getInitials(user?.name)}</Text>
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>Profile & events</Text>
            <Text style={styles.cardSubtitle}>{user?.name || "Commander"}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.profileRow}>
            <Feather name="user" size={20} color={colors.pennBlue} />
            <View style={styles.profileInfo}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{user?.name || "—"}</Text>
            </View>
          </View>
          <View style={styles.profileRow}>
            <Feather name="mail" size={20} color={colors.pennBlue} />
            <View style={styles.profileInfo}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{user?.email || "—"}</Text>
            </View>
          </View>
          <View style={styles.profileRow}>
            <Feather name="phone" size={20} color={colors.pennBlue} />
            <View style={styles.profileInfo}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{user?.phoneNumber || user?.phone_number || "—"}</Text>
            </View>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.label}>Role</Text>
            <Text style={styles.value}>{user?.role || "Commander"}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Current event */}
      <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconWrap, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Feather name="calendar" size={22} color="#fff" />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>Current event</Text>
            <Text style={styles.cardSubtitle}>{selectedEvent}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.hint}>
            Event selection and details can be wired to your backend when integrated.
          </Text>
        </View>
      </Animated.View>

      {/* Officer roles */}
      <Animated.View entering={FadeInDown.duration(400).delay(160)} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconWrap, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Feather name="users" size={22} color="#fff" />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>Officer roles</Text>
            <Text style={styles.cardSubtitle}>Role definitions for the command structure</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          {ROLES.map((r) => (
            <View key={r.id} style={styles.roleItem}>
              <Text style={styles.roleName}>{r.name}</Text>
              <Text style={styles.roleDesc}>{r.desc}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Settings (moved from separate screen) */}
      <Animated.View entering={FadeInDown.duration(400).delay(240)} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconWrap, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Feather name="settings" size={22} color="#fff" />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>Settings</Text>
            <Text style={styles.cardSubtitle}>
              System and command preferences
            </Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          {SETTINGS_SECTIONS.map((s) => (
            <View key={s.title} style={styles.settingsRow}>
              <Feather name={s.icon} size={20} color={colors.pennBlue} />
              <View style={styles.settingsTextWrap}>
                <Text style={styles.settingsTitle}>{s.title}</Text>
                <Text style={styles.settingsDesc}>{s.desc}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textSecondary} />
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Sign out */}
      <Animated.View entering={FadeInDown.duration(400).delay(280)} style={[styles.card, styles.logoutCard]}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => handleLogout?.()}
          activeOpacity={0.7}
        >
          <View style={styles.logoutIconWrap}>
            <Feather name="log-out" size={20} color={colors.red} />
          </View>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    overflow: "hidden",
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.pennBlue,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarLargeText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  cardTitleWrap: { flex: 1 },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
  cardBody: { padding: spacing.lg },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: 12,
  },
  profileInfo: { flex: 1 },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  value: { fontSize: 15, color: colors.text, fontWeight: "500" },
  hint: { fontSize: 13, color: colors.textSecondary },
  roleItem: { marginBottom: spacing.sm },
  roleName: { fontSize: 14, fontWeight: "600", color: colors.text },
  roleDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  settingsTextWrap: { flex: 1 },
  settingsTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  settingsDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  logoutCard: { padding: spacing.lg },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: 12,
    backgroundColor: colors.redBg,
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.2)",
  },
  logoutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.red,
  },
});
