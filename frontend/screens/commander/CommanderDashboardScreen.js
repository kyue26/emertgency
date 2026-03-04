import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, spacing, shadows } from "../../styles/CommanderTheme";
import commanderApi from "../../services/commanderApi";

/** Convert Officer Checklist treatment counts to dashboard stats format */
function countsToStats(treatmentTarpCounts, transportEntries, deceasedCount) {
  const sum = (color) =>
    ["priority1", "priority2", "priority3", "dead"].reduce(
      (s, k) => s + (treatmentTarpCounts?.[color]?.[k]?.count ?? 0),
      0
    );
  const p1 = transportEntries?.priority1?.length ?? 0;
  const p2 = transportEntries?.priority2?.length ?? 0;
  const p3 = transportEntries?.priority3?.length ?? 0;
  const redTotal = sum("red");
  const yellowTotal = sum("yellow");
  const greenTotal = sum("green");
  const deadInTarps =
    (treatmentTarpCounts?.red?.dead?.count ?? 0) +
    (treatmentTarpCounts?.yellow?.dead?.count ?? 0) +
    (treatmentTarpCounts?.green?.dead?.count ?? 0);
  return {
    red: {
      total: redTotal,
      transported: p1,
      in_treatment: Math.max(0, redTotal - p1),
    },
    yellow: {
      total: yellowTotal,
      transported: p2,
      in_treatment: Math.max(0, yellowTotal - p2),
    },
    green: {
      total: greenTotal,
      transported: p3,
      in_treatment: Math.max(0, greenTotal - p3),
    },
    black: {
      total: (deceasedCount ?? 0) + deadInTarps,
      transported: 0,
      in_treatment: 0,
    },
  };
}

const PRIORITY_CONFIG = [
  { key: "red", label: "Priority 1", bg: colors.redBg, border: colors.red, text: colors.red },
  { key: "yellow", label: "Priority 2", bg: colors.yellowBg, border: colors.yellow, text: colors.yellow },
  { key: "green", label: "Priority 3", bg: colors.greenBg, border: colors.green, text: colors.green },
  { key: "black", label: "Deceased", bg: colors.blackBg, border: colors.black, text: colors.black },
];

