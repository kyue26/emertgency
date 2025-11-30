import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput } from "react-native";
import styles from "../styles/AddPersonModalStyles";
import { Dropdown } from "react-native-element-dropdown";

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

  const handleCancel = () => {
    setForm(INITIAL_FORM_STATE);
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
    marginBottom: 20,
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

  const handleSubmit = () => {
    const payload = {
      ...form,
      rrNumeric,
      rrScore,
      systolicBP: systolic,
      bpScore,
      gcs,
      gcsScore,
      triageTotalScore: totalScore,
      triagePriority,
    };

    console.log("Submitting casualty:", payload);
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: 80 },
        ]}
      >
        <View style={styles.titleBox}>
          <Text style={styles.title}>Add New Casualty</Text>
        </View>

        <View>
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
              color: "#0A0A0A80",
              marginBottom: 20,
            }}
          />

          <Text style={styles.text}>Priority Tag:</Text>
          <View style={{ marginBottom: 20 }}>
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
              color: "#0A0A0A80",
              marginBottom: 20,
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
              color: "#0A0A0A80",
              marginBottom: 20,
            }}
          />
        </View>

        <View>
          <Text style={[styles.text, { marginBottom: 6 }]}>
            Eye Opening Response
          </Text>
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

        <View>
          <Text style={[styles.text, { marginBottom: 6 }]}>
            Verbal Response
          </Text>
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
          <Text style={[styles.text, { marginBottom: 6 }]}>
            Motor Response
          </Text>
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

        <Text style={styles.text}>Additional Notes</Text>
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
            color: "#0A0A0A80",
            marginBottom: 20,
            textAlignVertical: "top",
            height: 80,
          }}
        />

        {/* Calculated triage summary */}
        <View
          style={{
            borderWidth: 1,
            borderColor: "#D1D5DC",
            borderRadius: 12,
            padding: 12,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#111827",
              marginBottom: 8,
            }}
          >
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

        <View
          style={{
            flexDirection: "row",
          }}
        >
          <TouchableOpacity
            onPress={handleCancel}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#D1D5DC",
              borderRadius: 8,
              paddingVertical: 12,
              alignItems: "center",
              marginRight: 8,
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
            style={{
              flex: 1,
              backgroundColor: "#011F5B",
              borderRadius: 8,
              paddingVertical: 12,
              alignItems: "center",
              marginLeft: 8,
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              Add Casualty
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default AddPersonScreen;