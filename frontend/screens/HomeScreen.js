// screens/HomeScreen.js
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function HomeScreen({ navigation }) {

  // mock data
  const casualties = [
    { id: "1", name: "Kat Yue", location: "Quad Lawn", triageLevel: "red" },
    { id: "2", name: "John Doe", location: "Van Pelt", triageLevel: "green" },
    { id: "3", name: "Luna Chen", location: "Harnwell", triageLevel: "yellow" },
    { id: "4", name: "Emily Kang", location: "Hill College House", triageLevel: "green" },
  ];

  const triageColors = {
    green: "#22c55e",
    yellow: "#eab308",
    red: "#ef4444",
    black: "#1f2937",
  };

  const count = (level) =>
    casualties.filter((c) => c.triageLevel === level).length;

  const recent = casualties.slice(0, 5);

  return (
    <ScrollView style={styles.container}>
      {/* active incident card */}
      <View style={styles.card}>
        <View style={styles.incidentHeader}>
          <View style={styles.iconRow}>
            <MaterialCommunityIcons name="alert" size={22} color="#011F5B" />
            <Text style={styles.sectionTitle}>Active Incident</Text>
          </View>

          <Text style={styles.totalText}>Total: {casualties.length}</Text>
        </View>

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
          <TouchableOpacity onPress={() => {}}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {recent.map((casualty) => (
          <TouchableOpacity
            key={casualty.id}
            style={styles.casualtyCard}
            onPress={() =>
              navigation.navigate("CasualtyDetail", {
                casualty, 
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
                { backgroundColor: triageColors[casualty.triageLevel] },
              ]}
            >
              <Text style={styles.triagePillText}>
                {casualty.triageLevel === "green"
                  ? "Minor"
                  : casualty.triageLevel === "yellow"
                  ? "Delayed"
                  : casualty.triageLevel === "red"
                  ? "Immediate"
                  : "Deceased"}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
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
});