export default function CommanderDashboardScreen() {
  const [stats, setStats] = useState(null);
  const [checklistData, setChecklistData] = useState(null);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [eventRes, statsData, resourcesData] = await Promise.all([
        commanderApi.getCurrentEvent().catch(() => ({ success: false, event: null })),
        commanderApi.getCasualtyStatistics().catch(() => null),
        commanderApi.getResourceRequests().catch(() => []),
      ]);
      const event = eventRes?.event || eventRes?.data?.event || null;
      const eventId = event?.event_id;

      let priorityStats = statsData || { red: {}, yellow: {}, green: {}, black: {} };
      let checklistData = null;
      if (eventId) {
        try {
          checklistData = await commanderApi.getChecklistData(eventId);
        } catch (_) {
          try {
            const stored = await AsyncStorage.getItem("@emertgency:treatment_counts:" + eventId);
            checklistData = stored ? JSON.parse(stored) : null;
          } catch (_) {}
        }
        if (checklistData) {
          priorityStats = countsToStats(
            checklistData.treatmentTarpCounts,
            checklistData.transportEntries,
            checklistData.deceasedCount
          );
        }
      } else {
        checklistData = null;
      }

      setStats(priorityStats);
      setChecklistData(checklistData);
      setResources(Array.isArray(resourcesData) ? resourcesData : []);
    } catch (e) {
      console.warn("Commander dashboard load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading && !stats) {
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.pennBlue]} />
      }
    >
      <Animated.View entering={FadeInDown.duration(400)} style={styles.welcomeBlock}>
        <Text style={styles.welcomeTitle}>Welcome, Commander!</Text>
        <Text style={styles.welcomeSubtitle}>Overview of your command center</Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
        <Text style={styles.sectionTitle}>Priority statistics</Text>
        <View style={styles.cardRow}>
          {PRIORITY_CONFIG.map(({ key, label, bg, border, text }, i) => {
            const data = stats?.[key] || { in_treatment: 0, transported: 0, total: 0 };
            return (
              <Animated.View
                key={key}
                entering={FadeInDown.duration(350).delay(50 + i * 40)}
                style={[styles.priorityCard, { backgroundColor: bg, borderColor: border }]}
              >
                <View style={styles.priorityHeader}>
                  <Feather name="alert-triangle" size={24} color={text} />
                  <Text style={[styles.priorityTotal, { color: text }]}>{data.total}</Text>
                </View>
                <Text style={[styles.priorityLabel, { color: text }]}>{label}</Text>
                {key !== "black" && (
                  <View style={styles.priorityDetail}>
                    <Text style={styles.priorityDetailText}>In treatment: {data.in_treatment}</Text>
                    <Text style={styles.priorityDetailText}>Transported: {data.transported}</Text>
                  </View>
                )}
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleWhite}>MERT staging</Text>
        </View>
        <View style={styles.stagingGrid}>
          {[
            {
              icon: "map-pin",
              title: "Staging established",
              sub: [checklistData?.locationDetails?.stagingLocation, checklistData?.locationDetails?.stagingTime].filter(Boolean).join(" / ") || "—",
              done: checklistData?.stagingRadioChecks?.[1],
            },
            {
              icon: "check-circle",
              title: "EMTs start arriving",
              sub: checklistData?.stagingRadioChecks?.[2] ? "Done" : "—",
              done: checklistData?.stagingRadioChecks?.[2],
            },
            {
              icon: "users",
              title: "All EMTs checked in",
              sub: checklistData?.stagingRadioChecks?.[3] ? "Done" : "—",
              done: checklistData?.stagingRadioChecks?.[3],
            },
            {
              icon: "users",
              title: "All EMTs checked out",
              sub: checklistData?.stagingRadioChecks?.[4] ? "Done" : "—",
              done: checklistData?.stagingRadioChecks?.[4],
            },
            {
              icon: "truck",
              title: "Treatment location",
              sub: [checklistData?.locationDetails?.treatmentLocation, checklistData?.locationDetails?.treatmentTime].filter(Boolean).join(" / ") || "—",
            },
            {
              icon: "map-pin",
              title: "Transport location",
              sub: [checklistData?.locationDetails?.transportLocation, checklistData?.locationDetails?.transportTime].filter(Boolean).join(" / ") || "—",
            },
          ].map((item, i) => (
            <View key={i} style={[styles.stagingCard, item.done && styles.stagingCardDone]}>
              <Feather name={item.icon} size={20} color={item.done ? colors.green : colors.pennBlue} />
              <Text style={styles.stagingTitle}>{item.title}</Text>
              <Text style={styles.stagingSub}>{item.sub}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(280)} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleWhite}>Resource requested</Text>
        </View>
        {(() => {
          const fromChecklist = checklistData?.resourcesRequested;
          const list = Array.isArray(fromChecklist) && fromChecklist.length > 0
            ? fromChecklist.map((r) => ({ name: r.resource, confirmed: r.confirmed, time: r.time }))
            : resources.map((r) => ({ name: r.resource_name || r.name, confirmed: r.confirmed, time: r.time_of_arrival ? new Date(r.time_of_arrival).toLocaleTimeString() : null }));
          if (list.length === 0) {
            return (
              <View style={styles.emptyBox}>
                <Feather name="package" size={32} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No resources requested yet</Text>
              </View>
            );
          }
          return list.map((r, i) => (
            <View key={i} style={styles.resourceCard}>
              <Text style={styles.resourceName}>{r.name}</Text>
              <Text style={[styles.resourceStatus, r.confirmed ? styles.confirmed : styles.pending]}>
                {r.confirmed ? "Confirmed" : "Pending"}
              </Text>
              <Text style={styles.resourceTime}>ETA: {r.time || "—"}</Text>
            </View>
          ));
        })()}
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(360)} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleWhite}>Agencies on scene</Text>
        </View>
        <View style={styles.stagingGrid}>
          {(() => {
            const fromChecklist = checklistData?.agenciesOnScene?.filter((a) => (a.agency || "").trim());
            const agencies = fromChecklist?.length
              ? fromChecklist.map((a, i) => ({ name: a.agency, time: a.time, color: [colors.pennBlue, colors.red, colors.green][i % 3] }))
              : [
                  { name: "Penn Police", time: null, color: colors.pennBlue },
                  { name: "PFD", time: null, color: colors.red },
                  { name: "Allied", time: null, color: colors.green },
                ];
            return agencies.map((a, i) => (
              <View key={i} style={styles.stagingCard}>
                <Feather name="shield" size={20} color={a.color} />
                <Text style={styles.stagingTitle}>{a.name}</Text>
                <Text style={styles.stagingSub}>Time of arrival: {a.time || "—"}</Text>
              </View>
            ));
          })()}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  welcomeBlock: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.pennBlue,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  section: { marginBottom: spacing.lg },
  sectionHeader: { backgroundColor: colors.pennBlue, padding: spacing.md, borderRadius: 10, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: colors.pennBlue },
  sectionTitleWhite: { fontSize: 18, fontWeight: "600", color: "#fff" },
  cardRow: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm, gap: spacing.sm },
  priorityCard: {
    width: "48%",
    minWidth: 140,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    ...shadows.card,
  },
  priorityHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  priorityTotal: { fontSize: 28, fontWeight: "700" },
  priorityLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", marginBottom: 6 },
  priorityDetail: { borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.08)", paddingTop: 6 },
  priorityDetailText: { fontSize: 12, color: colors.textSecondary },
  stagingGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stagingCard: {
    width: "48%",
    minWidth: 140,
    backgroundColor: colors.cardBg,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stagingCardDone: {
    borderColor: colors.green,
    backgroundColor: colors.greenBg || "#F0FDF4",
  },
  stagingTitle: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 6 },
  stagingSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  emptyBox: { padding: spacing.xl, alignItems: "center", backgroundColor: colors.cardBg, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  emptyText: { marginTop: 8, fontSize: 14, color: colors.textSecondary },
  resourceCard: {
    backgroundColor: colors.cardBg,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  resourceName: { fontSize: 15, fontWeight: "600", color: colors.text },
  resourceStatus: { fontSize: 13, marginTop: 4 },
  confirmed: { color: colors.green },
  pending: { color: colors.yellow },
  resourceTime: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
