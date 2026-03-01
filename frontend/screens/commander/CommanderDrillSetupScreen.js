import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Dropdown } from "react-native-element-dropdown";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, shadows, radius } from "../../styles/CommanderTheme";
import commanderApi, { getCommanderUser } from "../../services/commanderApi";

const ROLE_KEYS = [
  "command",
  "staging",
  "triage",
  "treatment",
  "transport",
  "red",
  "yellow",
  "green",
];

const ROLE_LABELS = {
  command: "Command",
  staging: "Staging",
  triage: "Triage",
  treatment: "Treatment",
  transport: "Transport",
  red: "Red (Immediate)",
  yellow: "Yellow (Delayed)",
  green: "Green (Minor)",
};

const AnimatedSection = Animated.createAnimatedComponent(View);

// First MERT member in list = incident commander. Fallback: first Commander, then first in list.
function getIncidentCommanderName(professionals) {
  if (!professionals?.length) return null;
  const mert = professionals.find((p) => (p.role || "").toLowerCase().includes("mert"));
  if (mert) return mert.name;
  const cmd = professionals.find((p) => (p.role || "").toLowerCase() === "commander");
  if (cmd) return cmd.name;
  return professionals[0]?.name || null;
}

export default function CommanderDrillSetupScreen() {
  const [drillInfo, setDrillInfo] = useState({
    drillName: "",
    location: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [roleAssignments, setRoleAssignments] = useState(
    ROLE_KEYS.reduce((acc, k) => ({ ...acc, [k]: "" }), {})
  );
  const [professionals, setProfessionals] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isDrillActive, setIsDrillActive] = useState(false);

  const incidentCommanderName = getIncidentCommanderName(professionals);

  const canAssignRole = useCallback(
    (roleKey) => {
      const assigned = roleAssignments[roleKey] || "";
      const currentName = currentUser?.name || "";
      if (!assigned) {
        return currentName === incidentCommanderName;
      }
      return assigned === currentName;
    },
    [roleAssignments, currentUser?.name, incidentCommanderName]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, profs, user] = await Promise.all([
        commanderApi.getActiveDrill(),
        commanderApi.getProfessionals(),
        getCommanderUser(),
      ]);
      setProfessionals(Array.isArray(profs) ? profs : []);
      setCurrentUser(user);

      if (data) {
        setIsDrillActive(data.status === "active" || !!data.is_active);
        setDrillInfo({
          drillName: data.drill_name || data.drillName || "",
          location: data.location || "",
          date: data.drill_date
            ? new Date(data.drill_date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
        });
        const profList = Array.isArray(profs) ? profs : [];
        const icName = getIncidentCommanderName(profList);
        let assignments = { ...data.role_assignments };
        if (!assignments.command && icName) {
          assignments.command = icName;
        }
        setRoleAssignments(assignments);
      } else {
        setIsDrillActive(false);
      }
    } catch (e) {
      console.warn("Load drill error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await commanderApi.createOrUpdateDrill({
        drillName: drillInfo.drillName,
        location: drillInfo.location,
        date: drillInfo.date,
        roleAssignments,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e.message || "Failed to save drill setup");
    } finally {
      setSaving(false);
    }
  };

  const handleStartDrill = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const assignments = { ...roleAssignments };
      if (!assignments.command && incidentCommanderName) {
        assignments.command = incidentCommanderName;
      }
      await commanderApi.startDrill({
        drillName: drillInfo.drillName,
        location: drillInfo.location,
        date: drillInfo.date,
        roleAssignments: assignments,
      });
      setRoleAssignments(assignments);
      setIsDrillActive(true);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e.message || "Failed to start drill");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = useCallback(
    async (roleKey, value) => {
      const next = { ...roleAssignments, [roleKey]: value || "" };
      setRoleAssignments(next);
      if (isDrillActive) {
        try {
          await commanderApi.createOrUpdateDrill({
            drillName: drillInfo.drillName,
            location: drillInfo.location,
            date: drillInfo.date,
            roleAssignments: next,
          });
        } catch (e) {
          console.warn("Auto-save role change failed:", e);
          setRoleAssignments(roleAssignments);
        }
      }
    },
    [roleAssignments, isDrillActive, drillInfo]
  );

  const handleStopDrill = () => {
    Alert.alert(
      "Stop Drill",
      "Are you sure you want to stop the drill? This will end the current active drill session.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop Drill",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            setError(null);
            setSuccess(false);
            try {
              await commanderApi.stopDrill();
              setIsDrillActive(false);
              setSuccess(true);
              setTimeout(() => setSuccess(false), 3000);
            } catch (e) {
              setError(e.message || "Failed to stop drill");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

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
      {error ? (
        <AnimatedSection entering={FadeInDown.duration(300)} style={styles.errorBox}>
          <Feather name="alert-circle" size={20} color={colors.red} />
          <Text style={styles.errorText}>{error}</Text>
        </AnimatedSection>
      ) : null}
      {success ? (
        <AnimatedSection entering={FadeInDown.duration(300)} style={styles.successBox}>
          <Feather name="check-circle" size={20} color={colors.green} />
          <Text style={styles.successText}>
            {isDrillActive ? "Drill started successfully." : "Drill stopped successfully."}
          </Text>
        </AnimatedSection>
      ) : null}

      {isDrillActive && (
        <View style={styles.activeBanner}>
          <Feather name="radio" size={20} color="#fff" />
          <Text style={styles.activeBannerText}>Drill is active — Transport officers can start their 5‑minute tracking timer from the Officer Checklist.</Text>
        </View>
      )}

      <AnimatedSection entering={FadeInDown.duration(400).delay(0)} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconWrap}>
            <Feather name="info" size={22} color="#fff" />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>Drill information</Text>
            <Text style={styles.cardSubtitle}>Name, location, and date for this drill</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.inputLabel}>Drill name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Spring 2026 Mass Casualty Drill"
            placeholderTextColor={colors.textSecondary}
            value={drillInfo.drillName}
            onChangeText={(t) => setDrillInfo((p) => ({ ...p, drillName: t }))}
          />
          <Text style={styles.inputLabel}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Penn Campus, Locust Walk"
            placeholderTextColor={colors.textSecondary}
            value={drillInfo.location}
            onChangeText={(t) => setDrillInfo((p) => ({ ...p, location: t }))}
          />
          <Text style={styles.inputLabel}>Date</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            value={drillInfo.date}
            onChangeText={(t) => setDrillInfo((p) => ({ ...p, date: t }))}
          />
        </View>
      </AnimatedSection>

      <AnimatedSection entering={FadeInDown.duration(400).delay(80)} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconWrap, { backgroundColor: colors.green }]}>
            <Feather name="users" size={22} color="#fff" />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>Role assignments</Text>
            <Text style={styles.cardSubtitle}>
              Assign names to each role; they'll appear in checklists. Changes auto-save during an active drill.
            </Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.roleHint}>
            Incident Commander (first MERT member) can assign empty roles. Only the assigned person can transfer a role.
          </Text>
          <View style={styles.roleGrid}>
            {ROLE_KEYS.map((key) => {
              const editable = canAssignRole(key);
              const dropdownData = [
                { label: "— Unassigned", value: "" },
                ...professionals.map((p) => ({ label: p.name || p.email || "?", value: p.name || "" })),
              ];
              return (
                <View key={key} style={styles.roleCell}>
                  <Text style={styles.roleLabel}>{ROLE_LABELS[key]}</Text>
                  {editable ? (
                    <Dropdown
                      style={styles.roleDropdown}
                      data={dropdownData}
                      labelField="label"
                      valueField="value"
                      placeholder={`Select ${ROLE_LABELS[key]}`}
                      value={roleAssignments[key] || ""}
                      onChange={(item) => handleRoleChange(key, item.value || "")}
                      placeholderStyle={styles.dropdownPlaceholder}
                      selectedTextStyle={styles.dropdownSelected}
                    />
                  ) : (
                    <View style={styles.roleReadOnly}>
                      <Text style={styles.roleReadOnlyText}>
                        {roleAssignments[key] || "— Unassigned"}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </AnimatedSection>

      <AnimatedSection
        entering={FadeInDown.duration(400).delay(160)}
        style={styles.actions}
      >
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving && !isDrillActive ? (
            <ActivityIndicator size="small" color={colors.pennBlue} />
          ) : (
            <>
              <Feather name="save" size={20} color={colors.pennBlue} />
              <Text style={[styles.btnText, { color: colors.pennBlue }]}>Save setup</Text>
            </>
          )}
        </TouchableOpacity>

        {!isDrillActive ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleStartDrill}
            disabled={saving || !drillInfo.drillName}
          >
            <Feather name="play-circle" size={20} color="#fff" />
            <Text style={[styles.btnText, { color: "#fff" }]}>Start drill</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btn, styles.btnStop]}
            onPress={handleStopDrill}
            disabled={saving}
          >
            <Feather name="stop-circle" size={20} color="#fff" />
            <Text style={[styles.btnText, { color: "#fff" }]}>Stop drill</Text>
          </TouchableOpacity>
        )}
      </AnimatedSection>

      <View style={{ height: spacing.xl * 2 }} />
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
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.green,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  activeBannerText: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.redBg,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.red,
  },
  errorText: { flex: 1, color: colors.red, fontSize: 14 },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.greenBg,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.green,
  },
  successText: { flex: 1, color: colors.green, fontSize: 14 },
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
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  cardTitleWrap: { flex: 1 },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  cardBody: { padding: spacing.lg },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  roleCell: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: spacing.md,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 6,
  },
  roleHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    fontStyle: "italic",
  },
  roleDropdown: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 40,
  },
  dropdownPlaceholder: { color: colors.textSecondary, fontSize: 14 },
  dropdownSelected: { fontSize: 14, color: colors.text },
  roleReadOnly: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    minHeight: 40,
    justifyContent: "center",
  },
  roleReadOnlyText: { fontSize: 14, color: colors.textSecondary },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  btnPrimary: {
    backgroundColor: colors.pennBlue,
    ...shadows.card,
  },
  btnSecondary: {
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.pennBlue,
  },
  btnStop: {
    backgroundColor: colors.red,
    ...shadows.card,
  },
  btnText: { fontSize: 16, fontWeight: "600" },
});
