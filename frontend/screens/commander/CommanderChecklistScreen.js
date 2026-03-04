import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, spacing, shadows, radius } from "../../styles/CommanderTheme";
import commanderApi, { getCommanderUser } from "../../services/commanderApi";

const ROLE_STORAGE_PREFIX = "@emertgency:role_assignments:";
const TREATMENT_COUNTS_PREFIX = "@emertgency:treatment_counts:";

// Map drill setup role keys to checklist responsibility names
const ROLE_KEY_TO_RESPONSIBILITY = {
  command: "Incident Command",
  staging: "Staging",
  triage: "Triage",
  treatment: "Treatment",
  transport: "Transport",
};

const ALL_RESPONSIBILITIES = ["Staging", "Incident Command", "Triage", "Treatment", "Transport"];

const RESPONSIBILITY_ICONS = {
  Staging: "map-pin",
  "Incident Command": "settings",
  Triage: "activity",
  Treatment: "activity",
  Transport: "truck",
};

/** Derive user responsibilities from role assignments (same source as Drill Setup). IC sees all 5; others see only their assigned role(s). */
function getResponsibilitiesFromRoleAssignments(roleAssignments, userName) {
  if (!roleAssignments) return [];
  const name = (userName || "").trim().toLowerCase();
  if (!name) return [];
  const responsibilities = [];
  for (const [roleKey, assignedName] of Object.entries(roleAssignments)) {
    const mapped = ROLE_KEY_TO_RESPONSIBILITY[roleKey];
    const assigned = (assignedName || "").trim().toLowerCase();
    if (mapped && assigned && assigned === name) {
      responsibilities.push(mapped);
    }
  }
  return responsibilities;
}

/** Check if user is Incident Commander (assigned to command). */
function isIncidentCommander(roleAssignments, userName) {
  const cmd = (roleAssignments?.command || "").trim().toLowerCase();
  const name = (userName || "").trim().toLowerCase();
  return cmd && name && cmd === name;
}

const INITIAL_TASKS = [
  { id: "staging-1", title: "Staging - All EMTs arrived?", responsibility: "Staging", completed: false },
  { id: "staging-2", title: "Triage - All triage tags back + final patient counts", responsibility: "Staging", completed: false },
  { id: "staging-3", title: "Treatment - Tarp cleared", responsibility: "Staging", completed: false },
  { id: "staging-4", title: "Transport - All patients transported", responsibility: "Staging", completed: false },
  { id: "staging-5", title: "Staging - All checked out", responsibility: "Staging", completed: false },
  { id: "cmd-1", title: "Initial Report to Radio - ICS established + incident command post location", responsibility: "Incident Command", completed: false },
  { id: "cmd-2", title: "Radio - Staging location established", responsibility: "Incident Command", completed: false },
  { id: "cmd-3", title: "Radio - Treatment location established", responsibility: "Incident Command", completed: false },
  { id: "cmd-4", title: "Radio - Transport location established", responsibility: "Incident Command", completed: false },
  { id: "cmd-5", title: "Radio - Transport bus check-in (once transport requests bus)", responsibility: "Incident Command", completed: false },
  { id: "cmd-6", title: "Radio - Drill concluded (after last patient gone + all EMTs accounted for)", responsibility: "Incident Command", completed: false },
  { id: "triage-1", title: "For 1st group remind them to get green first (yell)", responsibility: "Triage", completed: false },
];

const getTimeStr = () =>
  new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

