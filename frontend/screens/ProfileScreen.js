import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { FontAwesome5, MaterialIcons, Feather } from '@expo/vector-icons'; // Assuming you use expo vector icons or similar
import styles from "../styles/ProfileScreenStyles";

// *** Dummy Data & State for Demonstration ***
const profileData = {
  name: "Maya Huizar",
  title: "EMT",
  email: "huizar@pennmert.upenn.edu",
  pendingTasks: 0,
  activeTasks: 0,
  totalTasks: 0,
  isUserOnDuty: false, // Start as Off Duty to match initial profile screenshot
  checkInTime: "Nov 30, 12:48 PM", // Updated to match your screenshot
  checkOutTime: "Nov 30, 12:48 PM", // Updated to match your screenshot
  duration: "0h 0m",
  todayShifts: 1,
  todayStatus: "Inactive",
};

const ProfileScreen = ({ navigation }) => {
  // Use state to manage duty status
  const [isUserOnDuty, setIsUserOnDuty] = useState(profileData.isUserOnDuty);
  const [shiftData, setShiftData] = useState({
      checkIn: profileData.checkInTime,
      checkOut: profileData.checkOutTime,
      duration: profileData.duration,
      todayShifts: profileData.todayShifts,
      todayStatus: profileData.todayStatus,
  });

  // Function to simulate checking in/out
  const toggleDutyStatus = () => {
      if (isUserOnDuty) {
          // Simulate Check Out
          const now = new Date();
          const checkOutTimeStr = `${now.toDateString().substring(4, 10)}, ${now.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}`;
          setShiftData(prev => ({
              ...prev,
              checkOut: checkOutTimeStr,
              todayStatus: "Inactive",
          }));
      } else {
          // Simulate Check In
          const now = new Date();
          const checkInTimeStr = `${now.toDateString().substring(4, 10)}, ${now.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}`;
          setShiftData(prev => ({
              ...prev,
              checkIn: checkInTimeStr,
              checkOut: "Not set", // When checking in, checkout is reset
              todayStatus: "Active",
          }));
      }
      setIsUserOnDuty(!isUserOnDuty);
  };
  
  // Conditionally set shift button and status text/icon
  const shiftButtonText = isUserOnDuty ? "Check Out - End Shift" : "Check In - Start New Shift";
  const shiftButtonColor = isUserOnDuty ? styles.endShiftButton : styles.startShiftButton;
  const shiftStatusText = isUserOnDuty ? "On Duty" : "Off Duty";
  const shiftStatusIcon = isUserOnDuty ? (
      <Feather name="check-circle" size={20} color="#00C853" /> // Green check for On Duty
  ) : (
      <Feather name="x-circle" size={20} color="#DC3545" /> // Red X for Off Duty
  );

  return (
    // The ScrollView ensures the content can be scrolled
    <ScrollView contentContainerStyle={styles.container}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        {/* Profile Image/Icon */}
        <View style={styles.avatarContainer}>
            <Feather name="user" size={60} color="#011F5B" />
        </View>
        
        {/* Name and Details */}
        <Text style={styles.name}>{profileData.name}</Text>
        <View style={styles.detailRow}>
            <FontAwesome5 name="suitcase" size={12} color="#011F5B" />
            <Text style={styles.title}>{profileData.title}</Text>
        </View>
        <View style={styles.detailRow}>
            <MaterialIcons name="email" size={14} color="#011F5B" />
            <Text style={styles.email}>{profileData.email}</Text>
        </View>
      </View>

      {/* My Tasks Card */}
      <TouchableOpacity
        style={styles.tasksCard}
        onPress={() => navigation.navigate('TaskScreen')} // Placeholder: Navigate to TaskScreen
      >
        <View style={styles.tasksHeaderContainer}>
            <MaterialIcons name="assignment" size={24} color={styles.tasksHeader.color} />
            <Text style={styles.tasksHeader}>My Tasks</Text>
            <Feather name="chevron-right" size={20} color={styles.tasksHeader.color} style={styles.tasksArrow} />
        </View>
        <View style={styles.taskStatsRow}>
          <View style={[styles.taskStat, styles.taskStatPending]}>
            <Text style={[styles.taskStatNumber, styles.pendingNumber]}>{profileData.pendingTasks}</Text>
            <Text style={[styles.taskStatLabel, styles.pendingLabel]}>Pending</Text>
          </View>
          <View style={[styles.taskStat, styles.taskStatActive]}>
            <Text style={[styles.taskStatNumber, styles.activeNumber]}>{profileData.activeTasks}</Text>
            <Text style={[styles.taskStatLabel, styles.activeLabel]}>Active</Text>
          </View>
          <View style={[styles.taskStat, styles.taskStatTotal]}>
            <Text style={[styles.taskStatNumber, styles.totalNumber]}>{profileData.totalTasks}</Text>
            <Text style={[styles.taskStatLabel, styles.totalLabel]}>Total</Text>
          </View>
        </View>
      </TouchableOpacity>
      
      {/* Shift Status Card */}
      <View style={styles.shiftStatusCard}>
        <View style={[styles.shiftDetailRow, styles.noBorderBottom]}>
            <Text style={styles.shiftDetailLabel}>Shift Status</Text>
            <View style={styles.shiftStatusValueContainer}>
                {shiftStatusIcon}
                <Text style={styles.shiftStatusText}>{shiftStatusText}</Text>
            </View>
        </View>
        <View style={styles.shiftDetailRow}>
            <Text style={styles.shiftDetailLabel}>Check In</Text>
            <Text style={styles.shiftDetailValue}>{shiftData.checkIn}</Text>
        </View>
        <View style={styles.shiftDetailRow}>
            <Text style={styles.shiftDetailLabel}>Check Out</Text>
            <Text style={styles.shiftDetailValue}>{shiftData.checkOut}</Text>
        </View>
        <View style={styles.shiftDetailRow}>
            <Text style={styles.shiftDetailLabel}>Duration</Text>
            <Text style={styles.shiftDetailValue}>{shiftData.duration}</Text>
        </View>

        {/* Shift Action Button */}
        <TouchableOpacity 
            style={[styles.shiftActionButton, shiftButtonColor]} 
            onPress={toggleDutyStatus}
        >
            <Feather name="clock" size={20} color="#FFFFFF" style={{marginRight: 8}} />
            <Text style={styles.shiftActionButtonText}>{shiftButtonText}</Text>
        </TouchableOpacity>
      </View>

      {/* Today's Activity Card */}
      <View style={styles.activityCard}>
          <Text style={styles.activityHeader}>Today's Activity</Text>
          <View style={styles.activityStatsRow}>
              <View style={styles.activityStatBox}>
                  <Text style={styles.activityStatNumber}>{shiftData.todayShifts}</Text>
                  <Text style={styles.activityStatLabel}>Shifts</Text>
              </View>
              <View style={styles.activityStatBox}>
                  <Text style={styles.activityStatNumber}>{shiftData.todayStatus}</Text>
                  <Text style={styles.activityStatLabel}>Status</Text>
              </View>
          </View>
      </View>
      
      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton}>
          <Feather name="log-out" size={20} color={styles.logoutButtonText.color} style={{marginRight: 8}} />
          <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>

      {/* Reminder Box */}
      <View style={styles.reminderBox}>
          <Text style={styles.reminderText}>Remember to check out at the end of your shift</Text>
      </View>
    </ScrollView>
  );
};

export default ProfileScreen;