// screens/CommanderTodoScreen.js
import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import styles from "../styles/CommanderTodoScreenStyles";

const tasks = [
  { id: 1, code: "BLACK", team: "MERT Team 6", arrival: "in 10 min", priority: "high" },
  { id: 2, code: "RED", team: "MERT Team 7", arrival: "just now", priority: "high" },
  { id: 3, code: "YELLOW", team: "MERT Team 6", arrival: "3 min ago", priority: "high" },
  { id: 4, code: "GREEN", team: "MERT Team 7", arrival: "in 30 min", priority: "low" },
  { id: 5, code: "GREEN", team: "MERT Team 2", arrival: "in 33 min", priority: "low" },
];

const colorMap = {
  BLACK: { bg: "#e6e6e6", text: "#000" },
  RED: { bg: "#F8D7DA", text: "#721C24" },
  YELLOW: { bg: "#FFF3CD", text: "#856404" },
  GREEN: { bg: "#DFF6DD", text: "#155724" },
};

const TaskCard = ({ code, team, arrival }) => {
  const c = colorMap[code];
  return (
    <View style={[styles.card, { backgroundColor: c.bg }]}>
      <Text style={[styles.cardTitle, { color: c.text }]}>#{code}</Text>
      <Text style={styles.cardDetail}>
        {team} • {arrival}
      </Text>
    </View>
  );
};

export default function CommanderTodoScreen({ navigation }) {
  const high = tasks.filter((t) => t.priority === "high");
  const low = tasks.filter((t) => t.priority === "low");

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.mass}>MASS CASUALTY</Text>
        <Text style={styles.camp}>MERT CAMP #1 COMMAND</Text>
        <Text style={styles.sub}>Tasks assigned to you</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Text style={styles.sectionHigh}>HIGH PRIORITY</Text>
        {high.map((t) => (
          <TaskCard key={t.id} {...t} />
        ))}

        <Text style={styles.sectionLow}>LOW PRIORITY</Text>
        {low.map((t) => (
          <TaskCard key={t.id} {...t} />
        ))}

        
      </ScrollView>
    </View>
  );
}