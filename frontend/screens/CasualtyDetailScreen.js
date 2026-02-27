import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Dropdown } from "react-native-element-dropdown";
import { transformCasualty } from "../utils/casualtyTransform";
import { casualtyAPI } from "../services/api";

const codeData = [
  { key: "green", color: "#00C950", title: "Green (Minor)", description: "Walking wounded, minor injuries" },
  { key: "yellow", color: "#F0B100", title: "Yellow (Delayed)", description: "Serious but can tolerate some delay" },
  { key: "red", color: "#FB2C36", title: "Red (Immediate)", description: "Life-threatening, needs immediate care" },
  { key: "black", color: "#1E2939", title: "Black (Deceased)", description: "Deceased or unsurvivable injuries" },
];

const triageConfig = {
  green: { label: "GREEN - Minor", color: "#22c55e" },
  yellow: { label: "YELLOW - Delayed", color: "#eab308" },
  red: { label: "RED - Immediate", color: "#ef4444" },
  black: { label: "BLACK - Deceased", color: "#1f2937" },
};

const eyeOptions = [
  { value: "4", label: "4 – Spontaneously" },
  { value: "3", label: "3 – To Speech" },
  { value: "2", label: "2 – To Pain" },
  { value: "1", label: "1 – No response" },
];

const verbalOptions = [
  { value: "5", label: "5 – Oriented to time, person and place" },
  { value: "4", label: "4 – Confused" },
  { value: "3", label: "3 – Inappropriate words" },
  { value: "2", label: "2 – Incomprehensible sounds" },
  { value: "1", label: "1 – No response" },
];

const motorOptions = [
  { value: "6", label: "6 – Obeys commands" },
  { value: "5", label: "5 – Moves to localised pain" },
  { value: "4", label: "4 – Flex to withdraw from pain" },
  { value: "3", label: "3 – Abnormal flexion" },
  { value: "2", label: "2 – Abnormal extension" },
  { value: "1", label: "1 – No response" },
];

const hospitalStatusOptions = [
  { value: "", label: "Not set" },
  { value: "not_transported", label: "Not Transported" },
  { value: "en_route", label: "En Route to Hospital" },
  { value: "admitted", label: "Admitted" },
  { value: "treated_released", label: "Treated & Released" },
  { value: "transferred", label: "Transferred" },
];

const parseNumber = (value) => {
  if (!value) return null;
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
};

const getRRScore = (rr) => {
  if (rr == null || rr < 0) return null;
  if (rr === 0) return 0;
  if (rr >= 10 && rr <= 29) return 4;
  if (rr > 29) return 3;
  if (rr >= 6 && rr <= 9) return 2;
  if (rr >= 1 && rr <= 5) return 1;
  return null;
};

const getBPScore = (sys) => {
  if (sys == null || sys < 0) return null;
  if (sys === 0) return 0;
  if (sys >= 90) return 4;
  if (sys >= 76 && sys <= 89) return 3;
  if (sys >= 50 && sys <= 75) return 2;
  if (sys >= 1 && sys <= 49) return 1;
  return null;
};

const getGCSScore = (gcs) => {
  if (gcs == null) return null;
  if (gcs === 3) return 0;
  if (gcs >= 4 && gcs <= 5) return 1;
  if (gcs >= 6 && gcs <= 8) return 2;
  if (gcs >= 9 && gcs <= 12) return 3;
  if (gcs >= 13 && gcs <= 15) return 4;
  return null;
};

const getTriagePriority = (totalScore) => {
  if (totalScore == null) return null;
  if (totalScore === 0) return "Dead";
  if (totalScore === 12) return "Priority 3";
  if (totalScore === 11) return "Priority 2";
  if (totalScore <= 10) return "Priority 1";
  return null;
};

