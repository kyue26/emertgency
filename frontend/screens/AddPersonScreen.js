import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import styles from "../styles/AddPersonModalStyles";
import { Dropdown } from "react-native-element-dropdown";
import { casualtyAPI, eventAPI } from "../services/api";

const codeData = [
  {
    key: "green",
    color: "#00C950",
    text: "#101828",
    subtitle: "#6A7282",
    title: "Green (Minor)",
    description: "Walking wounded, minor injuries",
  },
  {
    key: "yellow",
    color: "#F0B100",
    text: "#101828",
    subtitle: "#6A7282",
    title: "Yellow (Delayed)",
    description: "Serious but can tolerate some delay",
  },
  {
    key: "red",
    color: "#FB2C36",
    text: "#101828",
    subtitle: "#6A7282",
    title: "Red (Immediate)",
    description: "Life-threatening, needs immediate care",
  },
  {
    key: "black",
    color: "#1E2939",
    text: "#101828",
    subtitle: "#6A7282",
    title: "Black (Deceased)",
    description: "Deceased or unsurvivable injuries",
  },
];

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

const INITIAL_FORM_STATE = {
  nameOrId: "",
  triage: "",
  description: "",
  BP: "",
  RR: "",
  eye: "",
  verbal: "",
  motor: "",
  additionalNotes: "",
};

// --- helpers for scoring ---

const parseNumber = (value) => {
  if (!value) return null;
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
};

