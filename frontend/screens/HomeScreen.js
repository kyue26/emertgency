// screens/HomeScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { eventAPI, casualtyAPI } from "../services/api";
import { transformCasualties } from "../utils/casualtyTransform";
import {
  EMPTY_PRIORITY_STATS,
  mergeDashboardStats,
  getDashboardTotal,
} from "../utils/dashboardStats";

const DASHBOARD_REFRESH_MS = 10000;

export default function HomeScreen({ navigation }) {
  const [casualties, setCasualties] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [priorityStats, setPriorityStats] = useState(EMPTY_PRIORITY_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const triageColors = {
    green: "#22c55e",
    yellow: "#eab308",
    red: "#ef4444",
    black: "#1f2937",
  };

  const loadData = useCallback(async () => {
    try {
      // get current event (the event the user is part of)
      const currentEventResponse = await eventAPI.getCurrentEvent();
      
      if (currentEventResponse.success && currentEventResponse.event) {
        const event = currentEventResponse.event;
        setActiveEvent(event);

        const [statsResponse, checklistData] = await Promise.all([
          casualtyAPI.getCasualtyStatistics(event.event_id).catch(() => null),
          eventAPI.getChecklistData(event.event_id).catch(() => null),
        ]);
        const baseStats = statsResponse?.success && statsResponse?.data
          ? statsResponse.data
          : EMPTY_PRIORITY_STATS;
        setPriorityStats(mergeDashboardStats({ casualtyStats: baseStats, checklistData }));
        
        // get casualties for this event
        const casualtiesResponse = await casualtyAPI.getCasualties({ 
          event_id: event.event_id,
          limit: 50 
        });
        
        if (casualtiesResponse.success) {
          // transform backend data using utility
          const transformedCasualties = transformCasualties(casualtiesResponse.casualties);
          setCasualties(transformedCasualties);
        }
      } else {
        // no current event
        setActiveEvent(null);
        setCasualties([]);
        setPriorityStats(EMPTY_PRIORITY_STATS);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert("Error", "Failed to load data. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // load data on mount and whenever this screen regains focus
  useFocusEffect(
    useCallback(() => {
      loadData();

      const intervalId = setInterval(() => {
        loadData();
      }, DASHBOARD_REFRESH_MS);

      return () => {
        clearInterval(intervalId);
      };
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const count = (level) => Number(priorityStats?.[level]?.total || 0);

  const totalCount = getDashboardTotal(priorityStats);

  const transportedByPriority = {
    priority1: Number(priorityStats?.red?.transported || 0),
    priority2: Number(priorityStats?.yellow?.transported || 0),
    priority3: Number(priorityStats?.green?.transported || 0),
  };

  const recent = casualties.slice(0, 5);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#011F5B" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* active incident card */}
      <View style={styles.card}>
        <View style={styles.incidentHeader}>
          <View style={styles.iconRow}>
            <MaterialCommunityIcons name="alert" size={22} color="#011F5B" />
            <Text style={styles.sectionTitle}>
              {activeEvent ? activeEvent.name : "No Active Incident"}
            </Text>
          </View>

          <Text style={styles.totalText}>Total: {totalCount}</Text>
        </View>

        {!activeEvent && (
          <View style={{ marginTop: 8, marginBottom: 8, padding: 12, backgroundColor: '#FFFBE6', borderRadius: 8, borderWidth: 1, borderColor: '#E6B900' }}>
            <Text style={{ color: '#011F5B', fontSize: 14, marginBottom: 4, fontWeight: '600' }}>
              Join an Event to View Casualties
            </Text>
            <Text style={{ color: '#011F5B', fontSize: 12 }}>
              Go to your Profile to join an event using an invite code.
            </Text>
          </View>
        )}

        {/* triage counts */}
        <View style={styles.triageRow}>
          {["green", "yellow", "red", "black"].map((level) => (
            <View key={level} style={styles.triageColumn}>
              <View
                style={[
                  styles.circle,
                  { backgroundColor: triageColors[level] },
                ]}
              >
                <Text style={styles.circleNumber}>{count(level)}</Text>
              </View>
              <Text style={styles.triageLabel}>
                {level === "green"
                  ? "Minor"
                  : level === "yellow"
                  ? "Delayed"
                  : level === "red"
                  ? "Immediate"
                  : "Deceased"}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.transportRow}>
          <Text style={styles.transportLabel}>Transported:</Text>
          <Text style={styles.transportValue}>P1 {transportedByPriority.priority1}</Text>
          <Text style={styles.transportValue}>P2 {transportedByPriority.priority2}</Text>
          <Text style={styles.transportValue}>P3 {transportedByPriority.priority3}</Text>
        </View>
      </View>

      {/* add new casualty btn */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() =>
          navigation.navigate("AddNav", {
            screen: "Add",
          })
        }
      >
        <MaterialCommunityIcons name="plus" size={22} color="#FFF" />
        <Text style={styles.addButtonText}>Add New Casualty</Text>
      </TouchableOpacity>

      {/* recent casualties */}
      <View style={{ marginTop: 24 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Recent Casualties</Text>
          <TouchableOpacity onPress={() => navigation.navigate("List")}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {recent.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No casualties yet</Text>
          </View>
        ) : (
          recent.map((casualty) => (
            <TouchableOpacity
              key={casualty.id}
              style={styles.casualtyCard}
              onPress={() =>
                navigation.navigate("CasualtyDetail", {
                  casualty: casualty.original || casualty, 
                })
              }
            >
              <View>
                <Text style={styles.casualtyName}>{casualty.name}</Text>
                <Text style={styles.casualtyLocation}>{casualty.location}</Text>
              </View>

              <View
                style={[
                  styles.triagePill,
                  { backgroundColor: triageColors[casualty.color || casualty.triageLevel] },
                ]}
              >
                <Text style={styles.triagePillText}>
                  {(casualty.color || casualty.triageLevel) === "green"
                    ? "Minor"
                    : (casualty.color || casualty.triageLevel) === "yellow"
                    ? "Delayed"
                    : (casualty.color || casualty.triageLevel) === "red"
                    ? "Immediate"
                    : "Deceased"}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#F4F6FA" },

  card: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 16,
    marginTop: 16,
  },

  incidentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  iconRow: { flexDirection: "row", alignItems: "center", gap: 6 },

  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#011F5B" },
  totalText: { color: "#011F5B", fontSize: 16 },

  triageRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
  },

  transportRow: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  transportLabel: { color: "#374151", fontSize: 13, fontWeight: "600" },
  transportValue: { color: "#111827", fontSize: 13, fontWeight: "700" },

  triageColumn: { alignItems: "center" },

  circle: {
    width: 48,
    height: 48,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },

  circleNumber: { color: "#FFF", fontSize: 16, fontWeight: "700" },

  triageLabel: { color: "#555", fontSize: 14 },

  addButton: {
    backgroundColor: "#011F5B",
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },

  addButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  viewAll: { color: "#011F5B", fontWeight: "600" },

  casualtyCard: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  casualtyName: { fontSize: 16, fontWeight: "600", color: "#111" },
  casualtyLocation: { color: "#666", marginTop: 2 },

  triagePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },

  triagePillText: { color: "#FFF", fontWeight: "600" },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#888",
    fontSize: 16,
  },
});
