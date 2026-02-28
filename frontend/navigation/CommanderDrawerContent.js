import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, shadows } from "../styles/CommanderTheme";
import { COMMANDER_MENU_ITEMS } from "./commanderScreenConfig";
import { getCommanderUser } from "../services/commanderApi";

function getInitials(name) {
  if (!name || typeof name !== "string") return "C";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function CommanderDrawerContent(props) {
  const { state, navigation, onLogout } = props;
  const insets = useSafeAreaInsets();
  const current = state?.routes?.[state.index]?.name;
  const [user, setUser] = useState(null);

  useEffect(() => {
    getCommanderUser().then(setUser).catch(() => setUser(null));
  }, []);

  const profileFocused = current === "CommanderProfile";

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg },
      ]}
      style={styles.drawerScroll}
    >
      <View style={styles.container}>
      {/* Branding header */}
      <View style={styles.brandBlock}>
        <View style={styles.brandIconWrap}>
          <Feather name="shield" size={28} color="#fff" />
        </View>
        <View style={styles.brandTextWrap}>
          <Text style={styles.brandTitle}>eMERTgency</Text>
          <Text style={styles.brandSubtitle}>Command Center</Text>
        </View>
      </View>

      {/* Section label */}
      <Text style={styles.sectionLabel}>Navigate</Text>

      {/* Menu items */}
      <View style={styles.menu}>
        {COMMANDER_MENU_ITEMS.map((item) => {
          const focused = current === item.screen;
          return (
            <TouchableOpacity
              key={item.screen}
              style={[styles.menuItem, focused && styles.menuItemActive]}
              onPress={() => {
                navigation.navigate(item.screen);
                navigation.closeDrawer();
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconCircle,
                  focused ? styles.iconCircleActive : styles.iconCircleInactive,
                ]}
              >
                <Feather
                  name={item.icon}
                  size={20}
                  color={focused ? "#fff" : colors.pennBlue}
                />
              </View>
              <Text
                style={[
                  styles.menuLabel,
                  focused && styles.menuLabelActive,
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer: Profile (with pic) + Sign out */}
      <View style={styles.footer}>
        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.profileRow, profileFocused && styles.profileRowActive]}
          onPress={() => {
            navigation.navigate("CommanderProfile");
            navigation.closeDrawer();
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.avatarWrap, profileFocused && styles.avatarWrapActive]}>
            <Text style={[styles.avatarText, profileFocused && styles.avatarTextActive]}>
              {getInitials(user?.name)}
            </Text>
          </View>
          <View style={styles.profileTextWrap}>
            <Text style={[styles.profileName, profileFocused && styles.profileNameActive]}>
              {user?.name || "Commander"}
            </Text>
            <Text style={[styles.profileLabel, profileFocused && styles.profileLabelActive]}>
              Profile & Events
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutItem}
          onPress={() => {
            navigation.closeDrawer();
            onLogout?.();
          }}
          activeOpacity={0.7}
        >
          <View style={styles.logoutIconWrap}>
            <Feather name="log-out" size={20} color={colors.red} />
          </View>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  drawerScroll: {
    flex: 1,
    backgroundColor: colors.cardBg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  container: {
    flex: 1,
    minHeight: "100%",
    paddingHorizontal: 0,
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.pennBlue,
    borderRadius: radius.lg,
    ...shadows.card,
  },
  brandIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  brandTextWrap: { flex: 1 },
  brandTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  menu: { flex: 1 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: 4,
    gap: 12,
  },
  menuItemActive: {
    backgroundColor: colors.pennBlue,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleInactive: {
    backgroundColor: colors.background,
  },
  iconCircleActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  menuLabelActive: {
    color: "#fff",
    fontWeight: "600",
  },
  footer: {},
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    gap: 12,
  },
  profileRowActive: {
    backgroundColor: colors.pennBlue,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pennBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrapActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  avatarTextActive: {
    color: "#fff",
  },
  profileTextWrap: { flex: 1 },
  profileName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  profileNameActive: {
    color: "#fff",
  },
  profileLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileLabelActive: {
    color: "rgba(255,255,255,0.9)",
  },
  logoutItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
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