const parseSystolicBP = (value) => {
  if (!value) return null;
  const [sysStr] = value.split("/");
  const n = parseFloat(sysStr);
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

const AddPersonScreen = ({ navigation }) => {
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [activeEventId, setActiveEventId] = useState(null);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(true);

  const fetchCurrentEvent = useCallback(async () => {
    setLoadingEvent(true);
    try {
      const response = await eventAPI.getCurrentEvent();
      if (response.success && response.event) {
        setCurrentEvent(response.event);
        setActiveEventId(response.event.event_id);
      } else {
        // No current event - don't show alert, just set to null
        setCurrentEvent(null);
        setActiveEventId(null);
      }
    } catch (error) {
      console.error('Error fetching current event:', error);
      setCurrentEvent(null);
      setActiveEventId(null);
    } finally {
      setLoadingEvent(false);
    }
  }, []);

  // get current event on mount + whenever this screen is focused again
  useFocusEffect(
    useCallback(() => {
      fetchCurrentEvent();
    }, [fetchCurrentEvent])
  );

  const handleCancel = () => {
    setForm(INITIAL_FORM_STATE);
    navigation.goBack();
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // derived scores for display and submission
  const rrNumeric = parseNumber(form.RR);
  const rrScore = getRRScore(rrNumeric);

  const systolic = parseSystolicBP(form.BP);
  const bpScore = getBPScore(systolic);

  const eyeVal = form.eye ? parseInt(form.eye, 10) : null;
  const verbalVal = form.verbal ? parseInt(form.verbal, 10) : null;
  const motorVal = form.motor ? parseInt(form.motor, 10) : null;
  const hasGCSParts =
    eyeVal != null && verbalVal != null && motorVal != null;

  const gcs = hasGCSParts ? eyeVal + verbalVal + motorVal : null;
  const gcsScore = getGCSScore(gcs);

  const canCalculate =
    rrScore != null && bpScore != null && gcsScore != null;

  const totalScore = canCalculate
    ? rrScore + bpScore + gcsScore
    : null;

  const triagePriority = canCalculate
    ? getTriagePriority(totalScore)
    : null;

  const dropdownStyle = {
    borderWidth: 1,
    borderColor: "#D1D5DC",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    height: 48,
    marginBottom: 8,
  };

  const placeholderStyle = {
    fontSize: 16,
    color: "#0A0A0A80",
  };

  const selectedTextStyle = {
    fontSize: 16,
    color: "#0A0A0A",
  };

  const itemTextStyle = {
    fontSize: 16,
    color: "#0A0A0A",
  };

  const handleSubmit = async () => {
    if (!activeEventId) {
      Alert.alert("Error", "No active event found. Please create an event first.");
      return;
    }

    if (!form.triage) {
      Alert.alert("Error", "Please select a triage color.");
      return;
    }

    // map triage key -> color
    const colorMap = {
      green: 'green',
      yellow: 'yellow',
      red: 'red',
      black: 'black',
    };

    const color = colorMap[form.triage];
    if (!color) {
      Alert.alert("Error", "Invalid triage selection.");
      return;
    }

    // need to build casualty data for backend
    // i'm storing data as JSON in other_information
    const otherInfoData = {
      nameOrId: form.nameOrId || null,
      description: form.description || null,
      vitals: {
        RR: rrNumeric || null,
        BP: systolic || null,
        gcs: gcs || null,
      },
      scores: {
        rrScore: rrScore || null,
        bpScore: bpScore || null,
        gcsScore: gcsScore || null,
      },
      triageScore: totalScore || null,
      triagePriority: triagePriority || null,
      additionalNotes: form.additionalNotes || null,
    };

    const casualtyData = {
      event_id: activeEventId,
      color: color,
      breathing: form.RR ? (rrNumeric > 0 ? true : false) : undefined,
      conscious: gcs ? (gcs >= 13 ? true : false) : undefined,
      bleeding: undefined, // not in form 
      hospital_status: undefined, // not in form
      other_information: JSON.stringify(otherInfoData), 
    };

    setLoading(true);
    try {
      const response = await casualtyAPI.addCasualty(casualtyData);
      if (response.success) {
        Alert.alert("Success", "Casualty added successfully!");
        setForm(INITIAL_FORM_STATE);
        navigation.goBack();
      } else {
        Alert.alert("Error", response.message || "Failed to add casualty.");
      }
    } catch (error) {
      console.error('Error adding casualty:', error);
      Alert.alert("Error", error.message || "Failed to add casualty. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loadingEvent) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#011F5B" />
        <Text style={{ marginTop: 10, color: '#666' }}>Loading event...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: 100 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.titleBox}>
          <Text style={styles.title}>Add New Casualty</Text>
          {!activeEventId && (
            <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FFFBE6', borderRadius: 8, borderWidth: 1, borderColor: '#E6B900' }}>
              <Text style={{ color: '#011F5B', fontSize: 14, marginBottom: 4, fontWeight: '600' }}>
                Join an Event to Add Casualties
              </Text>
              <Text style={{ color: '#011F5B', fontSize: 12 }}>
                Go to your Profile to join an event using an invite code.
              </Text>
            </View>
          )}
          {currentEvent && currentEvent.status !== 'in_progress' && (
            <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5' }}>
              <Text style={{ color: '#991B1B', fontSize: 14, marginBottom: 4, fontWeight: '600' }}>
                Event Not Active
              </Text>
              <Text style={{ color: '#991B1B', fontSize: 12 }}>
                This event is currently {currentEvent.status}. Ask a commander to activate it to start tracking casualties.
              </Text>
            </View>
          )}
        </View>

        {/* Basic Information Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Basic Information</Text>
          <Text style={styles.text}>Name / ID *</Text>
          <TextInput
            value={form.nameOrId}
            onChangeText={(text) => updateForm("nameOrId", text)}
            placeholder="Patient name or identifier"
            placeholderTextColor="#0A0A0A80"
            style={{
              marginTop: 6,
              borderWidth: 1,
              borderColor: "#D1D5DC",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 16,
              color: "#0A0A0A",
              marginBottom: 16,
            }}
          />

          <Text style={styles.text}>Priority Tag *</Text>
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
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: item.color,
                      marginRight: 12,
                    }}
                  />

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: item.text,
                        paddingBottom: 5,
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 14,
                        color: "#4B5563",
                      }}
                    >
                      {item.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Vital Signs Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vital Signs</Text>
          <Text style={styles.text}>Respiratory Rate</Text>
          <TextInput
            value={form.RR}
            onChangeText={(text) => updateForm("RR", text)}
            placeholder="breaths/min"
            keyboardType="numeric"
            placeholderTextColor="#0A0A0A80"
            style={{
              marginTop: 6,
              borderWidth: 1,
              borderColor: "#D1D5DC",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 16,
              color: "#0A0A0A",
              marginBottom: 16,
            }}
          />

          <Text style={styles.text}>Systolic Blood Pressure</Text>
          <TextInput
            value={form.BP}
            onChangeText={(text) => updateForm("BP", text)}
            placeholder="120"
            placeholderTextColor="#0A0A0A80"
            keyboardType="numeric"
            style={{
              marginTop: 6,
              borderWidth: 1,
              borderColor: "#D1D5DC",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 16,
              color: "#0A0A0A",
            }}
          />
        </View>

        {/* Glasgow Coma Scale Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Glasgow Coma Scale</Text>
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.text}>Eye Opening Response</Text>
            <Dropdown
              style={dropdownStyle}
              data={eyeOptions}
              labelField="label"
              valueField="value"
              placeholder="Select eye opening response"
              value={form.eye}
              onChange={(item) => updateForm("eye", item.value)}
              placeholderStyle={placeholderStyle}
              selectedTextStyle={selectedTextStyle}
              itemTextStyle={itemTextStyle}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={styles.text}>Verbal Response</Text>
            <Dropdown
              style={dropdownStyle}
              data={verbalOptions}
              labelField="label"
              valueField="value"
              placeholder="Select verbal response"
              value={form.verbal}
              onChange={(item) => updateForm("verbal", item.value)}
              placeholderStyle={placeholderStyle}
              selectedTextStyle={selectedTextStyle}
              itemTextStyle={itemTextStyle}
            />
          </View>

          <View>
            <Text style={styles.text}>Motor Response</Text>
            <Dropdown
              style={dropdownStyle}
              data={motorOptions}
              labelField="label"
              valueField="value"
              placeholder="Select motor response"
              value={form.motor}
              onChange={(item) => updateForm("motor", item.value)}
              placeholderStyle={placeholderStyle}
              selectedTextStyle={selectedTextStyle}
              itemTextStyle={itemTextStyle}
            />
          </View>
        </View>

        {/* Additional Notes Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Additional Notes</Text>
          <TextInput
            value={form.additionalNotes}
            onChangeText={(text) => updateForm("additionalNotes", text)}
            placeholder="Any additional information"
            placeholderTextColor="#0A0A0A80"
            multiline
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DC",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 12,
              fontSize: 16,
              color: "#0A0A0A",
              textAlignVertical: "top",
              height: 80,
            }}
          />
        </View>

        {/* Calculated Triage Score Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Calculated Triage Score
          </Text>

          {canCalculate ? (
            <>
              <Text style={{ fontSize: 14, color: "#0A0A0A" }}>
                Respiratory component score: {rrScore}
              </Text>
              <Text style={{ fontSize: 14, color: "#0A0A0A" }}>
                Systolic BP component score: {bpScore}
              </Text>
              <Text style={{ fontSize: 14, color: "#0A0A0A" }}>
                Glasgow Coma Score (GCS): {gcs}
              </Text>
              <Text style={{ fontSize: 14, color: "#0A0A0A" }}>
                GCS component score: {gcsScore}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: "#0A0A0A",
                  marginTop: 4,
                  fontWeight: "600",
                }}
              >
                Total triage score: {totalScore}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: "#0A0A0A",
                  fontWeight: "600",
                }}
              >
                Triage priority: {triagePriority}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 14, color: "#4B5563" }}>
              Not enough information to calculate triage score. Please enter
              respiratory rate, systolic BP, and all behavior responses.
            </Text>
          )}
        </View>

      </ScrollView>

      {/* Floating Action Buttons */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: '#FFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
        }}
      >
        <TouchableOpacity
          onPress={handleCancel}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: "#D1D5DC",
            borderRadius: 8,
            paddingVertical: 14,
            alignItems: "center",
            marginRight: 8,
            backgroundColor: '#FFF',
          }}
        >
          <Text
            style={{
              color: "#111827",
              fontSize: 16,
              fontWeight: "500",
            }}
          >
            Cancel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading || loadingEvent || !activeEventId}
          style={{
            flex: 1,
            backgroundColor: loading || loadingEvent || !activeEventId ? "#999" : "#011F5B",
            borderRadius: 8,
            paddingVertical: 14,
            alignItems: "center",
            marginLeft: 8,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              Add Casualty
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AddPersonScreen;