import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing } from "../../styles/CommanderTheme";
import commanderApi from "../../services/commanderApi";

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function CommanderUsersScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await commanderApi.getProfessionals();
      setUsers(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn("Users load error:", e);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = search.trim()
    ? users.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
          (u.email || "").toLowerCase().includes(search.toLowerCase())
      )
    : users;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.pennBlue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <Feather name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email"
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.professionalId || item.id || item.email || String(Math.random())}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="users" size={40} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.name || "—"}</Text>
              <Text style={styles.userEmail}>{item.email || "—"}</Text>
              <View style={styles.badgeWrap}>
                <Text style={styles.badge}>{item.role || "Member"}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: colors.text },
  list: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  empty: { alignItems: "center", paddingVertical: spacing.xl * 2 },
  emptyText: { marginTop: 8, fontSize: 14, color: colors.textSecondary },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pennBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  userInfo: { flex: 1, marginLeft: spacing.md },
  userName: { fontSize: 16, fontWeight: "600", color: colors.text },
  userEmail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  badgeWrap: { marginTop: 4 },
  badge: { fontSize: 12, color: colors.pennBlue, fontWeight: "500" },
});
