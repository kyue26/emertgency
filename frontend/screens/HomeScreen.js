import React from "react";
import { View, Text, ScrollView } from "react-native";
import styles from "../styles/HomeScreenStyles";

const HomeScreen = () => {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.titleBlue}>e</Text>
        <Text style={styles.titleRed}>MERT</Text>
        <Text style={styles.titleBlue}>gency</Text>
      </View>

      <Text style={styles.tagline}>
        Connecting Penn students and responders during mass casualty events.
      </Text>
    </ScrollView>
  );
};

export default HomeScreen;