export default function CommanderChecklistScreen() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("Staging");
  const [roleAssignments, setRoleAssignments] = useState({});
  const [allTasks, setAllTasks] = useState(INITIAL_TASKS);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [isDrillActive, setIsDrillActive] = useState(false);
  const [drillStarted, setDrillStarted] = useState(false);

  const [triageCounts, setTriageCounts] = useState({ red: 0, yellow: 0, green: 0, black: 0 });
  const [deceasedCount, setDeceasedCount] = useState(0);
  const [transportEntries, setTransportEntries] = useState({
    priority1: [],
    priority2: [],
    priority3: [],
  });
  const [newTransportTag, setNewTransportTag] = useState({ priority1: "", priority2: "", priority3: "" });
  const [treatmentTarpCounts, setTreatmentTarpCounts] = useState({
    red: { priority1: { count: 0 }, priority2: { count: 0 }, priority3: { count: 0 }, dead: { count: 0 }, lastUpdated: "" },
    yellow: { priority1: { count: 0 }, priority2: { count: 0 }, priority3: { count: 0 }, dead: { count: 0 }, lastUpdated: "" },
    green: { priority1: { count: 0 }, priority2: { count: 0 }, priority3: { count: 0 }, dead: { count: 0 }, lastUpdated: "" },
  });
  const [prioritySnapshots, setPrioritySnapshots] = useState([]);
  const [stagingRadioChecks, setStagingRadioChecks] = useState({});
  const [treatmentRadioChecks, setTreatmentRadioChecks] = useState({});
  const [transportRadioChecks, setTransportRadioChecks] = useState({});
  const [triageRadioChecks, setTriageRadioChecks] = useState({});
  const [locationDetails, setLocationDetails] = useState({
    stagingLocation: "", stagingTime: "",
    treatmentLocation: "", treatmentTime: "",
    transportLocation: "", transportTime: "",
  });
  const [newResourceInput, setNewResourceInput] = useState("");
  const [resourcesRequested, setResourcesRequested] = useState([]);
  const [agenciesOnScene, setAgenciesOnScene] = useState([
    { agency: "Penn Police", time: "" },
    { agency: "PFD", time: "" },
    { agency: "Allied", time: "" },
    { agency: "", time: "" },
  ]);
  const [triageNotes, setTriageNotes] = useState("");
  const [stagingTriageInfo, setStagingTriageInfo] = useState("");
  const [stagingTreatmentInfo, setStagingTreatmentInfo] = useState("");
  const [currentEventId, setCurrentEventId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [eventRes, userData] = await Promise.all([
        commanderApi.getCurrentEvent().catch(() => ({ success: false, event: null })),
        getCommanderUser(),
      ]);
      const u = userData || (await commanderApi.getCurrentUser().catch(() => null));
      if (u) setUser(u.professional || u);
      const event = eventRes?.event || eventRes?.data?.event || null;
      setIsDrillActive(event?.status === "in_progress");
      if (event?.event_id) {
        setCurrentEventId(event.event_id);
        try {
          let parsed = null;
          try {
            parsed = await commanderApi.getChecklistData(event.event_id);
          } catch (_) {
            const stored = await AsyncStorage.getItem(TREATMENT_COUNTS_PREFIX + event.event_id);
            parsed = stored ? JSON.parse(stored) : null;
          }
          if (parsed?.roleAssignments && Object.keys(parsed.roleAssignments).length > 0) {
            setRoleAssignments(parsed.roleAssignments);
          } else {
            const stored = await AsyncStorage.getItem(ROLE_STORAGE_PREFIX + event.event_id);
            setRoleAssignments(stored ? JSON.parse(stored) : {});
          }
          if (parsed) {
            if (parsed.treatmentTarpCounts) setTreatmentTarpCounts(parsed.treatmentTarpCounts);
            if (parsed.transportEntries) setTransportEntries(parsed.transportEntries);
            if (typeof parsed.deceasedCount === "number") setDeceasedCount(parsed.deceasedCount);
            if (parsed.triageCounts) setTriageCounts(parsed.triageCounts);
            if (parsed.resourcesRequested) setResourcesRequested(parsed.resourcesRequested);
            if (parsed.agenciesOnScene) setAgenciesOnScene(parsed.agenciesOnScene);
            if (parsed.locationDetails) setLocationDetails((p) => ({ ...p, ...parsed.locationDetails }));
            if (parsed.stagingRadioChecks) setStagingRadioChecks(parsed.stagingRadioChecks);
            if (parsed.treatmentRadioChecks) setTreatmentRadioChecks(parsed.treatmentRadioChecks);
            if (parsed.transportRadioChecks) setTransportRadioChecks(parsed.transportRadioChecks);
            if (parsed.triageRadioChecks) setTriageRadioChecks(parsed.triageRadioChecks);
            if (parsed.notes != null) setNotes(parsed.notes);
            if (parsed.stagingTriageInfo != null) setStagingTriageInfo(parsed.stagingTriageInfo);
            if (parsed.stagingTreatmentInfo != null) setStagingTreatmentInfo(parsed.stagingTreatmentInfo);
            if (parsed.triageNotes != null) setTriageNotes(parsed.triageNotes);
            if (parsed.allTasks?.length) setAllTasks(parsed.allTasks);
          }
        } catch (_) {}
      } else {
        setCurrentEventId(null);
        setRoleAssignments({});
      }
    } catch (e) {
      console.warn("Checklist load error:", e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!currentEventId) return;
    const payload = {
      treatmentTarpCounts,
      transportEntries,
      deceasedCount,
      triageCounts,
      resourcesRequested,
      agenciesOnScene,
      locationDetails,
      stagingRadioChecks,
      treatmentRadioChecks,
      transportRadioChecks,
      triageRadioChecks,
      notes,
      stagingTriageInfo,
      stagingTreatmentInfo,
      triageNotes,
      allTasks,
    };
    AsyncStorage.setItem(TREATMENT_COUNTS_PREFIX + currentEventId, JSON.stringify(payload)).catch(() => {});
    const t = setTimeout(() => {
      commanderApi.putChecklistData(currentEventId, payload).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [
    currentEventId,
    treatmentTarpCounts,
    transportEntries,
    deceasedCount,
    triageCounts,
    resourcesRequested,
    agenciesOnScene,
    locationDetails,
    stagingRadioChecks,
    treatmentRadioChecks,
    transportRadioChecks,
    triageRadioChecks,
    notes,
    stagingTriageInfo,
    stagingTreatmentInfo,
    triageNotes,
    allTasks,
  ]);

  const userResponsibilities = (() => {
    const u = user?.professional || user;
    const name = (u?.name || u?.email || user?.name || user?.email || "").trim();
    if (!name) return [];
    if (isIncidentCommander(roleAssignments, name)) return ALL_RESPONSIBILITIES;
    const fromAssignments = getResponsibilitiesFromRoleAssignments(roleAssignments, name);
    return fromAssignments;
  })();
  const visibleTasks = allTasks.filter((t) => t.responsibility === activeTab);
  const completedCount = visibleTasks.filter((t) => t.completed).length;
  const totalCount = visibleTasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  useEffect(() => {
    if (userResponsibilities.length > 0 && !userResponsibilities.includes(activeTab)) {
      setActiveTab(userResponsibilities[0]);
    } else if (userResponsibilities.length === 0) {
      setActiveTab(null);
    }
  }, [userResponsibilities]);

  const formatTextWithRoles = (text) => {
    let out = text;
    Object.entries(roleAssignments).forEach(([role, name]) => {
      if (name) {
        const cap = role.charAt(0).toUpperCase() + role.slice(1);
        out = out.replace(new RegExp(`\\b${cap}\\b`, "gi"), `${name} (${cap})`);
      }
    });
    return out;
  };

  const toggleTask = (id) => {
    setAllTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    setAllTasks((prev) => [
      ...prev,
      { id: `${activeTab.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}`, title: newTaskTitle, responsibility: activeTab, completed: false },
    ]);
    setNewTaskTitle("");
  };

  const deleteTask = (id) => {
    setAllTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTriageCount = (cat, inc) => {
    setTriageCounts((p) => ({ ...p, [cat]: Math.max(0, p[cat] + (inc ? 1 : -1)) }));
  };

  const updateDeceasedCount = (inc) => {
    setDeceasedCount((p) => Math.max(0, p + (inc ? 1 : -1)));
  };

  const addTransportEntry = (priority) => {
    const tag = newTransportTag[priority].trim();
    if (!tag) return;
    setTransportEntries((p) => ({
      ...p,
      [priority]: [...p[priority], { tagNumber: tag, time: getTimeStr() }],
    }));
    setNewTransportTag((p) => ({ ...p, [priority]: "" }));
  };

  const deleteTransportEntry = (priority, idx) => {
    setTransportEntries((p) => ({ ...p, [priority]: p[priority].filter((_, i) => i !== idx) }));
  };

  const addResourceRequest = () => {
    const resource = newResourceInput.trim();
    if (!resource) return;
    setResourcesRequested((p) => [...p, { resource, confirmed: false, time: "" }]);
    setNewResourceInput("");
  };

  const deleteResourceRequest = (idx) => {
    setResourcesRequested((p) => p.filter((_, i) => i !== idx));
  };

  const toggleResourceConfirmed = (idx) => {
    setResourcesRequested((p) => p.map((x, i) => (i === idx ? { ...x, confirmed: !x.confirmed } : x)));
  };

  const setResourceTime = (idx) => {
    setResourcesRequested((p) => p.map((x, i) => (i === idx ? { ...x, time: getTimeStr() } : x)));
  };

  const setAgencyTime = (idx) => {
    setAgenciesOnScene((p) => p.map((x, i) => (i === idx ? { ...x, time: getTimeStr() } : x)));
  };

  const setLocationTime = (key) => {
    setLocationDetails((p) => ({ ...p, [`${key}Time`]: getTimeStr() }));
  };

  const updateTreatmentTarpCount = (color, key, inc) => {
    const t = getTimeStr();
    setTreatmentTarpCounts((p) => ({
      ...p,
      [color]: {
        ...p[color],
        [key]: { count: Math.max(0, p[color][key].count + (inc ? 1 : -1)) },
        lastUpdated: t,
      },
    }));
  };

  const getTreatmentTarpTotal = (color) =>
    ["priority1", "priority2", "priority3", "dead"].reduce((s, k) => s + treatmentTarpCounts[color][k].count, 0);

  useEffect(() => {
    if (!drillStarted) return;
    const takeSnapshot = () => {
      const p1 = treatmentTarpCounts.red.priority1.count + treatmentTarpCounts.yellow.priority1.count + treatmentTarpCounts.green.priority1.count;
      const p2 = treatmentTarpCounts.red.priority2.count + treatmentTarpCounts.yellow.priority2.count + treatmentTarpCounts.green.priority2.count;
      const p3 = treatmentTarpCounts.red.priority3.count + treatmentTarpCounts.yellow.priority3.count + treatmentTarpCounts.green.priority3.count;
      const dead = treatmentTarpCounts.red.dead.count + treatmentTarpCounts.yellow.dead.count + treatmentTarpCounts.green.dead.count;
      const time = getTimeStr();
      setPrioritySnapshots((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.time === time) return prev;
        return [...prev, { time, priority1: p1, priority2: p2, priority3: p3, dead }];
      });
    };
    takeSnapshot();
    const iv = setInterval(takeSnapshot, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [drillStarted, treatmentTarpCounts]);

  const openPhone = (num) => {
    Linking.openURL(`tel:${num.replace(/\D/g, "")}`);
  };

  const renderSectionHeader = (title, color = colors.pennBlue) => (
    <View style={[styles.sectionHeader, { backgroundColor: color }]}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const renderRadioItem = (id, text, checks, setChecks) => (
    <TouchableOpacity
      key={id}
      style={styles.radioRow}
      onPress={() => setChecks((p) => ({ ...p, [id]: !p[id] }))}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, checks[id] && styles.checkboxChecked]}>
        {checks[id] && <Feather name="check" size={14} color="#fff" />}
      </View>
      <Text style={styles.radioText}>{text}</Text>
    </TouchableOpacity>
  );

  if (userResponsibilities.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, styles.sectionIndent, styles.emptyBox]}>
          <Feather name="user-x" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>
            You are not assigned to any role. Contact the Incident Commander to get assigned in Drill Setup.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Progress card */}
      <View style={[styles.card, styles.sectionIndent]}>
        <View style={styles.progressRow}>
          <View style={styles.progressTitleWrap}>
            <Text style={styles.progressTitle}>Current Responsibility: {activeTab || userResponsibilities[0]}</Text>
            <Text style={styles.progressSub}>Track your progress below</Text>
          </View>
        </View>
        <View style={styles.progressCountRow}>
          <Text style={styles.progressCount}>{completedCount}/{totalCount}</Text>
          <Text style={styles.progressLabel}>Tasks Complete</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressPct}>{Math.round(progress)}% Complete</Text>
      </View>

      {/* Responsibility tabs */}
      <View style={[styles.tabBar, styles.sectionIndent]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          {userResponsibilities.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.tab, activeTab === r && styles.tabActive]}
              onPress={() => setActiveTab(r)}
              activeOpacity={0.7}
            >
              <Feather name={RESPONSIBILITY_ICONS[r] || "circle"} size={20} color={activeTab === r ? "#fff" : colors.text} />
              <Text style={[styles.tabText, activeTab === r && styles.tabTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tasks section */}
      <View style={[styles.card, styles.sectionIndent]}>
        <View style={styles.tasksHeader}>
          <Text style={styles.tasksTitle}>{activeTab} Tasks</Text>
        </View>
        <View style={styles.tasksHeaderRow}>
          <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditMode(!isEditMode)}>
            <Feather name="edit-2" size={18} color="#fff" />
            <Text style={styles.editBtnText}>{isEditMode ? "Done" : "Edit Tasks"}</Text>
          </TouchableOpacity>
        </View>

        {isEditMode && (
          <View style={styles.addTaskRow}>
            <TextInput
              style={styles.addTaskInput}
              placeholder="Enter new task title..."
              placeholderTextColor={colors.textSecondary}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              onSubmitEditing={addTask}
            />
            <TouchableOpacity style={styles.addTaskBtn} onPress={addTask}>
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.addTaskBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}

        {visibleTasks.length > 0 ? (
          visibleTasks.map((task) => (
            <View key={task.id} style={[styles.taskRow, task.completed && styles.taskRowDone]}>
              <TouchableOpacity
                style={styles.taskContent}
                onPress={() => !isEditMode && toggleTask(task.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkWrap, task.completed && styles.checkWrapDone]}>
                  {task.completed ? <Feather name="check" size={16} color="#fff" /> : <Feather name="square" size={18} color={colors.textSecondary} />}
                </View>
                <Text style={[styles.taskTitle, task.completed && styles.taskDone]}>{task.title}</Text>
              </TouchableOpacity>
              {isEditMode && (
                <TouchableOpacity onPress={() => deleteTask(task.id)} style={styles.deleteBtn}>
                  <Feather name="trash-2" size={20} color={colors.red} />
                </TouchableOpacity>
            )}
            </View>
          ))
        ) : (
          <View style={styles.emptyWrap}>
            <Feather name="clipboard" size={40} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              No tasks yet. {isEditMode ? "Add your first task above!" : 'Click "Edit Tasks" to add tasks.'}
            </Text>
          </View>
        )}
      </View>

      {/* Incident Command specific */}
      {activeTab === "Incident Command" && (
        <>
          <View style={[styles.card, styles.sectionIndent]}>
            {renderSectionHeader("Resources Requested")}
            <View style={styles.resourceAddRow}>
              <TextInput
                style={styles.resourceInput}
                placeholder="Enter resource name..."
                placeholderTextColor={colors.textSecondary}
                value={newResourceInput}
                onChangeText={setNewResourceInput}
                onSubmitEditing={addResourceRequest}
              />
              <TouchableOpacity style={styles.resourceAddBtn} onPress={addResourceRequest}>
                <Feather name="plus" size={18} color="#fff" />
                <Text style={styles.resourceAddBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            {resourcesRequested.map((r, i) => (
              <View key={i} style={styles.resourceRow}>
                <Text style={styles.resourceName}>{r.resource}</Text>
                <TouchableOpacity
                  style={[styles.resourceCheckbox, r.confirmed && styles.resourceCheckboxChecked]}
                  onPress={() => toggleResourceConfirmed(i)}
                  activeOpacity={0.7}
                >
                  {r.confirmed && <Feather name="check" size={14} color="#fff" />}
                </TouchableOpacity>
                <Text style={styles.resourceTime}>{r.time || "—"}</Text>
                <TouchableOpacity style={styles.timeBtn} onPress={() => setResourceTime(i)}>
                  <Feather name="clock" size={18} color={colors.pennBlue} />
                  <Text style={styles.timeBtnText}>Time</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteResourceRequest(i)} style={styles.resourceDeleteBtn}>
                  <Feather name="x" size={20} color={colors.red} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={[styles.card, styles.sectionIndent]}>
            {renderSectionHeader("Agencies on Scene")}
            <View style={styles.tableWrap}>
              {agenciesOnScene.map((a, i) => (
                <View key={i} style={styles.agencyRow}>
                  <TextInput
                    style={styles.agencyInput}
                    placeholder="Agency"
                    placeholderTextColor={colors.textSecondary}
                    value={a.agency}
                    onChangeText={(v) => setAgenciesOnScene((p) => p.map((x, j) => (j === i ? { ...x, agency: v } : x)))}
                  />
                  <Text style={styles.agencyTimeDisplay}>{a.time || "—"}</Text>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => setAgencyTime(i)}>
                    <Feather name="clock" size={18} color={colors.pennBlue} />
                    <Text style={styles.timeBtnText}>Time</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.locationCard, styles.sectionIndent]}>
            <Text style={styles.locationTitle}>Location Details to Report</Text>
            {["staging", "treatment", "transport"].map((key) => (
              <View key={key} style={styles.locationRow}>
                <TextInput
                  style={styles.locationInput}
                  placeholder={`${key.charAt(0).toUpperCase() + key.slice(1)} Location`}
                  placeholderTextColor={colors.textSecondary}
                  value={locationDetails[`${key}Location`]}
                  onChangeText={(v) => setLocationDetails((p) => ({ ...p, [`${key}Location`]: v }))}
                />
                <Text style={styles.locationTimeDisplay}>{locationDetails[`${key}Time`] || "—"}</Text>
                <TouchableOpacity style={styles.timeBtn} onPress={() => setLocationTime(key)}>
                  <Feather name="clock" size={18} color={colors.pennBlue} />
                  <Text style={styles.timeBtnText}>Time</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={[styles.card, styles.sectionIndent]}>
            {renderSectionHeader("IMPORTANT NUMBERS", colors.red)}
            <View style={styles.numbersWrap}>
              <TouchableOpacity onPress={() => openPhone("2155733333")}>
                <Text style={styles.numberLabel}>PennComm Emergency:</Text>
                <Text style={styles.numberLink}>(215) 573-3333</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openPhone("8002221222")}>
                <Text style={styles.numberLabel}>Poison Control:</Text>
                <Text style={styles.numberLink}>(800) 222-1222</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openPhone("2678620008")}>
                <Text style={styles.numberLabel}>Medical Command HUP 1:</Text>
                <Text style={styles.numberLink}>(267) 862-0008</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openPhone("2763247294")}>
                <Text style={styles.numberLabel}>Medical Director:</Text>
                <Text style={styles.numberLink}>(276) 324-7294</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Staging specific */}
      {activeTab === "Staging" && (
        <>
          <View style={[styles.card, styles.sectionIndent]}>
            {renderSectionHeader("Radio Communications", colors.green)}
            <View style={styles.radioWrap}>
              {[
                { id: 1, text: `To ${formatTextWithRoles("Command")} when staging location established` },
                { id: 2, text: `To ${formatTextWithRoles("Triage")} and ${formatTextWithRoles("Command")} when EMT's first start arriving` },
                { id: 3, text: `To ${formatTextWithRoles("Triage")} and ${formatTextWithRoles("Command")} after all EMTs have been checked in` },
                { id: 4, text: `To ${formatTextWithRoles("Command")} after all EMTs have been checked out` },
              ].map((r) => renderRadioItem(r.id, r.text, stagingRadioChecks, setStagingRadioChecks))}
            </View>
          </View>
          <View style={[styles.card, styles.sectionIndent]}>
            {renderSectionHeader("Notes")}
            <Text style={styles.notesBullets}>• Establish command post</Text>
            <Text style={styles.notesBullets}>• Treatment will say all tarps empty; confirm pts transported → start checking out with Staging Officer</Text>
            <TextInput style={styles.notesInput} placeholder="Write your notes here..." placeholderTextColor={colors.textSecondary} value={notes} onChangeText={setNotes} multiline numberOfLines={6} />
          </View>
          <View style={[styles.card, styles.sectionIndent]}>
            {renderSectionHeader("Triage & Treatment Information")}
            <Text style={styles.inputLabel}>Triage #s + Times</Text>
            <TextInput style={styles.textArea} placeholder="Enter triage numbers and times..." placeholderTextColor={colors.textSecondary} value={stagingTriageInfo} onChangeText={setStagingTriageInfo} multiline />
            <Text style={styles.inputLabel}>Treatment #s + Times</Text>
            <TextInput style={styles.textArea} placeholder="Enter treatment numbers and times..." placeholderTextColor={colors.textSecondary} value={stagingTreatmentInfo} onChangeText={setStagingTreatmentInfo} multiline />
          </View>
        </>
      )}

      {/* Treatment specific */}
      {activeTab === "Treatment" && (
        <>
          <View style={[styles.card, styles.sectionIndent]}>
            {renderSectionHeader("Radio Communications", colors.green)}
            <View style={styles.radioWrap}>
              {[
                { id: 1, text: `To ${formatTextWithRoles("Command")} when treatment area established` },
                { id: 2, text: `To ${formatTextWithRoles("Command")} when first patient arrives to treatment area` },
                { id: 3, text: `To ${formatTextWithRoles("Transport")} and updating every 10 minutes` },
                { id: 4, text: `To ${formatTextWithRoles("Command")} when all priority 1 transported` },
                { id: 5, text: `To ${formatTextWithRoles("Command")} and ${formatTextWithRoles("Transport")} when all patients have left the treatment area` },
              ].map((r) => renderRadioItem(r.id, r.text, treatmentRadioChecks, setTreatmentRadioChecks))}
            </View>
          </View>

          {["red", "yellow", "green"].map((color) => (
            <View key={color} style={[styles.card, styles.sectionIndent, styles[`${color}Card`]]}>
              <View style={styles.tarpHeader}>
                <Text style={[styles.tarpTitle, styles[`${color}Title`]]}>{color.toUpperCase()} TARP</Text>
                <Text style={[styles.tarpTotal, styles[`${color}Total`]]}>{getTreatmentTarpTotal(color)}</Text>
              </View>
              {treatmentTarpCounts[color].lastUpdated ? (
                <Text style={styles.lastUpdated}>Last Updated: {treatmentTarpCounts[color].lastUpdated}</Text>
              ) : null}
              {["priority1", "priority2", "priority3", "dead"].map((key) => (
                <View key={key} style={styles.tarpRow}>
                  <Text style={styles.tarpLabel}>{key === "dead" ? "Dead" : `Priority ${key.slice(-1)}`}</Text>
                  <Text style={[styles.tarpCount, styles[`${color}Total`]]}>{treatmentTarpCounts[color][key].count}</Text>
                  <View style={styles.tarpBtns}>
                    <TouchableOpacity style={[styles.tarpBtn, styles[`${color}Btn`]]} onPress={() => updateTreatmentTarpCount(color, key, true)}>
                      <Text style={styles.tarpBtnText}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.tarpBtnMinus} onPress={() => updateTreatmentTarpCount(color, key, false)}>
                      <Text style={styles.tarpBtnText}>-</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))}

          <View style={[styles.card, styles.sectionIndent]}>
            <View style={[styles.sectionHeader, { backgroundColor: colors.pennBlue }]}>
              <Text style={styles.sectionHeaderText}>Priority Totals (5-Minute Snapshots)</Text>
            </View>
            <View style={styles.trackBtnRow}>
              <TouchableOpacity
                style={[styles.trackBtn, !isDrillActive && styles.trackBtnDisabled]}
                onPress={() => setDrillStarted(!drillStarted)}
                disabled={!isDrillActive}
              >
                <Text style={styles.trackBtnText}>{drillStarted ? "Stop Tracking" : "Start Tracking"}</Text>
              </TouchableOpacity>
            </View>
            {!isDrillActive && <Text style={styles.trackHint}>Start a drill from the Drill Setup page to enable tracking</Text>}
            {prioritySnapshots.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.snapshotScrollContent}>
                <View style={styles.snapshotTable}>
                  <View style={styles.snapshotRow}>
                    <Text style={styles.snapshotCell}>Time</Text>
                    {prioritySnapshots.map((s, i) => (
                      <Text key={i} style={styles.snapshotCell}>{s.time}</Text>
                    ))}
                  </View>
                  <View style={[styles.snapshotRow, styles.p1Row]}>
                    <Text style={styles.snapshotCell}>Priority 1</Text>
                    {prioritySnapshots.map((s, i) => (
                      <Text key={i} style={styles.snapshotCell}>{s.priority1}</Text>
                    ))}
                  </View>
                  <View style={[styles.snapshotRow, styles.p2Row]}>
                    <Text style={styles.snapshotCell}>Priority 2</Text>
                    {prioritySnapshots.map((s, i) => (
                      <Text key={i} style={styles.snapshotCell}>{s.priority2}</Text>
                    ))}
                  </View>
                  <View style={[styles.snapshotRow, styles.p3Row]}>
                    <Text style={styles.snapshotCell}>Priority 3</Text>
                    {prioritySnapshots.map((s, i) => (
                      <Text key={i} style={styles.snapshotCell}>{s.priority3}</Text>
                    ))}
                  </View>
                  <View style={[styles.snapshotRow, styles.deadRow]}>
                    <Text style={styles.snapshotCell}>Dead</Text>
                    {prioritySnapshots.map((s, i) => (
                      <Text key={i} style={styles.snapshotCell}>{s.dead}</Text>
                    ))}
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </>
      )}

      {/* Transport specific */}
      {activeTab === "Transport" && (
        <>
          <View style={[styles.card, styles.sectionIndent]}>
            {renderSectionHeader("Radio Communications", colors.green)}
            <View style={styles.radioWrap}>
              {[
                { id: 1, text: `To ${formatTextWithRoles("Treatment")} and ${formatTextWithRoles("Command")} when established transport area (location)` },
                { id: 2, text: `To ${formatTextWithRoles("Command")} to request bus (early)` },
                { id: 3, text: `To ${formatTextWithRoles("Treatment")} and ${formatTextWithRoles("Command")} when we're ready to start transporting patients - PFD arrival` },
                { id: 4, text: `To ${formatTextWithRoles("Treatment")} and ${formatTextWithRoles("Command")} when bus here` },
                { id: 5, text: `To ${formatTextWithRoles("Command")} once priority 2 begins to be transported` },
                { id: 6, text: `To ${formatTextWithRoles("Command")} once priority 3 begins to be transported` },
                { id: 7, text: `To ${formatTextWithRoles("Command")} once all patients have been transported` },
              ].map((r) => renderRadioItem(r.id, r.text, transportRadioChecks, setTransportRadioChecks))}
            </View>
          </View>

          <View style={[styles.card, styles.sectionIndent]}>
            {renderSectionHeader("Times Patients Transported")}
            {["priority1", "priority2", "priority3"].map((priority, idx) => {
              const labels = ["Priority 1", "Priority 2", "Priority 3"];
              const colors_ = [colors.red, colors.yellow, colors.green];
              const entries = transportEntries[priority];
              return (
                <View key={priority} style={styles.transportSection}>
                  <Text style={[styles.transportLabel, { color: colors_[idx] }]}>{labels[idx]}</Text>
                  <View style={styles.transportAddRow}>
                    <TextInput
                      style={styles.transportInput}
                      placeholder="Enter tag number..."
                      placeholderTextColor={colors.textSecondary}
                      value={newTransportTag[priority]}
                      onChangeText={(v) => setNewTransportTag((p) => ({ ...p, [priority]: v }))}
                      onSubmitEditing={() => addTransportEntry(priority)}
                    />
                    <TouchableOpacity style={[styles.transportAddBtn, { backgroundColor: colors_[idx] }]} onPress={() => addTransportEntry(priority)}>
                      <Text style={styles.transportAddBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                  {entries.map((e, i) => (
                    <View key={i} style={styles.transportEntry}>
                      <Text style={styles.transportEntryTag}>{e.tagNumber}</Text>
                      <Text style={styles.transportEntryTime}>{e.time}</Text>
                      <TouchableOpacity onPress={() => deleteTransportEntry(priority, i)}>
                        <Feather name="x" size={20} color={colors.red} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.transportTotal}>
                    <Text style={styles.transportTotalText}>Total Count: </Text>
                    <Text style={[styles.transportTotalNum, { color: colors_[idx] }]}>{entries.length}</Text>
                  </View>
                </View>
              );
            })}
            <View style={styles.deceasedSection}>
              <Text style={styles.deceasedLabel}>Deceased Count</Text>
              <Text style={styles.deceasedNum}>{deceasedCount}</Text>
              <View style={styles.deceasedBtns}>
                <TouchableOpacity style={styles.deceasedBtn} onPress={() => updateDeceasedCount(true)}>
                  <Text style={styles.deceasedBtnText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deceasedBtn} onPress={() => updateDeceasedCount(false)}>
                  <Text style={styles.deceasedBtnText}>-</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Triage specific */}
      {activeTab === "Triage" && (
        <>
          <View style={[styles.card, styles.sectionIndent]}>
            {renderSectionHeader("Radio Communications", colors.green)}
            <View style={styles.radioWrap}>
              {[
                { id: 1, text: `To ${formatTextWithRoles("Treatment")} + ${formatTextWithRoles("Command")} every ~19 patients or every 5 minutes with an update on number of tags + types` },
                { id: 2, text: `To ${formatTextWithRoles("Treatment")} and ${formatTextWithRoles("Command")} when extrication is beginning and final counts of each category + total #` },
              ].map((r) => renderRadioItem(r.id, r.text, triageRadioChecks, setTriageRadioChecks))}
            </View>
          </View>
          <View style={[styles.card, styles.sectionIndent]}>
            {renderSectionHeader("Collected Triage Tag Count")}
            {[
              { key: "red", color: colors.red },
              { key: "yellow", color: colors.yellow },
              { key: "green", color: colors.green },
              { key: "black", color: "#374151" },
            ].map(({ key, color }) => (
              <View key={key} style={styles.triageCountRow}>
                <Text style={[styles.triageCountLabel, { color }]}>{key.toUpperCase()}</Text>
                <Text style={[styles.triageCountNum, { color }]}>{triageCounts[key]}</Text>
                <View style={styles.triageCountBtns}>
                  <TouchableOpacity style={[styles.triageCountBtn, { backgroundColor: color }]} onPress={() => updateTriageCount(key, true)}>
                    <Text style={styles.triageCountBtnText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.triageCountBtnMinus} onPress={() => updateTriageCount(key, false)}>
                    <Text style={styles.triageCountBtnText}>-</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <View style={styles.triageTotalWrap}>
              <Text style={styles.triageTotalLabel}>Total Patients</Text>
              <Text style={styles.triageTotalNum}>{triageCounts.red + triageCounts.yellow + triageCounts.green + triageCounts.black}</Text>
            </View>
          </View>
          <View style={[styles.card, styles.sectionIndent]}>
            {renderSectionHeader("Notes")}
            <TextInput style={styles.notesInput} placeholder="Write your notes here..." placeholderTextColor={colors.textSecondary} value={triageNotes} onChangeText={setTriageNotes} multiline numberOfLines={6} />
          </View>
        </>
      )}

      <View style={{ height: spacing.xl * 2 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 3 },
  sectionIndent: { marginHorizontal: spacing.md },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    overflow: "hidden",
    ...shadows.card,
  },
  progressRow: { padding: spacing.lg, paddingBottom: spacing.sm },
  progressTitleWrap: { flex: 1 },
  progressTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  progressSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  progressCountRow: { flexDirection: "row", alignItems: "baseline", gap: 6, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  progressCount: { fontSize: 28, fontWeight: "700", color: colors.pennBlue },
  progressLabel: { fontSize: 13, color: colors.textSecondary },
  progressBar: { height: 10, backgroundColor: colors.border, marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: 5, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.pennBlue, borderRadius: 5 },
  progressPct: { fontSize: 13, color: colors.textSecondary, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  tabBar: { backgroundColor: colors.cardBg, borderRadius: radius.lg, marginBottom: spacing.lg, overflow: "hidden", ...shadows.card },
  tabScrollContent: { paddingHorizontal: spacing.md },
  tab: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minWidth: 140 },
  tabActive: { backgroundColor: colors.pennBlue },
  tabText: { fontSize: 14, fontWeight: "600", color: colors.text },
  tabTextActive: { color: "#fff" },
  tasksHeader: { padding: spacing.lg, paddingBottom: spacing.sm },
  tasksHeaderRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  tasksTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.pennBlue, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  editBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  addTaskRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  addTaskInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, fontSize: 14, color: colors.text },
  addTaskBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.green, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  addTaskBtnText: { color: "#fff", fontWeight: "600" },
  taskRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  taskRowDone: { backgroundColor: colors.greenBg, borderLeftWidth: 4, borderLeftColor: colors.green },
  taskContent: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  checkWrap: { width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkWrapDone: { backgroundColor: colors.green, borderColor: colors.green },
  taskTitle: { flex: 1, fontSize: 15, color: colors.text },
  taskDone: { textDecorationLine: "line-through", color: colors.textSecondary },
  deleteBtn: { padding: spacing.sm },
  emptyWrap: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  sectionHeader: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  sectionHeaderText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  tableWrap: { padding: spacing.md },
  tableRow: { flexDirection: "row", marginBottom: spacing.sm, gap: spacing.sm },
  tableCell: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, fontSize: 14, color: colors.text },
  resourceAddRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.md },
  resourceInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, fontSize: 14, color: colors.text },
  resourceAddBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.pennBlue, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  resourceAddBtnText: { color: "#fff", fontWeight: "600" },
  resourceRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: "#F9FAFB", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  resourceName: { flex: 1, fontSize: 14, fontWeight: "500", color: colors.text },
  resourceCheckbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.pennBlue, alignItems: "center", justifyContent: "center" },
  resourceCheckboxChecked: { backgroundColor: colors.pennBlue },
  resourceTime: { width: 60, fontSize: 14, color: colors.textSecondary },
  resourceDeleteBtn: { padding: spacing.xs },
  timeBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.pennBlue },
  timeBtnText: { fontSize: 13, fontWeight: "600", color: colors.pennBlue },
  agencyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  agencyInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, fontSize: 14, color: colors.text },
  agencyTimeDisplay: { width: 55, fontSize: 14, color: colors.textSecondary },
  locationTimeDisplay: { width: 55, fontSize: 14, color: colors.textSecondary },
  locationCard: { backgroundColor: "#EFF6FF", borderWidth: 2, borderColor: "#BFDBFE", borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  locationTitle: { fontSize: 16, fontWeight: "600", color: "#1E40AF", marginBottom: spacing.md },
  locationRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  locationInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, fontSize: 14, color: colors.text, backgroundColor: "#fff" },
  numbersWrap: { padding: spacing.lg, gap: spacing.md },
  numberLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  numberLink: { fontSize: 18, fontWeight: "700", color: colors.pennBlue, marginTop: 2 },
  radioWrap: { padding: spacing.lg },
  radioRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: "#F9FAFB", borderRadius: radius.md, marginBottom: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.pennBlue, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: colors.pennBlue },
  radioText: { flex: 1, fontSize: 14, color: colors.text },
  notesBullets: { fontSize: 13, color: colors.textSecondary, marginBottom: 4, paddingHorizontal: spacing.lg },
  notesInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, margin: spacing.lg, marginTop: 0, minHeight: 120, fontSize: 14, color: colors.text, textAlignVertical: "top" },
  inputLabel: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 6, paddingHorizontal: spacing.lg },
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.md, minHeight: 100, fontSize: 14, color: colors.text, textAlignVertical: "top" },
  redCard: { borderWidth: 2, borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  yellowCard: { borderWidth: 2, borderColor: "#FDE047", backgroundColor: "#FEFCE8" },
  greenCard: { borderWidth: 2, borderColor: "#86EFAC", backgroundColor: "#F0FDF4" },
  redTitle: { color: colors.red },
  yellowTitle: { color: "#A16207" },
  greenTitle: { color: "#15803D" },
  redTotal: { color: colors.red, fontWeight: "700", fontSize: 24 },
  yellowTotal: { color: "#A16207", fontWeight: "700", fontSize: 24 },
  greenTotal: { color: "#15803D", fontWeight: "700", fontSize: 24 },
  tarpHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  tarpTitle: { fontSize: 20, fontWeight: "700" },
  tarpTotal: { fontSize: 32, fontWeight: "700" },
  lastUpdated: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  tarpRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: "#fff", borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  tarpLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
  tarpCount: { fontSize: 22, fontWeight: "700", marginRight: spacing.md },
  tarpBtns: { flexDirection: "row", gap: spacing.sm },
  tarpBtn: { width: 48, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  tarpBtnMinus: { width: 48, height: 40, borderRadius: radius.sm, backgroundColor: "#4B5563", alignItems: "center", justifyContent: "center" },
  redBtn: { backgroundColor: colors.red },
  yellowBtn: { backgroundColor: "#CA8A04" },
  greenBtn: { backgroundColor: colors.green },
  tarpBtnText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  trackBtnRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  trackBtn: { backgroundColor: colors.green, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, alignSelf: "flex-start" },
  trackBtnDisabled: { opacity: 0.5 },
  trackBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  trackHint: { fontSize: 12, color: colors.yellow, padding: spacing.md },
  snapshotScrollContent: { paddingHorizontal: spacing.md },
  snapshotTable: { padding: spacing.md },
  snapshotRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
  snapshotCell: { padding: spacing.sm, minWidth: 70, fontSize: 14, color: colors.text },
  p1Row: { backgroundColor: "#FEF2F2" },
  p2Row: { backgroundColor: "#FEFCE8" },
  p3Row: { backgroundColor: "#F0FDF4" },
  deadRow: { backgroundColor: "#F5F5F5" },
  transportSection: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  transportLabel: { fontSize: 16, fontWeight: "600", marginBottom: spacing.sm },
  transportAddRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  transportInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, fontSize: 14, color: colors.text },
  transportAddBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, justifyContent: "center" },
  transportAddBtnText: { color: "#fff", fontWeight: "600" },
  transportEntry: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, marginBottom: 4, backgroundColor: "#F9FAFB", borderRadius: radius.sm },
  transportEntryTag: { flex: 1, fontSize: 14, color: colors.text },
  transportEntryTime: { fontSize: 14, color: colors.textSecondary, width: 70 },
  transportTotal: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  transportTotalText: { fontSize: 14, fontWeight: "600", color: colors.text },
  transportTotalNum: { fontSize: 20, fontWeight: "700" },
  deceasedSection: { padding: spacing.lg },
  deceasedLabel: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  deceasedNum: { fontSize: 48, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  deceasedBtns: { flexDirection: "row", gap: spacing.md },
  deceasedBtn: { flex: 1, backgroundColor: "#4B5563", paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  deceasedBtnText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  triageCountRow: { flexDirection: "row", alignItems: "center", padding: spacing.lg, marginBottom: spacing.sm, backgroundColor: "#F9FAFB", borderRadius: radius.md },
  triageCountLabel: { flex: 1, fontSize: 18, fontWeight: "700" },
  triageCountNum: { fontSize: 36, fontWeight: "700", marginRight: spacing.md },
  triageCountBtns: { flexDirection: "row", gap: spacing.sm },
  triageCountBtn: { width: 56, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  triageCountBtnMinus: { width: 56, height: 48, borderRadius: radius.md, backgroundColor: "#4B5563", alignItems: "center", justifyContent: "center" },
  triageCountBtnText: { color: "#fff", fontSize: 24, fontWeight: "700" },
  triageTotalWrap: { backgroundColor: colors.pennBlue, padding: spacing.lg, margin: spacing.lg, marginTop: 0, borderRadius: radius.md, alignItems: "center" },
  triageTotalLabel: { fontSize: 16, fontWeight: "600", color: "#fff", marginBottom: 4 },
  triageTotalNum: { fontSize: 48, fontWeight: "700", color: "#fff" },
});
