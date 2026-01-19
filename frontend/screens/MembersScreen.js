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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import styles from "../styles/MembersScreenStyles";
import { groupAPI } from "../services/api";

const getStatusStyle = (status) => {
  switch (status) {
    case "available":
      return { bg: "#DFF6DD", text: "#155724", label: "Available Now" };
    case "on_the_way":
      return { bg: "#FFF3CD", text: "#856404", label: "On Their Way" };
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
  const status = getStatusStyle(member.status);
  return (
    <View
      style={[
        styles.card,
        member.status === "unavailable"
          ? { backgroundColor: "#e5e5e5" }
          : { backgroundColor: "#fff" },
      ]}
    >
      <View style={styles.cardLeft}>
        <View style={styles.iconBox}>{getRoleIcon(member.role)}</View>
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.name}>{member.name}</Text>
          <Text style={styles.info}>
            {member.phone} | {member.email}
          </Text>
          <View style={[styles.statusTag, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>
              {status.label}
            </Text>
          </View>
          <Text style={styles.distance}>{member.distance}</Text>
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
      const response = await groupAPI.getGroups({ include_members: true });
      if (response.success) {
        const allMembers = [];
        response.groups.forEach(group => {
          if (group.members) {
            group.members.forEach(member => {
              allMembers.push({
                id: member.professional_id,
                name: member.name,
                phone: member.phone_number || 'N/A',
                email: member.email,
                status: member.current_camp_id ? 'on_the_way' : 'available', // Simplified status
                distance: member.current_camp_id ? 'At camp' : 'Available',
                role: member.role?.toLowerCase() || 'medic',
              });
            });
          }
        });
        setMembers(allMembers);
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
    const q = query.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      getStatusStyle(m.status).label.toLowerCase().includes(q)
    );
  });

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
      </View>

      {/* search */}
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

      {/* list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MemberCard member={item} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: '#888', fontSize: 16 }}>No members found</Text>
          </View>
        }
      />
    </View>
  );
};

export default MembersScreen;
