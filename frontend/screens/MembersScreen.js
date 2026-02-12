import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import styles from "../styles/MembersScreenStyles";
import { authAPI, eventAPI } from "../services/api";

const getAvailabilityStatus = (member) => {
  if (member.current_event_id) {
    if (member.current_camp_id) {
      return { 
        status: "on_duty", 
        bg: "#E6F3FF", 
        text: "#007AFF", 
        label: "On Duty",
        event: member.current_event?.name || "Active Event"
      };
    } else {
      return { 
        status: "in_event", 
        bg: "#FFF3CD", 
        text: "#856404", 
        label: "In Event",
        event: member.current_event?.name || "Active Event"
      };
    }
  }
  return { 
    status: "available", 
    bg: "#DFF6DD", 
    text: "#155724", 
    label: "Available",
    event: null
  };
};

// Legacy function for backward compatibility
const getStatusStyle = (status) => {
  switch (status) {
    case "available":
      return { bg: "#DFF6DD", text: "#155724", label: "Available Now" };
    case "on_the_way":
    case "on_duty":
      return { bg: "#FFF3CD", text: "#856404", label: "On Their Way" };
    case "in_event":
      return { bg: "#FFF3CD", text: "#856404", label: "In Event" };
    case "unavailable":
      return { bg: "#F8D7DA", text: "#721C24", label: "Unavailable" };
    default:
      return { bg: "#EEE", text: "#000", label: "Unknown" };
  }
};

const getRoleIcon = (role) => {
  switch (role) {
    case "medic":
      return <MaterialCommunityIcons name="medical-bag" size={28} color="#990000" />;
    case "firetruck":
      return <MaterialCommunityIcons name="fire-truck" size={28} color="#990000" />;
    case "operator":
      return <Ionicons name="call" size={26} color="#990000" />;
    default:
      return <MaterialCommunityIcons name="account" size={28} color="#990000" />;
  }
};

const MemberCard = ({ member }) => {
  if (!member) {
    console.log('MemberCard: member is null');
    return null;
  }
  
  const availability = getAvailabilityStatus(member);
  console.log('MemberCard - member.name:', member.name, 'member.role:', member.role, 'member.email:', member.email);
  console.log('MemberCard - full member object:', JSON.stringify(member, null, 2));
  
  return (
    <View style={{
      backgroundColor: "#fff",
      borderRadius: 12,
      padding: 15,
      marginBottom: 15,
      marginHorizontal: 0,
      minHeight: 100,
    }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{
          width: 45,
          height: 45,
          borderRadius: 8,
          backgroundColor: "#F1F1F1",
          justifyContent: "center",
          alignItems: "center",
          marginRight: 10,
        }}>
          <MaterialCommunityIcons 
            name="account" 
            size={28} 
            color="#011F5B" 
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#000000', marginBottom: 4 }}>
            {String(member.name || 'Unknown')}
          </Text>
          <Text style={{ fontSize: 13, color: '#333333', marginBottom: 2 }}>
            {String(member.role || 'MERT Member')}
          </Text>
          <Text style={{ fontSize: 13, color: '#333333', marginBottom: 2 }}>
            {String(member.phone_number || 'N/A')} | {String(member.email || 'No email')}
          </Text>
          <View style={{
            alignSelf: "flex-start",
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 4,
            marginTop: 6,
            backgroundColor: availability.bg,
          }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: availability.text }}>
              {availability.label}
            </Text>
          </View>
          {availability.event && (
            <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="event" size={14} color="#011F5B" />
              <Text style={{ fontSize: 12, color: "#011F5B", marginLeft: 4 }}>
                {availability.event}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const MembersScreen = () => {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMembers = async () => {
    try {
      // Get current event first
      const currentEventResponse = await eventAPI.getCurrentEvent();
      console.log('Current event response:', currentEventResponse);
      
      if (!currentEventResponse.success || !currentEventResponse.event) {
        console.log('No current event found');
        setMembers([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const currentEvent = currentEventResponse.event;
      const eventId = currentEvent.event_id;
      console.log('Current event ID:', eventId);

      // Get all professionals who are in this event
      const response = await authAPI.getProfessionals();
      console.log('Professionals API response:', response);
      
      if (response.success && response.professionals) {
        // Filter to only show professionals in the current event
        const eventMembers = response.professionals.filter(
          p => p.current_event_id === eventId
        );
        
        console.log('Event members found:', eventMembers.length);
        console.log('Event members:', eventMembers);

        // Map members with event info
        const membersWithEvents = eventMembers.map(prof => ({
          ...prof,
          current_event: {
            name: currentEvent.name,
            status: currentEvent.status
          }
        }));

        console.log('Final members to display:', membersWithEvents.length);
        setMembers(membersWithEvents);
      } else {
        console.log('No professionals found or response failed:', response);
        setMembers([]);
      }
    } catch (error) {
      console.error('Error loading members:', error);
      Alert.alert("Error", "Failed to load members.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadMembers();
  };

  const filtered = members.filter((m) => {
    if (!m) return false;
    const q = query.toLowerCase();
    const availability = getAvailabilityStatus(m);
    return (
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.role && m.role.toLowerCase().includes(q)) ||
      (availability.label && availability.label.toLowerCase().includes(q)) ||
      (availability.event && availability.event.toLowerCase().includes(q))
    );
  });

  console.log('Filtered members count:', filtered.length);
  console.log('Members array:', members);
  console.log('Query:', query);
  console.log('Filtered array:', filtered);

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#011F5B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* title */}
      <View style={styles.titleBox}>
        <Text style={styles.title}>Team Members ({members.length})</Text>
        {members.length === 0 && !loading && (
          <Text style={{ color: '#888', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 }}>
            No members found in current event. Join an event to see team members.
          </Text>
        )}
      </View>

      {/* search */}
      {members.length > 0 && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={22} color="#fff" style={{ marginLeft: 12 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search for members..."
            placeholderTextColor="#D9E1F2"
            style={styles.searchInput}
          />
          <Ionicons name="filter-outline" size={22} color="#fff" style={{ marginRight: 12 }} />
        </View>
      )}

      {/* list */}
      {filtered.length > 0 ? (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => {
            const key = item?.professional_id || item?.id || `member-${index}`;
            return key;
          }}
          renderItem={({ item, index }) => {
            console.log(`FlatList renderItem ${index}:`, item?.name);
            if (!item) {
              return (
                <View style={{ padding: 20, backgroundColor: '#fff', marginBottom: 15 }}>
                  <Text style={{ color: '#000' }}>No item at index {index}</Text>
                </View>
              );
            }
            return <MemberCard member={item} />;
          }}
          style={{ flex: 1 }}
          contentContainerStyle={{ 
            paddingBottom: 100
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : (
        <View style={{ padding: 40, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <Text style={{ color: '#888', fontSize: 16, marginBottom: 8 }}>
            {query ? 'No members match your search' : 'No members in current event'}
          </Text>
          {!query && (
            <Text style={{ color: '#888', fontSize: 14, textAlign: 'center' }}>
              Make sure you've joined an event to see team members.
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

export default MembersScreen;