export default function CasualtyDetailScreen({ route, navigation }) {
  const { casualty: rawCasualty, onUpdate, onDelete } = route.params;
  const casualty = transformCasualty(rawCasualty) || rawCasualty;

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildFormFromCasualty = () => {
    const vitals = casualty.vitals || {};
    return {
      nameOrId: casualty.name || "",
      triage: casualty.color || casualty.triageLevel || "green",
      description: casualty.description || casualty.injuries || "",
      BP: vitals.BP != null ? String(vitals.BP) : "",
      RR: vitals.RR != null ? String(vitals.RR) : "",
      eye: "",
      verbal: "",
      motor: "",
      additionalNotes: casualty.notes || "",
      breathing: casualty.breathing,
      conscious: casualty.conscious,
      bleeding: casualty.bleeding,
      hospital_status: casualty.hospital_status || "",
    };
  };

  const [form, setForm] = useState(buildFormFromCasualty);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(buildFormFromCasualty());
  };

  const rrNumeric = parseNumber(form.RR);
  const rrScore = getRRScore(rrNumeric);
  const systolic = parseNumber(form.BP);
  const bpScore = getBPScore(systolic);
  const eyeVal = form.eye ? parseInt(form.eye, 10) : null;
  const verbalVal = form.verbal ? parseInt(form.verbal, 10) : null;
  const motorVal = form.motor ? parseInt(form.motor, 10) : null;
  const hasGCSParts = eyeVal != null && verbalVal != null && motorVal != null;
  const gcs = hasGCSParts ? eyeVal + verbalVal + motorVal : null;
  const gcsScore = getGCSScore(gcs);
  const canCalculate = rrScore != null && bpScore != null && gcsScore != null;
  const totalScore = canCalculate ? rrScore + bpScore + gcsScore : null;
  const triagePriority = canCalculate ? getTriagePriority(totalScore) : null;

  const confirmDelete = () => {
    Alert.alert(
      "Delete Record",
      `Are you sure you want to delete ${casualty.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const casualtyId = casualty.injured_person_id || casualty.id;
              await casualtyAPI.deleteCasualty(casualtyId);
              if (onDelete) onDelete();
              navigation.goBack();
            } catch (error) {
              Alert.alert("Error", "Failed to delete casualty. Please try again.");
              console.error("Delete casualty error:", error);
            }
          },
        },
      ]
    );
  };

  const saveChanges = async () => {
    if (!form.triage) {
      Alert.alert("Error", "Please select a triage color.");
      return;
    }

    setSaving(true);
    try {
      const casualtyId = casualty.injured_person_id || casualty.id;

      const otherInfo = casualty.original?.other_information;
      let parsedOtherInfo = {};
      try { parsedOtherInfo = JSON.parse(otherInfo) || {}; } catch { /* keep empty */ }

      parsedOtherInfo.nameOrId = form.nameOrId || parsedOtherInfo.nameOrId;
      parsedOtherInfo.description = form.description || null;
      parsedOtherInfo.additionalNotes = form.additionalNotes || null;

      if (form.RR || form.BP || gcs) {
        parsedOtherInfo.vitals = {
          RR: rrNumeric || null,
          BP: systolic || null,
          gcs: gcs || (casualty.vitals?.gcs || null),
        };
      }
      if (canCalculate) {
        parsedOtherInfo.scores = { rrScore, bpScore, gcsScore };
        parsedOtherInfo.triageScore = totalScore;
        parsedOtherInfo.triagePriority = triagePriority;
      }

      const breathing = form.RR ? (rrNumeric > 0) : form.breathing;
      const conscious = gcs ? (gcs >= 13) : form.conscious;

      const updates = {
        color: form.triage,
        breathing: breathing ?? undefined,
        conscious: conscious ?? undefined,
        bleeding: form.bleeding ?? undefined,
        hospital_status: form.hospital_status || null,
        other_information: JSON.stringify(parsedOtherInfo),
      };

      await casualtyAPI.updateCasualty(casualtyId, updates);
      if (onUpdate) onUpdate(updates);
      setIsEditing(false);
      Alert.alert("Saved", "Casualty record updated successfully.");
    } catch (error) {
      const msg = error?.response?.message || error?.message || "Failed to save changes.";
      Alert.alert("Error", msg);
      console.error("Update casualty error:", error);
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (date) =>
    new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const dropdownStyle = {
    borderWidth: 1,
    borderColor: "#D1D5DC",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    height: 48,
    marginBottom: 8,
  };

  const inputStyle = {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#D1D5DC",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#0A0A0A",
    marginBottom: 16,
  };

  // ─── VIEW MODE ───
  if (!isEditing) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#011f5b" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.actionIconWrapper}>
              <MaterialCommunityIcons name="pencil-outline" size={22} color="#011f5b" />
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmDelete} style={styles.actionIconWrapper}>
              <MaterialCommunityIcons name="trash-can" size={22} color="red" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Basic Info */}
        <View style={styles.card}>
          <Text style={styles.name}>{casualty.name}</Text>
          {casualty.age ? <Text style={styles.subText}>Age: {casualty.age} years</Text> : null}
          <View style={styles.iconRow}>
            <MaterialCommunityIcons name="map-marker" size={18} color="#555" />
            <Text style={styles.iconRowText}>{casualty.location}</Text>
          </View>
          <View style={styles.iconRow}>
            <MaterialCommunityIcons name="clock-outline" size={18} color="#555" />
            <Text style={styles.iconRowText}>Logged: {formatTime(casualty.created_at || casualty.timestamp)}</Text>
          </View>
        </View>

        {/* Triage Level */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="pulse" size={20} color="#011f5b" />
            <Text style={styles.sectionTitle}>Triage Level</Text>
          </View>
          <View style={[styles.triageBadge, { backgroundColor: triageConfig[casualty.color || casualty.triageLevel || "green"].color }]}>
            <View style={styles.whiteDot} />
            <Text style={styles.triageBadgeText}>{triageConfig[casualty.color || casualty.triageLevel || "green"].label}</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Injuries / Chief Complaint</Text>
          <Text style={styles.bodyText}>{casualty.description || casualty.injuries || "No description provided"}</Text>
        </View>

        {/* Vital Signs */}
        {casualty.vitals && Object.values(casualty.vitals).some((v) => v != null) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Vital Signs</Text>
            <View style={styles.vitalGrid}>
              {casualty.vitals.BP != null && (
                <View>
                  <Text style={styles.vitalLabel}>Blood Pressure</Text>
                  <Text style={styles.vitalValue}>{casualty.vitals.BP}</Text>
                </View>
              )}
              {casualty.vitals.RR != null && (
                <View>
                  <Text style={styles.vitalLabel}>Respiratory Rate</Text>
                  <Text style={styles.vitalValue}>{casualty.vitals.RR} breaths/min</Text>
                </View>
              )}
              {casualty.vitals.gcs != null && (
                <View>
                  <Text style={styles.vitalLabel}>Glasgow Coma Scale</Text>
                  <Text style={styles.vitalValue}>{casualty.vitals.gcs}</Text>
                </View>
              )}
            </View>
            {casualty.scores && (
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#eee" }}>
                <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 8 }]}>Triage Scores</Text>
                {casualty.scores.rrScore != null && <Text style={styles.bodyText}>RR Score: {casualty.scores.rrScore}</Text>}
                {casualty.scores.bpScore != null && <Text style={styles.bodyText}>BP Score: {casualty.scores.bpScore}</Text>}
                {casualty.scores.gcsScore != null && <Text style={styles.bodyText}>GCS Score: {casualty.scores.gcsScore}</Text>}
                {casualty.triageScore != null && (
                  <Text style={[styles.bodyText, { fontWeight: "600", marginTop: 4 }]}>Total Triage Score: {casualty.triageScore}</Text>
                )}
                {casualty.triagePriority && (
                  <Text style={[styles.bodyText, { fontWeight: "600", marginTop: 4 }]}>Priority: {casualty.triagePriority}</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Status */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={{ marginTop: 8, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialCommunityIcons name={casualty.breathing ? "check-circle" : "close-circle"} size={20} color={casualty.breathing ? "#22c55e" : "#ef4444"} />
              <Text style={styles.bodyText}>Breathing: {casualty.breathing ? "Yes" : casualty.breathing === false ? "No" : "Unknown"}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialCommunityIcons name={casualty.conscious ? "check-circle" : "close-circle"} size={20} color={casualty.conscious ? "#22c55e" : "#ef4444"} />
              <Text style={styles.bodyText}>Conscious: {casualty.conscious ? "Yes" : casualty.conscious === false ? "No" : "Unknown"}</Text>
            </View>
            {casualty.bleeding !== undefined && casualty.bleeding !== null && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons name={casualty.bleeding ? "alert-circle" : "check-circle"} size={20} color={casualty.bleeding ? "#ef4444" : "#22c55e"} />
                <Text style={styles.bodyText}>Bleeding: {casualty.bleeding ? "Yes" : "No"}</Text>
              </View>
            )}
            {casualty.hospital_status ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons name="hospital-building" size={20} color="#011f5b" />
                <Text style={styles.bodyText}>
                  Hospital: {hospitalStatusOptions.find((o) => o.value === casualty.hospital_status)?.label || casualty.hospital_status}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Additional Notes</Text>
          <Text style={styles.bodyText}>{casualty.notes || "No additional notes"}</Text>
        </View>
      </ScrollView>
    );
  }

  // ─── EDIT MODE (mirrors AddPersonScreen layout) ───
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, backgroundColor: "#D8E2F2", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={{ alignItems: "center", marginTop: 20, marginBottom: 20 }}>
          <Text style={{ fontSize: 26, fontWeight: "900", color: "#011F5B", textAlign: "center" }}>Edit Casualty</Text>
        </View>

        {/* Basic Information */}
        <View style={editStyles.card}>
          <Text style={editStyles.cardTitle}>Basic Information</Text>

          <Text style={editStyles.label}>Name / ID</Text>
          <TextInput
            value={form.nameOrId}
            onChangeText={(t) => updateForm("nameOrId", t)}
            placeholder="Patient name or identifier"
            placeholderTextColor="#0A0A0A80"
            style={inputStyle}
          />

          <Text style={editStyles.label}>Priority Tag *</Text>
          <View>
            {codeData.map((item) => {
              const isSelected = form.triage === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => updateForm("triage", item.key)}
                  style={{
                    marginTop: 8,
                    borderRadius: 8,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? "#111827" : "#D1D5DC",
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: item.color, marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#101828", paddingBottom: 5 }}>{item.title}</Text>
                    <Text style={{ marginTop: 2, fontSize: 14, color: "#4B5563" }}>{item.description}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Vital Signs */}
        <View style={editStyles.card}>
          <Text style={editStyles.cardTitle}>Vital Signs</Text>

          <Text style={editStyles.label}>Respiratory Rate</Text>
          <TextInput
            value={form.RR}
            onChangeText={(t) => updateForm("RR", t)}
            placeholder="breaths/min"
            keyboardType="numeric"
            placeholderTextColor="#0A0A0A80"
            style={inputStyle}
          />

          <Text style={editStyles.label}>Systolic Blood Pressure</Text>
          <TextInput
            value={form.BP}
            onChangeText={(t) => updateForm("BP", t)}
            placeholder="120"
            keyboardType="numeric"
            placeholderTextColor="#0A0A0A80"
            style={inputStyle}
          />
        </View>

        {/* Glasgow Coma Scale */}
        <View style={editStyles.card}>
          <Text style={editStyles.cardTitle}>Glasgow Coma Scale</Text>

          <View style={{ marginBottom: 16 }}>
            <Text style={editStyles.label}>Eye Opening Response</Text>
            <Dropdown
              style={dropdownStyle}
              data={eyeOptions}
              labelField="label"
              valueField="value"
              placeholder="Select eye opening response"
              value={form.eye}
              onChange={(item) => updateForm("eye", item.value)}
              placeholderStyle={{ fontSize: 16, color: "#0A0A0A80" }}
              selectedTextStyle={{ fontSize: 16, color: "#0A0A0A" }}
              itemTextStyle={{ fontSize: 16, color: "#0A0A0A" }}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={editStyles.label}>Verbal Response</Text>
            <Dropdown
              style={dropdownStyle}
              data={verbalOptions}
              labelField="label"
              valueField="value"
              placeholder="Select verbal response"
              value={form.verbal}
              onChange={(item) => updateForm("verbal", item.value)}
              placeholderStyle={{ fontSize: 16, color: "#0A0A0A80" }}
              selectedTextStyle={{ fontSize: 16, color: "#0A0A0A" }}
              itemTextStyle={{ fontSize: 16, color: "#0A0A0A" }}
            />
          </View>

          <View>
            <Text style={editStyles.label}>Motor Response</Text>
            <Dropdown
              style={dropdownStyle}
              data={motorOptions}
              labelField="label"
              valueField="value"
              placeholder="Select motor response"
              value={form.motor}
              onChange={(item) => updateForm("motor", item.value)}
              placeholderStyle={{ fontSize: 16, color: "#0A0A0A80" }}
              selectedTextStyle={{ fontSize: 16, color: "#0A0A0A" }}
              itemTextStyle={{ fontSize: 16, color: "#0A0A0A" }}
            />
          </View>
        </View>

        {/* Calculated Score */}
        <View style={editStyles.card}>
          <Text style={editStyles.cardTitle}>Calculated Triage Score</Text>
          {canCalculate ? (
            <>
              <Text style={{ fontSize: 14, color: "#0A0A0A" }}>Respiratory component score: {rrScore}</Text>
              <Text style={{ fontSize: 14, color: "#0A0A0A" }}>Systolic BP component score: {bpScore}</Text>
              <Text style={{ fontSize: 14, color: "#0A0A0A" }}>Glasgow Coma Score (GCS): {gcs}</Text>
              <Text style={{ fontSize: 14, color: "#0A0A0A" }}>GCS component score: {gcsScore}</Text>
              <Text style={{ fontSize: 14, color: "#0A0A0A", marginTop: 4, fontWeight: "600" }}>Total triage score: {totalScore}</Text>
              <Text style={{ fontSize: 14, color: "#0A0A0A", fontWeight: "600" }}>Triage priority: {triagePriority}</Text>
            </>
          ) : (
            <Text style={{ fontSize: 14, color: "#4B5563" }}>
              Not enough information to calculate triage score. Please enter respiratory rate, systolic BP, and all behavior responses.
            </Text>
          )}
        </View>

        {/* Additional Notes */}
        <View style={editStyles.card}>
          <Text style={editStyles.cardTitle}>Additional Notes</Text>
          <TextInput
            value={form.additionalNotes}
            onChangeText={(t) => updateForm("additionalNotes", t)}
            placeholder="Any additional information"
            placeholderTextColor="#0A0A0A80"
            multiline
            style={{
              borderWidth: 1, borderColor: "#D1D5DC", borderRadius: 8,
              paddingHorizontal: 12, paddingVertical: 12, fontSize: 16,
              color: "#0A0A0A", textAlignVertical: "top", height: 80,
            }}
          />
        </View>
      </ScrollView>

      {/* Floating Action Buttons */}
      <View style={styles.floatingBar}>
        <TouchableOpacity
          onPress={confirmDelete}
          style={styles.floatingDeleteBtn}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color="#ef4444" />
          <Text style={{ color: "#ef4444", fontSize: 14, fontWeight: "500" }}>Delete</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => { setIsEditing(false); resetForm(); }}
            style={styles.floatingCancelBtn}
          >
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "500" }}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={saveChanges}
            disabled={saving}
            style={[styles.floatingSaveBtn, saving && { opacity: 0.6 }]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const editStyles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#011F5B",
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#011F5B",
    marginBottom: 8,
  },
});

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#E8F1FA" },

  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { color: "#011f5b", fontSize: 16 },
  actionRow: { flexDirection: "row", gap: 12 },
  actionIconWrapper: { padding: 8, borderRadius: 10 },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 18, marginBottom: 18 },
  name: { fontSize: 22, color: "#011f5b", fontWeight: "700" },
  subText: { fontSize: 15, color: "#666" },

  iconRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  iconRowText: { color: "#555", fontSize: 15 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#011f5b" },
  bodyText: { fontSize: 15, color: "#444", marginTop: 4 },

  triageBadge: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, marginTop: 10 },
  whiteDot: { width: 12, height: 12, backgroundColor: "#fff", borderRadius: 20 },
  triageBadgeText: { color: "#fff", fontWeight: "600" },

  vitalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 10 },
  vitalLabel: { color: "#777", marginBottom: 2 },
  vitalValue: { fontSize: 16, fontWeight: "600" },

  floatingBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#FFF",
    borderTopWidth: 1, borderTopColor: "#E5E7EB",
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 8,
    gap: 12,
  },
  floatingDeleteBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, borderColor: "#FCA5A5",
  },
  floatingCancelBtn: {
    flex: 1, borderWidth: 1, borderColor: "#D1D5DC", borderRadius: 8,
    paddingVertical: 14, alignItems: "center", backgroundColor: "#FFF",
  },
  floatingSaveBtn: {
    flex: 1, backgroundColor: "#011F5B", borderRadius: 8,
    paddingVertical: 14, alignItems: "center",
  },
});
