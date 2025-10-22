import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import styles from "../styles/MembersScreenStyles";

const mockMembers = [
  {
    id: "1",
    name: "Angie Cao",
    phone: "503-222-2222",
    email: "angiecao@seas.upenn.edu",
    status: "available",
    distance: "0.2 mi away",
    role: "medic",
  },
  {
    id: "2",
    name: "Emily Kang",
    phone: "443-467-7759",
    email: "emkang@seas.upenn.edu",
    status: "on_the_way",
    distance: "1.5 mi away",
    role: "operator",
  },
  {
    id: "3",
    name: "Katherine Yue",
    phone: "498-230-4938",
    email: "kyue@seas.upenn.edu",
    status: "available",
    distance: "0.4 mi away",
    role: "firetruck",
  },
  {
    id: "4",
    name: "Luna Chen",
    phone: "213-667-9254",
    email: "lchen@seas.upenn.edu",
    status: "unavailable",
    distance: "--",
    role: "medic",
  },
  {
    id: "5",
    name: "Maya Huizer",
    phone: "676-667-6767",
    email: "maya@seas.upenn.edu",
    status: "unavailable",
    distance: "--",
    role: "medic",
  },
];

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

  const filtered = mockMembers.filter((m) => {
    const q = query.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      getStatusStyle(m.status).label.toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      {/* title */}
      <View style={styles.titleBox}>
        <Text style={styles.title}>Casualty #2 Members</Text>
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
      />
    </View>
  );
};

export default MembersScreen;
