import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const triageConfig = {
  green: { label: "GREEN - Minor", color: "#22c55e" },
  yellow: { label: "YELLOW - Delayed", color: "#eab308" },
  red: { label: "RED - Immediate", color: "#ef4444" },
  black: { label: "BLACK - Deceased", color: "#1f2937" },
};

export default function CasualtyDetailScreen({ route, navigation }) {
  const { casualty, onUpdate, onDelete } = route.params;

  const [isEditing, setIsEditing] = useState(false);
  const [edited, setEdited] = useState({
    triageLevel: casualty.triageLevel,
    notes: casualty.notes || "",
  });

  const confirmDelete = () => {
    Alert.alert(
      "Delete Record",
      `Are you sure you want to delete ${casualty.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDelete();
            navigation.goBack();
          },
        },
      ]
    );
  };

  const saveChanges = () => {
    onUpdate(edited);
    setIsEditing(false);
  };

  const formatTime = (date) =>
    new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <ScrollView style={styles.container}>
      {/* BACK + ACTION BUTTONS */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color="#011f5b"
          />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => setIsEditing(!isEditing)}
            style={styles.actionIconWrapper}
          >
            <MaterialCommunityIcons
              name="pencil-outline"
              size={22}
              color="#011f5b"
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={confirmDelete}
            style={styles.actionIconWrapper}
          >
            <MaterialCommunityIcons name="trash-can" size={22} color="red" />
          </TouchableOpacity>
        </View>
      </View>

      {/* CARD: Basic Info */}
      <View style={styles.card}>
        <Text style={styles.name}>{casualty.name}</Text>
        {casualty.age && (
          <Text style={styles.subText}>Age: {casualty.age} years</Text>
        )}

        <View style={styles.iconRow}>
          <MaterialCommunityIcons name="map-marker" size={18} color="#555" />
          <Text style={styles.iconRowText}>{casualty.location}</Text>
        </View>

        <View style={styles.iconRow}>
          <MaterialCommunityIcons name="clock-outline" size={18} color="#555" />
          <Text style={styles.iconRowText}>
            Logged: {formatTime(casualty.timestamp)}
          </Text>
        </View>
      </View>

      {/* CARD: Triage Level */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="pulse" size={20} color="#011f5b" />
          <Text style={styles.sectionTitle}>Triage Level</Text>
        </View>

        {isEditing ? (
          <View style={{ gap: 10 }}>
            {Object.keys(triageConfig).map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.triageOption,
                  edited.triageLevel === level && styles.triageSelected,
                ]}
                onPress={() =>
                  setEdited((p) => ({ ...p, triageLevel: level }))
                }
              >
                <View
                  style={[
                    styles.triageDot,
                    { backgroundColor: triageConfig[level].color },
                  ]}
                />
                <Text style={styles.triageLabel}>
                  {triageConfig[level].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.triageBadge,
              { backgroundColor: triageConfig[casualty.triageLevel].color },
            ]}
          >
            <View style={styles.whiteDot} />
            <Text style={styles.triageBadgeText}>
              {triageConfig[casualty.triageLevel].label}
            </Text>
          </View>
        )}
      </View>

      {/* Injuries */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Injuries / Chief Complaint</Text>
        <Text style={styles.bodyText}>{casualty.injuries}</Text>
      </View>

      {/* Vital Signs */}
      {casualty.vitals &&
        Object.values(casualty.vitals).some((v) => v !== undefined) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Vital Signs</Text>

            <View style={styles.vitalGrid}>
              {casualty.vitals.bloodPressure && (
                <View>
                  <Text style={styles.vitalLabel}>Blood Pressure</Text>
                  <Text style={styles.vitalValue}>
                    {casualty.vitals.bloodPressure}
                  </Text>
                </View>
              )}
              {casualty.vitals.heartRate && (
                <View>
                  <Text style={styles.vitalLabel}>Heart Rate</Text>
                  <Text style={styles.vitalValue}>
                    {casualty.vitals.heartRate} bpm
                  </Text>
                </View>
              )}
              {casualty.vitals.respiratoryRate && (
                <View>
                  <Text style={styles.vitalLabel}>Respiratory Rate</Text>
                  <Text style={styles.vitalValue}>
                    {casualty.vitals.respiratoryRate} breaths/min
                  </Text>
                </View>
              )}
              {casualty.vitals.oxygenSaturation && (
                <View>
                  <Text style={styles.vitalLabel}>SpO2</Text>
                  <Text style={styles.vitalValue}>
                    {casualty.vitals.oxygenSaturation}%
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

      {/* Notes */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Additional Notes</Text>

        {isEditing ? (
          <TextInput
            multiline
            value={edited.notes}
            onChangeText={(t) => setEdited((p) => ({ ...p, notes: t }))}
            placeholder="Add notes..."
            style={styles.notesInput}
          />
        ) : (
          <Text style={styles.bodyText}>
            {casualty.notes || "No additional notes"}
          </Text>
        )}
      </View>

      {/* Save / Cancel */}
      {isEditing && (
        <View style={styles.editButtonsRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setIsEditing(false);
              setEdited({
                triageLevel: casualty.triageLevel,
                notes: casualty.notes || "",
              });
            }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={saveChanges}>
            <Text style={styles.saveText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#E8F1FA", },

  /* Top Row */
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { color: "#011f5b", fontSize: 16 },
  actionRow: { flexDirection: "row", gap: 12 },
  actionIconWrapper: {
    padding: 8,
    borderRadius: 10,
  },

  /* Card */
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
  },

  name: { fontSize: 22, color: "#011f5b", fontWeight: "700" },
  subText: { fontSize: 15, color: "#666" },

  iconRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  iconRowText: { color: "#555", fontSize: 15 },

  /* Section */
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#011f5b" },

  bodyText: { fontSize: 15, color: "#444", marginTop: 4 },

  /* Triage */
  triageBadge: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  whiteDot: {
    width: 12,
    height: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
  },
  triageBadgeText: { color: "#fff", fontWeight: "600" },

  triageOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ddd",
  },
  triageSelected: {
    borderColor: "#011f5b",
    backgroundColor: "#eef4ff",
  },
  triageDot: {
    width: 18,
    height: 18,
    borderRadius: 20,
  },
  triageLabel: { fontSize: 15, color: "#333" },

  /* Vitals */
  vitalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 10,
  },
  vitalLabel: { color: "#777", marginBottom: 2 },
  vitalValue: { fontSize: 16, fontWeight: "600" },

  /* Notes */
  notesInput: {
    marginTop: 6,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    minHeight: 120,
    textAlignVertical: "top",
  },

  /* Edit Buttons */
  editButtonsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bbb",
  },
  cancelText: { textAlign: "center", color: "#444", fontSize: 16 },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#011f5b",
  },
  saveText: { textAlign: "center", color: "#fff", fontSize: 16 },
});
