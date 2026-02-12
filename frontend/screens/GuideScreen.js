import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

const codeData = [
  {
    key: "green",
    color: "#00C950",
    text: "#101828",
    title: "Green (Minor)",
    description: "Walking wounded, minor injuries",
  },
  {
    key: "yellow",
    color: "#F0B100",
    text: "#101828",
    title: "Yellow (Delayed)",
    description: "Serious but can tolerate some delay",
  },
  {
    key: "red",
    color: "#FB2C36",
    text: "#101828",
    title: "Red (Immediate)",
    description: "Life-threatening, needs immediate care",
  },
  {
    key: "black",
    color: "#1E2939",
    text: "#101828",
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

const triageCharts = [
  {
    title: "Respiratory Rate",
    rows: [
      { left: "10 - 29", right: "4" },
      { left: "> 29", right: "3" },
      { left: "6 - 9", right: "2" },
      { left: "1 - 5", right: "1" },
      { left: "0", right: "0" },
    ],
  },
  {
    title: "Systolic Blood Pressure",
    rows: [
      { left: ">= 90", right: "4" },
      { left: "76 - 89", right: "3" },
      { left: "50 - 75", right: "2" },
      { left: "1 - 49", right: "1" },
      { left: "0", right: "0" },
    ],
  },
  {
    title: "Glasgow Coma Score",
    rows: [
      { left: "13 - 15", right: "4" },
      { left: "9 - 12", right: "3" },
      { left: "6 - 8", right: "2" },
      { left: "4 - 5", right: "1" },
      { left: "3", right: "0" },
    ],
  },
  {
    title: "Triage Priority",
    rows: [
      { left: "12", right: "Priority 3" },
      { left: "11", right: "Priority 2" },
      { left: "<= 10", right: "Priority 1" },
      { left: "0", right: "Dead" },
    ],
  },
];

const GuideScreen = () => {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
      >
        <View style={styles.titleBox}>
          <Text style={styles.title}>Reference & Guidelines</Text>
        </View>

        {/* Triage Score Calculator */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Triage Score Calculator</Text>

          {triageCharts.map((chart) => (
            <View key={chart.title} style={styles.chartContainer}>
              <Text style={styles.chartTitle}>{chart.title}</Text>

              {chart.rows.map((row, idx) => (
                <View key={idx} style={styles.chartRow}>
                  <View style={styles.chartCell}>
                    <Text style={styles.chartCellText}>{row.left}</Text>
                  </View>
                  <View style={styles.chartCell}>
                    <Text style={styles.chartCellText}>{row.right}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Priority Assignment */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Priority Assignment</Text>

          {codeData.map((item) => (
            <View key={item.key} style={styles.priorityItem}>
              <View style={[styles.colorCircle, { backgroundColor: item.color }]} />
              <View style={styles.priorityContent}>
                <Text style={styles.priorityTitle}>{item.title}</Text>
                <Text style={styles.priorityDescription}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Behavior & Response */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Behavior & Response</Text>

          <View style={styles.responseSection}>
            <Text style={styles.responseLabel}>Eye Opening Response</Text>
            {eyeOptions.map((opt) => (
              <Text key={opt.value} style={styles.responseText}>
                {opt.label}
              </Text>
            ))}
          </View>

          <View style={styles.responseSection}>
            <Text style={styles.responseLabel}>Verbal Response</Text>
            {verbalOptions.map((opt) => (
              <Text key={opt.value} style={styles.responseText}>
                {opt.label}
              </Text>
            ))}
          </View>

          <View style={styles.responseSection}>
            <Text style={styles.responseLabel}>Motor Response</Text>
            {motorOptions.map((opt) => (
              <Text key={opt.value} style={styles.responseText}>
                {opt.label}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#D8E2F2",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 80,
  },
  titleBox: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#011F5B",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#011F5B",
    marginBottom: 8,
  },
  chartContainer: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 6,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  chartRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  chartCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  chartCellText: {
    fontSize: 13,
    color: "#0A0A0A",
  },
  priorityItem: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  colorCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
  },
  priorityContent: {
    flex: 1,
  },
  priorityTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#101828",
    marginBottom: 4,
  },
  priorityDescription: {
    fontSize: 14,
    color: "#4B5563",
  },
  responseSection: {
    marginBottom: 16,
  },
  responseLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#011F5B",
    marginTop: 8,
    marginBottom: 8,
  },
  responseText: {
    fontSize: 14,
    color: "#0A0A0A",
    marginTop: 4,
  },
});

export default GuideScreen;