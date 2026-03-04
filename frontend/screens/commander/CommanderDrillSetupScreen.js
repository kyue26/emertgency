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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, spacing, shadows, radius } from "../../styles/CommanderTheme";
import commanderApi, { getCommanderUser } from "../../services/commanderApi";

const ROLE_STORAGE_PREFIX = "@emertgency:role_assignments:";

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
  const [currentEvent, setCurrentEvent] = useState(null);

  // Incident Commander = whoever is assigned to "command". First person to save becomes IC unless they assign someone else.
  const incidentCommanderName = roleAssignments.command || null;

  const isIncidentCommander = currentUser?.name === incidentCommanderName;
  const isFirstPerson = !currentEvent; // No event yet = first person setting up
  const myAssignedRole = ROLE_KEYS.find((k) => (roleAssignments[k] || "").trim() === (currentUser?.name || "").trim());

  // Which roles this user can see and edit
  const visibleRoleKeys = (() => {
    if (isFirstPerson) return ["command"]; // First person only sees Command
    if (isIncidentCommander) return ROLE_KEYS; // IC sees all
    if (myAssignedRole) return [myAssignedRole]; // Assigned member sees only their role
    return []; // Normal member with no role sees nothing
  })();

  const canAssignRole = useCallback(
    (roleKey) => {
      const assigned = roleAssignments[roleKey] || "";
      const currentName = currentUser?.name || "";
      if (isFirstPerson && roleKey === "command") return true; // First person can assign Command
      if (isIncidentCommander) return true; // IC can assign any role
      if (assigned === currentName) return true; // Assigned person can transfer their own role
      return false;
    },
    [roleAssignments, currentUser?.name, isFirstPerson, isIncidentCommander]
  );

  const persistRoleAssignments = useCallback(async (eventId, assignments) => {
    if (!eventId) return;
    try {
      await AsyncStorage.setItem(ROLE_STORAGE_PREFIX + eventId, JSON.stringify(assignments));
    } catch (e) {
      console.warn("Failed to persist role assignments:", e);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventRes, profs, user] = await Promise.all([
        commanderApi.getCurrentEvent().catch(() => ({ success: false, event: null })),
        commanderApi.getProfessionals(),
        getCommanderUser(),
      ]);
      setProfessionals(Array.isArray(profs) ? profs : []);
      setCurrentUser(user);

      const event = eventRes?.event || eventRes?.data?.event || null;
      setCurrentEvent(event);

      if (event) {
        setIsDrillActive(event.status === "in_progress");
        setDrillInfo({
          drillName: event.name || "",
          location: event.location || "",
          date: event.start_time
            ? new Date(event.start_time).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
        });
        try {
          const stored = await AsyncStorage.getItem(ROLE_STORAGE_PREFIX + event.event_id);
          if (stored) {
            const parsed = JSON.parse(stored);
            const merged = ROLE_KEYS.reduce((a, k) => ({ ...a, [k]: parsed[k] || "" }), {});
            setRoleAssignments(merged);
          }
        } catch (_) {}
      } else {
        setIsDrillActive(false);
      }
    } catch (e) {
      console.warn("Load drill/event error:", e);
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
    if (!drillInfo.drillName.trim()) {
      setError("Event name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      // First person to save = Incident Commander unless they assigned command to someone else
      const assignments = { ...roleAssignments };
      if (!assignments.command?.trim() && currentUser?.name) {
        assignments.command = currentUser.name;
        setRoleAssignments(assignments);
      }

      const updates = {
        name: drillInfo.drillName.trim(),
        location: drillInfo.location?.trim() || undefined,
        start_time: drillInfo.date ? new Date(drillInfo.date).toISOString() : undefined,
      };
      let event;
      if (currentEvent?.event_id) {
        const res = await commanderApi.updateEvent(currentEvent.event_id, updates);
        event = res?.event || { ...currentEvent, ...updates };
        setCurrentEvent(event);
      } else {
        const res = await commanderApi.createEvent(updates);
        event = res?.event || res;
        setCurrentEvent(event);
      }
      if (event?.event_id) {
        await persistRoleAssignments(event.event_id, assignments);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await load();
    } catch (e) {
      setError(e.message || "Failed to save event");
    } finally {
      setSaving(false);
    }
  };

  const handleStartDrill = async () => {
    if (!currentEvent) {
      setError("Create an event first, then start it.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await commanderApi.startEvent();
      setIsDrillActive(true);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await load();
    } catch (e) {
      setError(e.message || "Failed to start event");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = useCallback(
    (roleKey, value) => {
      const next = { ...roleAssignments, [roleKey]: value || "" };
      setRoleAssignments(next);
      if (currentEvent?.event_id) {
        persistRoleAssignments(currentEvent.event_id, next);
      }
    },
    [roleAssignments, currentEvent?.event_id, persistRoleAssignments]
  );

  const handleStopDrill = () => {
    Alert.alert(
      "Stop Event",
      "Are you sure you want to stop the event? This will end the current active event.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop Event",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            setError(null);
            setSuccess(false);
            try {
              await commanderApi.stopEvent();
              setIsDrillActive(false);
              setSuccess(true);
              setTimeout(() => setSuccess(false), 3000);
              await load();
            } catch (e) {
              setError(e.message || "Failed to stop event");
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
          <Text style={styles.activeBannerText}>Event is active — Transport officers can start their 5‑minute tracking timer from the Officer Checklist.</Text>
        </View>
      )}

      {/* Event & Invite Code - Commander creates event and shares code with members */}
      <AnimatedSection entering={FadeInDown.duration(400).delay(0)} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconWrap, { backgroundColor: colors.green }]}>
            <Feather name="key" size={22} color="#fff" />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>Event & Invite Code</Text>
            <Text style={styles.cardSubtitle}>
              Create an event and share the invite code so members can join
            </Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          {currentEvent ? (
            <>
              <View style={{ marginBottom: spacing.md }}>
                <Text style={styles.inputLabel}>Current event</Text>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
                  {currentEvent.name || "—"}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                  Status: {currentEvent.status === "in_progress" ? "Active" : currentEvent.status || "—"}
                </Text>
              </View>
              {currentEvent.invite_code && (
                <View style={{
                  backgroundColor: "#F0F9FF",
                  borderWidth: 2,
                  borderColor: colors.pennBlue,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                }}>
                  <Text style={[styles.inputLabel, { marginBottom: 4 }]}>Invite code — share with members</Text>
                  <Text style={{ fontSize: 24, fontWeight: "700", color: colors.pennBlue, letterSpacing: 4 }}>
                    {currentEvent.invite_code}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md }}>
              No event yet. Fill in the drill info below and tap "Save setup" to create an event and get an invite code.
            </Text>
          )}
        </View>
      </AnimatedSection>

      <AnimatedSection entering={FadeInDown.duration(400).delay(80)} style={styles.card}>
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
              {isFirstPerson
                ? "Assign yourself or someone else as Incident Commander, then save and start the drill."
                : isIncidentCommander
                  ? "Assign names to each role. Only the Incident Commander can assign unassigned roles."
                  : myAssignedRole
                    ? "You can transfer your assigned role to someone else."
                    : "You have no role assignment. Only the Incident Commander can assign roles."}
            </Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          {visibleRoleKeys.length === 0 ? (
            <Text style={styles.roleHint}>
              No role assignments visible. Join the event and wait for the Incident Commander to assign you a role.
            </Text>
          ) : (
            <View style={styles.roleGrid}>
              {visibleRoleKeys.map((key) => {
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
          )}
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
