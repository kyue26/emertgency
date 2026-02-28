import React, { useState, useEffect, useContext } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput } from "react-native";
import { FontAwesome5, MaterialIcons, Feather } from '@expo/vector-icons'; // Assuming you use expo vector icons or similar
import styles from "../styles/ProfileScreenStyles";
import { getStoredUser, authAPI, taskAPI, eventAPI, shiftAPI } from "../services/api";
import { AuthContext } from "../context/AuthContext";

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
    currentShift: null,
    totalShifts: 0,
    totalHours: 0,
    shifts: [],
  });
  const [shiftLoading, setShiftLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [isJoiningEvent, setIsJoiningEvent] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);

  useEffect(() => {
    loadUserData();
    loadTaskStats();
    loadCurrentEvent();
  }, []);

  useEffect(() => {
    if (currentEvent) {
      loadShiftData();
    }
  }, [currentEvent]);

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

  const loadCurrentEvent = async () => {
    try {
      const response = await eventAPI.getCurrentEvent();
      if (response.success) {
        setCurrentEvent(response.event);
      } else {
        setCurrentEvent(null);
      }
    } catch (error) {
      console.error("Error loading current event:", error);
      setCurrentEvent(null);
    }
  };

  const loadShiftData = async () => {
    try {
      const response = await shiftAPI.getMyShifts();
      if (response.success) {
        setIsUserOnDuty(response.is_on_duty);
        setShiftData({
          currentShift: response.current_shift,
          totalShifts: response.total_shifts,
          totalHours: response.total_hours,
          shifts: response.shifts,
        });
      }
    } catch (error) {
      console.error("Error loading shift data:", error);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "—";
    const d = new Date(timestamp);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatDuration = (hours) => {
    if (!hours || hours <= 0) return "0h 0m";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const handleToggleEventStatus = async () => {
    if (!currentEvent) return;

    if (currentEvent.status === 'in_progress') {
      // Event is active - can finish or cancel it
      Alert.alert(
        'Deactivate Event',
        'How would you like to deactivate this event?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Finish Event',
            onPress: async () => {
              try {
                const response = await eventAPI.updateEvent(currentEvent.event_id, { status: 'finished' });
                if (response.success) {
                  Alert.alert('Success', 'Event finished successfully.');
                  await loadCurrentEvent();
                } else {
                  Alert.alert('Error', response.message || 'Failed to finish event.');
                }
              } catch (error) {
                console.error('Error finishing event:', error);
                Alert.alert('Error', 'Failed to finish event. Please try again.');
              }
            }
          },
          {
            text: 'Cancel Event',
            style: 'destructive',
            onPress: async () => {
              try {
                const response = await eventAPI.updateEvent(currentEvent.event_id, { status: 'cancelled' });
                if (response.success) {
                  Alert.alert('Success', 'Event cancelled successfully.');
                  await loadCurrentEvent();
                } else {
                  Alert.alert('Error', response.message || 'Failed to cancel event.');
                }
              } catch (error) {
                console.error('Error cancelling event:', error);
                Alert.alert('Error', 'Failed to cancel event. Please try again.');
              }
            }
          }
        ]
      );
    } else if (currentEvent.status === 'upcoming') {
      // Event is upcoming - can activate it
      Alert.alert(
        'Activate Event',
        'Are you sure you want to activate this event?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Activate',
            onPress: async () => {
              try {
                const response = await eventAPI.updateEvent(currentEvent.event_id, { status: 'in_progress' });
                if (response.success) {
                  Alert.alert('Success', 'Event activated successfully.');
                  await loadCurrentEvent();
                } else {
                  Alert.alert('Error', response.message || 'Failed to activate event.');
                }
              } catch (error) {
                console.error('Error activating event:', error);
                Alert.alert('Error', 'Failed to activate event. Please try again.');
              }
            }
          }
        ]
      );
    } else {
      // Event is finished or cancelled - cannot change
      Alert.alert(
        'Event Status',
        `This event is ${currentEvent.status === 'finished' ? 'finished' : 'cancelled'} and cannot be changed.`
      );
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

  const toggleDutyStatus = async () => {
    try {
      setShiftLoading(true);
      if (isUserOnDuty) {
        const response = await shiftAPI.checkOut();
        if (response.success) {
          await loadShiftData();
        } else {
          Alert.alert("Error", response.message || "Failed to check out.");
        }
      } else {
        const response = await shiftAPI.checkIn();
        if (response.success) {
          await loadShiftData();
        } else {
          Alert.alert("Error", response.message || "Failed to check in.");
        }
      }
    } catch (error) {
      console.error("Shift toggle error:", error);
      Alert.alert("Error", error.message || "Failed to update shift status.");
    } finally {
      setShiftLoading(false);
    }
  };
  
  const handleOpenCreateEvent = () => {
    setNewEventName("");
    setNewEventLocation("");
    setCreateModalVisible(true);
  };

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) {
      Alert.alert("Error", "Event name is required.");
      return;
    }

    try {
      setIsCreatingEvent(true);
      const eventData = {
        name: newEventName.trim(),
      };
      if (newEventLocation.trim()) {
        eventData.location = newEventLocation.trim();
      }

      const response = await eventAPI.createEvent(eventData);

      if (response.success && response.event) {
        const invite = response.event.invite_code || "N/A";
        Alert.alert(
          "Event Created",
          `Event "${response.event.name}" created.\nInvite code: ${invite}`
        );
        // Reload current event to show it in the UI
        await loadCurrentEvent();
      } else {
        Alert.alert(
          "Error",
          response.message || "Failed to create event. Please try again."
        );
      }
    } catch (error) {
      console.error("Create event error:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to create event. Please try again."
      );
    } finally {
      setIsCreatingEvent(false);
      setCreateModalVisible(false);
    }
  };

  const handleJoinEvent = async () => {
    if (!inviteCodeInput.trim()) {
      Alert.alert("Error", "Invite code is required.");
      return;
    }

    try {
      setIsJoiningEvent(true);
      const response = await eventAPI.joinEvent(inviteCodeInput.trim());

      if (response.success) {
        Alert.alert("Success", response.message || "Joined event successfully.");
        // Reload current event to show it in the UI
        await loadCurrentEvent();
      } else {
        Alert.alert(
          "Error",
          response.message || "Failed to join event. Please try again."
        );
      }
    } catch (error) {
      console.error("Join event error:", error);
      const message =
        (error.response && error.response.message) ||
        error.message ||
        "Failed to join event. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setIsJoiningEvent(false);
      setJoinModalVisible(false);
      setInviteCodeInput("");
    }
  };

  const handleLeaveEvent = async () => {
    Alert.alert(
      "Leave Event",
      `Are you sure you want to leave "${currentEvent?.name || 'this event'}"?`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await eventAPI.leaveEvent();
              if (response.success) {
                Alert.alert("Success", response.message || "Left event successfully.");
                // Clear current event
                setCurrentEvent(null);
              } else {
                Alert.alert("Error", response.message || "Failed to leave event.");
              }
            } catch (error) {
              console.error("Leave event error:", error);
              const message =
                (error.response && error.response.message) ||
                error.message ||
                "Failed to leave event. Please try again.";
              Alert.alert("Error", message);
            }
          }
        }
      ]
    );
  };
  
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
        
        {/* Current Event - in the middle */}
        {currentEvent ? (
          <View style={{ marginTop: 16, marginBottom: 0, paddingTop: 16, paddingBottom: 0, borderTopWidth: 1, borderBottomWidth: 0, borderColor: '#E0E0E0', width: '100%' }}>
            <View style={[styles.detailRow, { marginBottom: 4 }]}>
              <MaterialIcons name="event" size={16} color="#011F5B" />
              <Text style={[styles.title, { fontWeight: '700', fontSize: 16, marginLeft: 8 }]}>
                {currentEvent.name || "Current Event"}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 24 }}>
              <Text style={{ fontSize: 13, color: '#011F5B', marginRight: 8, fontWeight: '500' }}>Status:</Text>
              <View style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 4,
                backgroundColor: currentEvent.status === 'in_progress' ? '#22c55e' : currentEvent.status === 'finished' ? '#6b7280' : '#eab308',
              }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFF', textTransform: 'capitalize' }}>
                  {currentEvent.status === 'in_progress' ? 'Active' : currentEvent.status === 'finished' ? 'Finished' : currentEvent.status === 'upcoming' ? 'Upcoming' : currentEvent.status}
                </Text>
              </View>
            </View>
            {user.role === "Commander" && currentEvent.invite_code && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 24 }}>
                <Text style={{ fontSize: 13, color: '#011F5B', marginRight: 8, fontWeight: '500' }}>Invite Code:</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#011F5B', letterSpacing: 2 }}>
                  {currentEvent.invite_code}
                </Text>
              </View>
            )}
            {user.role === "Commander" && (currentEvent.status === 'in_progress' || currentEvent.status === 'upcoming') && (
              <TouchableOpacity
                style={{
                  marginTop: 12,
                  padding: 8,
                  borderRadius: 6,
                  backgroundColor: currentEvent.status === 'in_progress' ? '#FFF' : '#22c55e',
                  borderWidth: 1,
                  borderColor: currentEvent.status === 'in_progress' ? '#ef4444' : '#22c55e',
                  alignItems: 'center'
                }}
                onPress={handleToggleEventStatus}
              >
                <Text style={{ 
                  color: currentEvent.status === 'in_progress' ? '#ef4444' : '#FFF', 
                  fontSize: 14, 
                  fontWeight: '600' 
                }}>
                  {currentEvent.status === 'in_progress' ? 'Deactivate Event' : 'Activate Event'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{
                marginTop: 12,
                padding: 8,
                borderRadius: 6,
                backgroundColor: '#FFF',
                borderWidth: 1,
                borderColor: '#DC3545',
                alignItems: 'center'
              }}
              onPress={handleLeaveEvent}
            >
              <Text style={{ color: '#DC3545', fontSize: 14, fontWeight: '600' }}>Leave Event</Text>
            </TouchableOpacity>
          </View>
        ) : null}

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
      
      {/* Event Access Card */}
      <View style={styles.tasksCard}>
        <View style={styles.tasksHeaderContainer}>
          <MaterialIcons name="event" size={24} color={styles.tasksHeader.color} />
          <Text style={styles.tasksHeader}>Event Access</Text>
        </View>

        {user.role === "Commander" && (
          <View style={{ marginTop: -2 }}>
            <Text style={{ color: "#011F5B", marginBottom: 8 }}>
              As a commander, you can create events and share invite codes with your team.
            </Text>
            <TouchableOpacity
              style={[
                styles.shiftActionButton, 
                { 
                  marginTop: 4,
                  marginBottom: 16,
                  backgroundColor: '#011F5B', // Primary dark blue
                  opacity: isCreatingEvent ? 0.6 : 1
                }
              ]}
              onPress={handleOpenCreateEvent}
              disabled={isCreatingEvent}
            >
              <Feather
                name="plus-circle"
                size={20}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.shiftActionButtonText}>
                {isCreatingEvent ? "Creating..." : "Create New Event"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ marginTop: 0 }}>
          <Text style={{ color: "#011F5B", marginBottom: 8 }}>
            Join an event using an invite code:
          </Text>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => setJoinModalVisible(true)}
            disabled={isJoiningEvent}
          >
            <Feather
              name="key"
              size={20}
              color={styles.logoutButtonText.color}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.logoutButtonText}>
              {isJoiningEvent ? "Joining..." : "Join Event"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {currentEvent ? (
        <>
          {/* Shift Status Card */}
          <View style={styles.shiftStatusCard}>
            <View style={[styles.shiftDetailRow, styles.noBorderBottom]}>
              <Text style={styles.shiftDetailLabel}>Shift Status</Text>
              <View style={styles.shiftStatusValueContainer}>
                {isUserOnDuty ? (
                  <Feather name="check-circle" size={20} color="#00C853" />
                ) : (
                  <Feather name="x-circle" size={20} color="#DC3545" />
                )}
                <Text style={styles.shiftStatusText}>{isUserOnDuty ? "On Duty" : "Off Duty"}</Text>
              </View>
            </View>
            <View style={styles.shiftDetailRow}>
              <Text style={styles.shiftDetailLabel}>Check In</Text>
              <Text style={styles.shiftDetailValue}>
                {shiftData.currentShift ? formatTime(shiftData.currentShift.check_in) : "—"}
              </Text>
            </View>
            <View style={styles.shiftDetailRow}>
              <Text style={styles.shiftDetailLabel}>Check Out</Text>
              <Text style={styles.shiftDetailValue}>
                {shiftData.currentShift?.check_out ? formatTime(shiftData.currentShift.check_out) : "—"}
              </Text>
            </View>
            <View style={styles.shiftDetailRow}>
              <Text style={styles.shiftDetailLabel}>Duration</Text>
              <Text style={styles.shiftDetailValue}>
                {shiftData.currentShift ? formatDuration(shiftData.currentShift.duration_hours) : "—"}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.shiftActionButton, isUserOnDuty ? styles.endShiftButton : styles.startShiftButton]}
              onPress={toggleDutyStatus}
              disabled={shiftLoading}
            >
              <Feather name="clock" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.shiftActionButtonText}>
                {shiftLoading ? "Updating..." : isUserOnDuty ? "Check Out - End Shift" : "Check In - Start New Shift"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Event Shift Summary */}
          <View style={styles.activityCard}>
            <Text style={styles.activityHeader}>Event Shift Summary</Text>
            <View style={styles.activityStatsRow}>
              <View style={styles.activityStatBox}>
                <Text style={styles.activityStatNumber}>{shiftData.totalShifts}</Text>
                <Text style={styles.activityStatLabel}>Total Shifts</Text>
              </View>
              <View style={styles.activityStatBox}>
                <Text style={styles.activityStatNumber}>{formatDuration(shiftData.totalHours)}</Text>
                <Text style={styles.activityStatLabel}>Total Hours</Text>
              </View>
            </View>
          </View>

          {/* Shift History */}
          {shiftData.shifts.length > 0 && (
            <View style={styles.activityCard}>
              <Text style={styles.activityHeader}>Shift History</Text>
              {shiftData.shifts.map((shift) => (
                <View key={shift.shift_id} style={[styles.shiftDetailRow, { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 10 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#011F5B' }}>
                      {formatTime(shift.check_in)}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: shift.check_out ? '#011F5B' : '#00C853',
                      backgroundColor: shift.check_out ? '#F0F0F0' : '#E8F5E9',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 4,
                    }}>
                      {shift.check_out ? formatDuration(shift.duration_hours) : "In progress"}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, color: '#666' }}>
                    {shift.check_out ? `Out: ${formatTime(shift.check_out)}` : "Currently on duty"}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Reminder Box */}
          {isUserOnDuty && (
            <View style={styles.reminderBox}>
              <Text style={styles.reminderText}>Remember to check out at the end of your shift</Text>
            </View>
          )}
        </>
      ) : null}

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogoutPress}>
        <Feather name="log-out" size={20} color={styles.logoutButtonText.color} style={{ marginRight: 8 }} />
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>

      {/* Create Event Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View
          style={
            styles.modalOverlay || {
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.4)",
            }
          }
        >
          <View
            style={
              styles.modalContent || {
                backgroundColor: "#FFFFFF",
                padding: 20,
                borderRadius: 12,
                width: "85%",
              }
            }
          >
            <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>
              Create Event
            </Text>
            <TextInput
              placeholder="Event name"
              value={newEventName}
              onChangeText={setNewEventName}
              style={
                styles.input || {
                  borderWidth: 1,
                  borderColor: "#CCC",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 10,
                }
              }
            />
            <TextInput
              placeholder="Location (optional)"
              value={newEventLocation}
              onChangeText={setNewEventLocation}
              style={
                styles.input || {
                  borderWidth: 1,
                  borderColor: "#CCC",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 20,
                }
              }
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
              <TouchableOpacity
                onPress={() => setCreateModalVisible(false)}
                style={{ marginRight: 16 }}
              >
                <Text style={{ color: "#777" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateEvent} disabled={isCreatingEvent}>
                <Text style={{ color: "#011F5B", fontWeight: "600" }}>
                  {isCreatingEvent ? "Creating..." : "Create"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join Event Modal */}
      <Modal
        visible={joinModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View
          style={
            styles.modalOverlay || {
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.4)",
            }
          }
        >
          <View
            style={
              styles.modalContent || {
                backgroundColor: "#FFFFFF",
                padding: 20,
                borderRadius: 12,
                width: "85%",
              }
            }
          >
            <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>
              Join Event
            </Text>
            <TextInput
              placeholder="Invite code"
              autoCapitalize="characters"
              value={inviteCodeInput}
              onChangeText={setInviteCodeInput}
              style={
                styles.input || {
                  borderWidth: 1,
                  borderColor: "#CCC",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 20,
                }
              }
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
              <TouchableOpacity
                onPress={() => setJoinModalVisible(false)}
                style={{ marginRight: 16 }}
              >
                <Text style={{ color: "#777" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleJoinEvent} disabled={isJoiningEvent}>
                <Text style={{ color: "#011F5B", fontWeight: "600" }}>
                  {isJoiningEvent ? "Joining..." : "Join"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default ProfileScreen;