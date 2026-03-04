import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, radius, shadows } from "../../styles/CommanderTheme";
import commanderApi from "../../services/commanderApi";

// Backend role constraint (professionals table)
const ROLE_OPTIONS = [
  "MERT Member",
  "Commander",
  "Medical Officer",
  "Staging Officer",
  "Triage Officer",
  "Treatment Officer",
  "Transport Officer",
];

// All backend-allowed roles for registration (auth.js isIn)
const ADD_USER_ROLES = ROLE_OPTIONS;

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default function CommanderUsersScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all"); // 'all' | 'MERT Member' | 'commanders'
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [addUserVisible, setAddUserVisible] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    role: "MERT Member",
  });
  const [addUserErrors, setAddUserErrors] = useState({});
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserSuccess, setAddUserSuccess] = useState(false);
  const [addUserRoleDropdownOpen, setAddUserRoleDropdownOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await commanderApi.getProfessionals();
      setUsers(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn("Users load error:", e);
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filtered = users.filter((u) => {
    const matchSearch =
      !search.trim() ||
      (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase());
    const matchRole =
      selectedRoleFilter === "all" ||
      (selectedRoleFilter === "commanders"
        ? (u.role === "Commander" || u.role === "Medical Officer")
        : u.role === selectedRoleFilter);
    return matchSearch && matchRole;
  });

  const roleCounts = {
    all: users.length,
    "MERT Member": users.filter((p) => p.role === "MERT Member").length,
    commanders: users.filter((p) => p.role === "Commander" || p.role === "Medical Officer").length,
    "Medical Officer": users.filter((p) => p.role === "Medical Officer").length,
    "Staging Officer": users.filter((p) => p.role === "Staging Officer").length,
    "Triage Officer": users.filter((p) => p.role === "Triage Officer").length,
    "Treatment Officer": users.filter((p) => p.role === "Treatment Officer").length,
    "Transport Officer": users.filter((p) => p.role === "Transport Officer").length,
    Commander: users.filter((p) => p.role === "Commander").length,
  };

  const filterBlocks = [
    { value: "all", label: "All Users", count: roleCounts.all },
    { value: "MERT Member", label: "MERT Members", count: roleCounts["MERT Member"] },
    { value: "commanders", label: "Commanders", count: roleCounts.commanders },
    { value: "Medical Officer", label: "Medical Officer", count: roleCounts["Medical Officer"] },
    { value: "Staging Officer", label: "Staging Officer", count: roleCounts["Staging Officer"] },
    { value: "Triage Officer", label: "Triage Officer", count: roleCounts["Triage Officer"] },
    { value: "Treatment Officer", label: "Treatment Officer", count: roleCounts["Treatment Officer"] },
    { value: "Transport Officer", label: "Transport Officer", count: roleCounts["Transport Officer"] },
  ];

  const openDetail = (user) => {
    setSelectedUser(user);
    setDetailVisible(true);
  };

  const validateAddUser = () => {
    const err = {};
    if (!addUserForm.name.trim()) err.name = "Name is required";
    else if (addUserForm.name.trim().length < 2) err.name = "Name must be at least 2 characters";
    if (!addUserForm.email.trim()) err.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addUserForm.email.trim())) err.email = "Valid email required";
    if (!addUserForm.password) err.password = "Password is required";
    else if (addUserForm.password.length < 12) err.password = "At least 12 characters";
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(addUserForm.password))
      err.password = "Include upper, lower, number, and special character";
    if (addUserForm.password !== addUserForm.confirmPassword) err.confirmPassword = "Passwords must match";
    setAddUserErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleAddUser = async () => {
    if (!validateAddUser()) return;
    setAddUserLoading(true);
    setAddUserErrors({});
    try {
      await commanderApi.registerUser(
        addUserForm.name.trim(),
        addUserForm.email.trim(),
        addUserForm.password,
        addUserForm.phoneNumber.trim() || undefined,
        addUserForm.role
      );
      setAddUserSuccess(true);
      await load();
      setTimeout(() => {
        setAddUserSuccess(false);
        setAddUserVisible(false);
        setAddUserForm({ name: "", email: "", phoneNumber: "", password: "", confirmPassword: "", role: "MERT Member" });
      }, 1500);
    } catch (e) {
      const res = e.response || {};
      const msg =
        res.message ||
        (Array.isArray(res.errors) && res.errors[0]?.msg) ||
        e.message ||
        "Registration failed";
      setAddUserErrors({ submit: msg });
    } finally {
      setAddUserLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.pennBlue} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.pennBlue]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Role filter blocks – horizontal scroll */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.filterRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRowContent}
        >
          {filterBlocks.map(({ value, label, count }) => (
            <TouchableOpacity
              key={value}
              style={[styles.filterCard, selectedRoleFilter === value && styles.filterCardActive]}
              onPress={() => setSelectedRoleFilter(value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterLabel, selectedRoleFilter === value && styles.filterLabelActive]} numberOfLines={1}>{label}</Text>
              <Text style={[styles.filterCount, selectedRoleFilter === value && styles.filterCountActive]}>{count}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Search + Add User */}
      <Animated.View entering={FadeInDown.duration(400).delay(60)} style={styles.toolbar}>
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
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setAddUserErrors({});
            setAddUserSuccess(false);
            setAddUserForm({ name: "", email: "", phoneNumber: "", password: "", confirmPassword: "", role: "MERT Member" });
            setAddUserVisible(true);
          }}
          activeOpacity={0.7}
        >
          <Feather name="user-plus" size={18} color="#fff" />
          <Text style={styles.addButtonText}>Add User</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* User list */}
      <View style={styles.list}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="users" size={40} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No users match your filters.</Text>
          </View>
        ) : (
          filtered.map((item, i) => (
            <Animated.View key={item.professionalId || item.email} entering={FadeInDown.duration(300).delay(80 + i * 30)}>
              <TouchableOpacity
                style={styles.userCard}
                onPress={() => openDetail(item)}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.name || "—"}</Text>
                  <Text style={styles.userEmail}>{item.email || "—"}</Text>
                  <View style={styles.badgeWrap}>
                    <Text style={styles.badge}>{item.role || "MERT Member"}</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </Animated.View>
          ))
        )}
      </View>

      {/* Detail modal */}
      <Modal visible={detailVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedUser && (
                <>
                  <View style={styles.modalHeader}>
                    <View style={styles.avatarLarge}>
                      <Text style={styles.avatarText}>{getInitials(selectedUser.name)}</Text>
                    </View>
                    <Text style={styles.modalTitle}>{selectedUser.name}</Text>
                    <Text style={styles.modalSubtitle}>{selectedUser.email}</Text>
                  </View>
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionLabel}>Contact</Text>
                    <Text style={styles.detailRow}>Phone: {selectedUser.phoneNumber || "—"}</Text>
                  </View>
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionLabel}>Role</Text>
                    <Text style={styles.detailRole}>{selectedUser.role || "MERT Member"}</Text>
                  </View>
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionLabel}>Assignment (events)</Text>
                    <Text style={styles.detailRow}>Group: {selectedUser.groupId || "—"}</Text>
                    <Text style={styles.detailRow}>Current event: {selectedUser.currentEventId || "—"}</Text>
                    <Text style={styles.detailRow}>Current camp: {selectedUser.currentCampId || "—"}</Text>
                  </View>
                  <View style={styles.modalSection}>
                    <Text style={styles.detailRow}>Created: {formatDate(selectedUser.createdAt)}</Text>
                    <Text style={styles.detailRow}>Updated: {formatDate(selectedUser.updatedAt)}</Text>
                  </View>
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.btnSecondary} onPress={() => setDetailVisible(false)}>
                      <Text style={styles.btnSecondaryText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add user modal */}
      <Modal visible={addUserVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Add New User</Text>
              {addUserSuccess ? (
                <View style={styles.successWrap}>
                  <Feather name="check-circle" size={48} color={colors.green} />
                  <Text style={styles.successText}>User added successfully.</Text>
                </View>
              ) : (
                <>
                  {addUserErrors.submit && (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorBannerText}>{addUserErrors.submit}</Text>
                    </View>
                  )}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Name *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Full name"
                      placeholderTextColor={colors.textSecondary}
                      value={addUserForm.name}
                      onChangeText={(v) => setAddUserForm((p) => ({ ...p, name: v }))}
                    />
                    {addUserErrors.name && <Text style={styles.fieldError}>{addUserErrors.name}</Text>}
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="email@example.com"
                      placeholderTextColor={colors.textSecondary}
                      value={addUserForm.email}
                      onChangeText={(v) => setAddUserForm((p) => ({ ...p, email: v }))}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    {addUserErrors.email && <Text style={styles.fieldError}>{addUserErrors.email}</Text>}
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone (optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="(555) 000-0000"
                      placeholderTextColor={colors.textSecondary}
                      value={addUserForm.phoneNumber}
                      onChangeText={(v) => setAddUserForm((p) => ({ ...p, phoneNumber: v }))}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Role</Text>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() => setAddUserRoleDropdownOpen(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownTriggerText}>{addUserForm.role}</Text>
                      <Feather name="chevron-down" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <Modal
                      visible={addUserRoleDropdownOpen}
                      transparent
                      animationType="fade"
                      onRequestClose={() => setAddUserRoleDropdownOpen(false)}
                    >
                      <TouchableOpacity
                        style={styles.dropdownOverlay}
                        activeOpacity={1}
                        onPress={() => setAddUserRoleDropdownOpen(false)}
                      >
                        <View style={styles.dropdownListWrap}>
                          <ScrollView
                            style={styles.dropdownScroll}
                            showsVerticalScrollIndicator={true}
                            nestedScrollEnabled={true}
                          >
                            {ADD_USER_ROLES.map((r) => (
                              <TouchableOpacity
                                key={r}
                                style={[styles.dropdownItem, addUserForm.role === r && styles.dropdownItemSelected]}
                                onPress={() => {
                                  setAddUserForm((p) => ({ ...p, role: r }));
                                  setAddUserRoleDropdownOpen(false);
                                }}
                              >
                                <Text style={[styles.dropdownItemText, addUserForm.role === r && styles.dropdownItemTextSelected]}>{r}</Text>
                                {addUserForm.role === r && <Feather name="check" size={18} color={colors.pennBlue} />}
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      </TouchableOpacity>
                    </Modal>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Password * (min 12 chars, upper, lower, number, special)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor={colors.textSecondary}
                      value={addUserForm.password}
                      onChangeText={(v) => setAddUserForm((p) => ({ ...p, password: v }))}
                      secureTextEntry
                    />
                    {addUserErrors.password && <Text style={styles.fieldError}>{addUserErrors.password}</Text>}
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Confirm password *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm password"
                      placeholderTextColor={colors.textSecondary}
                      value={addUserForm.confirmPassword}
                      onChangeText={(v) => setAddUserForm((p) => ({ ...p, confirmPassword: v }))}
                      secureTextEntry
                    />
                    {addUserErrors.confirmPassword && <Text style={styles.fieldError}>{addUserErrors.confirmPassword}</Text>}
                  </View>
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.btnSecondary} onPress={() => setAddUserVisible(false)}>
                      <Text style={styles.btnSecondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnAddUser, addUserLoading && styles.btnDisabled]}
                      onPress={handleAddUser}
                      disabled={addUserLoading}
                    >
                      {addUserLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.addButtonText}>Add User</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  filterRowWrap: { marginBottom: spacing.md },
  filterRowContent: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: 2, paddingRight: spacing.md },
  filterCard: {
    width: 120,
    backgroundColor: colors.cardBg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.card,
  },
  filterCardActive: { borderColor: colors.pennBlue, backgroundColor: colors.pennBlueLight + "20" },
  filterLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
  filterLabelActive: { color: colors.pennBlue },
  filterCount: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 4 },
  filterCountActive: { color: colors.pennBlue },
  toolbar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: colors.text },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.pennBlue,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  btnAddUser: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.pennBlue,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  list: { gap: spacing.sm },
  empty: { alignItems: "center", paddingVertical: spacing.xl * 2 },
  emptyText: { marginTop: 8, fontSize: 14, color: colors.textSecondary },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    maxHeight: "85%",
    padding: spacing.lg,
    ...shadows.cardStrong,
  },
  modalHeader: { alignItems: "center", marginBottom: spacing.lg },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.pennBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  modalSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  modalSection: { marginBottom: spacing.md },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 },
  detailRow: { fontSize: 14, color: colors.text, marginBottom: 4 },
  detailRole: { fontSize: 16, fontWeight: "600", color: colors.pennBlue, marginTop: 2 },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    minHeight: 48,
  },
  dropdownTriggerText: { fontSize: 16, color: colors.text },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  dropdownListWrap: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    maxHeight: 320,
    ...shadows.cardStrong,
  },
  dropdownScroll: { maxHeight: 320 },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dropdownItemSelected: { backgroundColor: colors.pennBlueLight + "30" },
  dropdownItemText: { fontSize: 16, color: colors.text },
  dropdownItemTextSelected: { fontWeight: "600", color: colors.pennBlue },
  modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, justifyContent: "flex-end" },
  btnSecondary: { paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  btnSecondaryText: { color: colors.text },
  btnDisabled: { opacity: 0.6 },
  inputGroup: { marginBottom: spacing.md },
  inputLabel: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  fieldError: { fontSize: 12, color: colors.red, marginTop: 4 },
  errorBanner: { backgroundColor: colors.redBg, padding: spacing.sm, borderRadius: radius.sm, marginBottom: spacing.md },
  errorBannerText: { color: colors.red, fontSize: 14 },
  successWrap: { alignItems: "center", paddingVertical: spacing.xl },
  successText: { marginTop: spacing.md, fontSize: 16, color: colors.green, fontWeight: "600" },
});
