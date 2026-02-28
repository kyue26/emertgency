import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, shadows, radius } from "../../styles/CommanderTheme";
import commanderApi from "../../services/commanderApi";

const RESPONSIBILITIES = [
  "Staging",
  "Incident Command",
  "Triage",
  "Treatment",
  "Transport",
];

const TASKS_BY_RESP = {
  Staging: [
    "Staging - All EMTs arrived?",
    "Triage - All triage tags back + final patient counts",
    "Treatment - Tarp cleared",
    "Transport - All patients transported",
    "Staging - All checked out",
  ],
  "Incident Command": [
    "Initial Report to Radio - ICS established + incident command post location",
    "Radio - Staging location established",
    "Radio - Treatment location established",
    "Radio - Transport location established",
    "Radio - Transport bus check-in (once transport requests bus)",
    "Radio - Drill concluded (after last patient gone + all EMTs accounted for)",
  ],
  Triage: ["For 1st group remind them to get green first (yell)"],
  Treatment: [],
  Transport: [],
};

export default function CommanderChecklistScreen() {
  const [activeTab, setActiveTab] = useState("Staging");
  const [roleAssignments, setRoleAssignments] = useState({});
  const [completed, setCompleted] = useState({});

  const load = useCallback(async () => {
    try {
      const drill = await commanderApi.getActiveDrill();
      if (drill?.role_assignments) {
        setRoleAssignments(drill.role_assignments);
      }
    } catch (e) {
      console.warn("Checklist load error:", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const tasks = TASKS_BY_RESP[activeTab] || [];
  const completedCount = tasks.filter((t) => completed[t]).length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const toggle = (title) => {
    setCompleted((p) => ({ ...p, [title]: !p[title] }));
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Responsibility filters - wrap, no horizontal scroll */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconWrap}>
            <Feather name="clipboard" size={22} color="#fff" />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>Officer checklist</Text>
            <Text style={styles.cardSubtitle}>Select your responsibility, then mark tasks complete</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.filterLabel}>Responsibility</Text>
          <View style={styles.tabWrap}>
            {RESPONSIBILITIES.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.tab, activeTab === r && styles.tabActive]}
                onPress={() => setActiveTab(r)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, activeTab === r && styles.tabTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Progress */}
      <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.card}>
        <View style={styles.cardBody}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressCount}>
              {completedCount} / {totalCount} completed
            </Text>
          </View>
          <View style={styles.progressBar}>
            <Animated.View
              style={[styles.progressFill, { width: `${progress}%` }]}
            />
          </View>
        </View>
      </Animated.View>

      {/* Task list */}
      <Animated.View entering={FadeInDown.duration(400).delay(120)} style={styles.card}>
        <View style={styles.cardBody}>
          <Text style={styles.tasksSectionTitle}>Tasks</Text>
          {tasks.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Feather name="check-circle" size={32} color={colors.textSecondary} />
              <Text style={styles.empty}>No tasks for this responsibility.</Text>
            </View>
          ) : (
            tasks.map((title, i) => (
              <Animated.View
                key={title}
                entering={FadeInDown.duration(300).delay(i * 35)}
              >
                <TouchableOpacity
                  style={styles.taskRow}
                  onPress={() => toggle(title)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.checkWrap,
                      completed[title] && styles.checkWrapDone,
                    ]}
                  >
                    <Feather
                      name={completed[title] ? "check" : "minus"}
                      size={16}
                      color={completed[title] ? "#fff" : colors.textSecondary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.taskTitle,
                      completed[title] && styles.taskDone,
                    ]}
                    numberOfLines={3}
                  >
                    {title}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
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
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
  cardBody: { padding: spacing.lg },
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  tabWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.pennBlue,
    borderColor: colors.pennBlue,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
  },
  tabTextActive: { color: "#fff" },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  progressCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.pennBlue,
    borderRadius: 4,
  },
  tasksSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.md,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  checkWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkWrapDone: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  taskTitle: { flex: 1, fontSize: 15, color: colors.text },
  taskDone: {
    textDecorationLine: "line-through",
    color: colors.textSecondary,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  empty: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
