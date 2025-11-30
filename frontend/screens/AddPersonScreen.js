import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, ScrollView, TextInput } from "react-native";
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

const AddPersonScreen = ({ navigation }) => {
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const handleCancel = () => {
    setForm(INITIAL_FORM_STATE);
  };
  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    console.log("Form:", form);
    navigation.goBack();
  };

  const dropdownStyle = {
    borderWidth: 1,
    borderColor: "#D1D5DC",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    height: 48,
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
            placeholder="120/80"
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