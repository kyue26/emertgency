import React, { useState, useEffect, useContext } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { FontAwesome5, MaterialIcons, Feather } from '@expo/vector-icons'; // Assuming you use expo vector icons or similar
import styles from "../styles/ProfileScreenStyles";
import { getStoredUser, authAPI, taskAPI } from "../services/api";
import { AuthContext } from "../App";

const ProfileScreen = ({ navigation }) => {
  const { handleLogout } = useContext(AuthContext);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [taskStats, setTaskStats] = useState({
    pending: 0,
    active: 0,
    total: 0,
  });
  const [isUserOnDuty, setIsUserOnDuty] = useState(false);
  const [shiftData, setShiftData] = useState({
    checkIn: "Not set",
    checkOut: "Not set",
    duration: "0h 0m",
    todayShifts: 0,
    todayStatus: "Inactive",
  });

  // Load user data and tasks on mount
  useEffect(() => {
    loadUserData();
    loadTaskStats();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await getStoredUser();
      if (userData) {
        setUser(userData);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTaskStats = async () => {
    try {
      const response = await taskAPI.getTasks({ my_tasks: true });
      if (response.success && response.tasks) {
        const tasks = response.tasks;
        const pending = tasks.filter(t => t.status === 'pending').length;
        const active = tasks.filter(t => t.status === 'in_progress').length;
        setTaskStats({
          pending,
          active,
          total: tasks.length,
        });
      }
    } catch (error) {
      console.error("Error loading task stats:", error);
    }
  };

  const handleLogoutPress = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear user state
              setUser(null);
              // Use the logout handler from AuthContext which will update App.js state
              await handleLogout();
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          }
        }
      ]
    );
  };

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

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#011F5B" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#011F5B' }}>Unable to load user information</Text>
      </View>
    );
  }

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
        <Text style={styles.name}>{user.name || "User"}</Text>
        <View style={styles.detailRow}>
            <FontAwesome5 name="suitcase" size={12} color="#011F5B" />
            <Text style={styles.title}>{user.role || "MERT Member"}</Text>
        </View>
        <View style={styles.detailRow}>
            <MaterialIcons name="email" size={14} color="#011F5B" />
            <Text style={styles.email}>{user.email || ""}</Text>
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
            <Text style={[styles.taskStatNumber, styles.pendingNumber]}>{taskStats.pending}</Text>
            <Text style={[styles.taskStatLabel, styles.pendingLabel]}>Pending</Text>
          </View>
          <View style={[styles.taskStat, styles.taskStatActive]}>
            <Text style={[styles.taskStatNumber, styles.activeNumber]}>{taskStats.active}</Text>
            <Text style={[styles.taskStatLabel, styles.activeLabel]}>Active</Text>
          </View>
          <View style={[styles.taskStat, styles.taskStatTotal]}>
            <Text style={[styles.taskStatNumber, styles.totalNumber]}>{taskStats.total}</Text>
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
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogoutPress}>
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