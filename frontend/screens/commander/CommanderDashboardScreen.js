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
import { colors, spacing, shadows } from "../../styles/CommanderTheme";
import commanderApi from "../../services/commanderApi";

const PRIORITY_CONFIG = [
  { key: "red", label: "Priority 1", bg: colors.redBg, border: colors.red, text: colors.red },
  { key: "yellow", label: "Priority 2", bg: colors.yellowBg, border: colors.yellow, text: colors.yellow },
  { key: "green", label: "Priority 3", bg: colors.greenBg, border: colors.green, text: colors.green },
  { key: "black", label: "Deceased", bg: colors.blackBg, border: colors.black, text: colors.black },
];

export default function CommanderDashboardScreen() {
  const [stats, setStats] = useState(null);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statsData, resourcesData] = await Promise.all([
        commanderApi.getCasualtyStatistics().catch(() => null),
        commanderApi.getResourceRequests().catch(() => []),
      ]);
      setStats(statsData || { red: {}, yellow: {}, green: {}, black: {} });
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
            { icon: "map-pin", title: "Staging established", sub: "Location / Time: —" },
            { icon: "check-circle", title: "EMTs start arriving", sub: "Time: —" },
            { icon: "users", title: "All EMTs checked in", sub: "Time: —" },
            { icon: "users", title: "All EMTs checked out", sub: "Time: —" },
            { icon: "truck", title: "Treatment location", sub: "Time requested: —" },
            { icon: "map-pin", title: "Transport location", sub: "Time requested: —" },
          ].map((item, i) => (
            <View key={i} style={styles.stagingCard}>
              <Feather name={item.icon} size={20} color={colors.pennBlue} />
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
        {resources.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="package" size={32} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No resources requested yet</Text>
          </View>
        ) : (
          resources.map((r) => (
            <View key={r.resource_request_id || r.id} style={styles.resourceCard}>
              <Text style={styles.resourceName}>{r.resource_name || r.name}</Text>
              <Text style={[styles.resourceStatus, r.confirmed ? styles.confirmed : styles.pending]}>
                {r.confirmed ? "Confirmed" : "Pending"}
              </Text>
              <Text style={styles.resourceTime}>
                ETA: {r.time_of_arrival ? new Date(r.time_of_arrival).toLocaleTimeString() : "—"}
              </Text>
            </View>
          ))
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(360)} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleWhite}>Agencies on scene</Text>
        </View>
        <View style={styles.stagingGrid}>
          {[
            { name: "Penn Police", color: colors.pennBlue },
            { name: "PFD", color: colors.red },
            { name: "Allied", color: colors.green },
          ].map((a) => (
            <View key={a.name} style={styles.stagingCard}>
              <Feather name="shield" size={20} color={a.color} />
              <Text style={styles.stagingTitle}>{a.name}</Text>
              <Text style={styles.stagingSub}>Time of arrival: —</Text>
            </View>
          ))}
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
