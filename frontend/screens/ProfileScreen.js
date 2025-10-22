import React from "react";
import { View, Text, Image, StyleSheet, ScrollView } from "react-native";
import styles from "../styles/ProfileScreenStyles";

const ProfileScreen = () => {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* profile img */}
      <Image
        source={require("../assets/headshot.jpeg")}
        style={styles.avatar}
      />

      {/* name */}
      <Text style={styles.name}>Angelina Cao</Text>
      <Text style={styles.edit}>edit my profile</Text>

      {/* user */}
      <View style={styles.usernameBox}>
        <Text style={styles.usernameText}>user: angiecao24</Text>
      </View>

      {/* stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>5</Text>
          <Text style={styles.statLabel}>Contacts</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>15</Text>
          <Text style={styles.statLabel}>followers</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>15</Text>
          <Text style={styles.statLabel}>following</Text>
        </View>
      </View>

      {/* commander */}
      <Text style={styles.sectionHeader}>My Commander</Text>
      <View style={styles.card}>
        <View>
          <Text style={styles.cardName}>Nanyu Cao</Text>
          <Text style={styles.cardDetail}>503-999-9999</Text>
          <Text style={styles.cardDetail}>nanyu@gmail.com</Text>
          <Text style={styles.cardMore}>see more… ›</Text>
        </View>
      </View>

      {/* group members */}
      <Text style={styles.sectionHeader}>Members of my Group</Text>
      <View style={styles.card}>
        <View>
          <Text style={styles.cardName}>Emily Kang</Text>
          <Text style={styles.cardDetail}>443-467-7759</Text>
          <Text style={styles.cardDetail}>emkang@gmail.com</Text>
          <Text style={styles.cardMore}>see more… ›</Text>
        </View>
    
      </View>
    </ScrollView>
  );
};

export default ProfileScreen;
