import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { casualtyAPI, eventAPI } from "../services/api";
import { transformCasualties } from "../utils/casualtyTransform";

const triageConfig = {
  green: { label: "Minor", color: "#22c55e" },
  yellow: { label: "Delayed", color: "#eab308" },
  red: { label: "Immediate", color: "#ef4444" },
  black: { label: "Deceased", color: "#1f2937" },
};

export default function CasualtyListScreen({ route, navigation }) {
  const [casualties, setCasualties] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeEventId, setActiveEventId] = useState(null);

  const loadCasualties = async () => {
    try {
      // get active event first
      const eventsResponse = await eventAPI.getEvents({ status: 'in_progress', limit: 1 });
      
      if (eventsResponse.success && eventsResponse.events.length > 0) {
        const event = eventsResponse.events[0];
        setActiveEventId(event.event_id);
        
        // get casualties
        const params = { event_id: event.event_id, limit: 100 };
        if (filterLevel !== 'all') {
          params.color = filterLevel;
        }
        
        const response = await casualtyAPI.getCasualties(params);
        
        if (response.success) {
          // transofrm using utility
          const transformed = transformCasualties(response.casualties);
          setCasualties(transformed);
        }
      } else {
        setCasualties([]);
      }
    } catch (error) {
      console.error('Error loading casualties:', error);
      Alert.alert("Error", "Failed to load casualties.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCasualties();
  }, [filterLevel]); // reload when filter changes

  const onRefresh = () => {
    setRefreshing(true);
    loadCasualties();
  };

  const filteredCasualties = casualties.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.injuries && c.injuries.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesSearch; // filter level is already applied in API call
  });

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#011f5b" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>All Casualties ({filteredCasualties.length})</Text>

      {/* --- SEARCH BAR --- */}
      <View style={styles.searchWrapper}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color="#888"
          style={styles.searchIcon}
        />
        <TextInput
          placeholder="Search by name or location..."
          placeholderTextColor="#999"
          value={searchTerm}
          onChangeText={setSearchTerm}
          style={styles.searchInput}
        />
      </View>

      {/* --- FILTER BAR --- */}
      <View style={styles.filterRow}>
        <MaterialCommunityIcons
          name="filter-variant"
          size={20}
          color="#666"
        />

        {/* ALL */}
        <TouchableOpacity
          onPress={() => setFilterLevel("all")}
          style={[
            styles.filterChip,
            filterLevel === "all" && styles.filterChipActive,
          ]}
        >
          <Text
            style={[
              styles.filterChipText,
              filterLevel === "all" && styles.filterChipTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {/* INDIVIDUAL TRIAGE FILTERS */}
        {Object.keys(triageConfig).map((level) => (
          <TouchableOpacity
            key={level}
            onPress={() => setFilterLevel(level)}
            style={[
              styles.filterChip,
              filterLevel === level && {
                backgroundColor: triageConfig[level].color,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                filterLevel === level && { color: "#fff" },
              ]}
            >
              {triageConfig[level].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* --- LIST --- */}
      <View style={{ marginTop: 12 }}>
        {filteredCasualties.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No casualties found</Text>
          </View>
        ) : (
          filteredCasualties.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.casualtyCard}
              onPress={() => navigation.navigate("CasualtyDetail", { casualty: c.original || c })}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.casualtyName}>{c.name}</Text>
                  {c.age && (
                    <Text style={styles.casualtyAge}> ({c.age}y)</Text>
                  )}
                </View>

                <Text style={styles.locationText}>{c.location}</Text>
                <Text style={styles.injuryText}>{c.injuries}</Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: triageConfig[c.color || c.triageLevel].color },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {triageConfig[c.color || c.triageLevel].label}
                  </Text>
                </View>

                <Text style={styles.timestampText}>
                  {formatTime(c.created_at || c.timestamp)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F4F6FA",
    padding: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#011f5b",
    marginBottom: 16,
  },

  // Search
  searchWrapper: {
    position: "relative",
    marginBottom: 12,
  },

  searchIcon: {
    position: "absolute",
    top: 14,
    left: 12,
  },

  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingLeft: 40,
    paddingRight: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#DDD",
  },

  // Filter bar
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },

  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#EEE",
    borderRadius: 20,
  },

  filterChipActive: {
    backgroundColor: "#011f5b",
  },

  filterChipText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "500",
  },

  filterChipTextActive: {
    color: "#fff",
  },

  // Casualty card
  casualtyCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 6,
    borderLeftColor: "#DDD",
  },

  casualtyName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },

  casualtyAge: {
    color: "#666",
    fontSize: 14,
  },

  locationText: {
    marginTop: 2,
    fontSize: 14,
    color: "#777",
  },

  injuryText: {
    marginTop: 6,
    fontSize: 14,
    color: "#666",
  },

  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 6,
  },

  badgeText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  timestampText: {
    fontSize: 12,
    color: "#999",
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },

  emptyText: {
    color: "#888",
    fontSize: 16,
  },
});
