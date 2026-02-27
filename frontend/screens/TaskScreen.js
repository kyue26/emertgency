// screens/TaskScreen.js
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Alert, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import styles from '../styles/TaskScreenStyles'; // Styles for main screen and task cards
import modalStyles from '../styles/CreateTaskModalStyles'; // Styles for the modal form
import { taskAPI, eventAPI, groupAPI, authAPI } from '../services/api';
import { getStoredUser } from '../services/api';
import { transformTasks, taskToBackendFormat } from '../utils/taskTransform';

// *** Task Modal Component (Defined Locally to avoid new folder) ***
const CreateTaskModal = ({ onClose, onCreateTask, professionals = [] }) => {
    const [taskTitle, setTaskTitle] = useState('');
    const [description, setDescription] = useState('');
    const [assignTo, setAssignTo] = useState('');
    const [priority, setPriority] = useState('Medium'); // Default priority
    const [relatedCasualty, setRelatedCasualty] = useState('');

    const handleSubmit = () => {
        if (!taskTitle || !description || !assignTo) {
            Alert.alert('Required Fields Missing', 'Please fill in all required fields: Task Title, Description, and Assign To.');
            return;
        }

        const newTask = {
            title: taskTitle,
            description: description,
            assignTo: assignTo,
            priority: priority,
            relatedCasualty: relatedCasualty,
        };
        onCreateTask(newTask);
    };

    return (
        <KeyboardAvoidingView
            style={modalStyles.centeredView}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <View style={modalStyles.modalView}>
                <ScrollView contentContainerStyle={modalStyles.scrollViewContent}>
                    <View style={modalStyles.modalHeader}>
                        <Text style={modalStyles.modalTitle}>Create New Task</Text>
                        <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
                            <Feather name="x" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>

                    <Text style={modalStyles.label}>Task Title <Text style={modalStyles.required}>*</Text></Text>
                    <TextInput
                        style={modalStyles.input}
                        placeholder="e.g., Prepare transport for casualty"
                        value={taskTitle}
                        onChangeText={setTaskTitle}
                    />

                    <Text style={modalStyles.label}>Description <Text style={modalStyles.required}>*</Text></Text>
                    <TextInput
                        style={[modalStyles.input, modalStyles.textArea]}
                        placeholder="Provide task details"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={4}
                    />

                    <Text style={modalStyles.label}>Assign To <Text style={modalStyles.required}>*</Text></Text>
                    <TextInput
                        style={modalStyles.input}
                        placeholder="Name or email of assignee"
                        value={assignTo}
                        onChangeText={setAssignTo}
                    />
                    {professionals.length > 0 && (
                        <View style={{ marginTop: 10, marginBottom: 10 }}>
                            <Text style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
                                Available ({professionals.length}):
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                {professionals.map((p, index) => (
                                    <Text key={p.professional_id} style={{ fontSize: 11, color: '#666', marginRight: 8, marginBottom: 2 }}>
                                        {p.name}{index < professionals.length - 1 ? ',' : ''}
                                    </Text>
                                ))}
                            </View>
                        </View>
                    )}

                    <Text style={modalStyles.label}>Priority <Text style={modalStyles.required}>*</Text></Text>
                    <View style={modalStyles.priorityContainer}>
                        {['Low', 'Medium', 'High'].map((p) => (
                            <TouchableOpacity
                                key={p}
                                style={[modalStyles.priorityButton, priority === p && modalStyles.selectedPriorityButton]}
                                onPress={() => setPriority(p)}
                            >
                                <Text style={[modalStyles.priorityButtonText, priority === p && {color: p === 'Low' ? '#00C853' : p === 'Medium' ? '#E6B900' : '#DC3545'}, priority === p && modalStyles.selectedPriorityButtonText]}>
                                    {p}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={modalStyles.label}>Related Casualty (Optional)</Text>
                    <TextInput
                        style={modalStyles.input}
                        placeholder="Casualty ID"
                        value={relatedCasualty}
                        onChangeText={setRelatedCasualty}
                    />
                </ScrollView>

                <View style={modalStyles.buttonContainer}>
                    <TouchableOpacity style={modalStyles.cancelButton} onPress={onClose}>
                        <Text style={modalStyles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={modalStyles.createButton} onPress={handleSubmit}>
                        <Text style={modalStyles.createButtonText}>Create Task</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};
// *** End Task Modal Component ***

const TaskScreen = ({ navigation }) => {
    const [activeTab, setActiveTab] = useState('assignedToMe'); 
    const [isCreateTaskModalVisible, setCreateTaskModalVisible] = useState(false);
    const [assignedToMeTasks, setAssignedToMeTasks] = useState([]);
    const [assignedByMeTasks, setAssignedByMeTasks] = useState([]);
    const [assignedToMeCount, setAssignedToMeCount] = useState(0);
    const [assignedByMeCount, setAssignedByMeCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeEventId, setActiveEventId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [professionals, setProfessionals] = useState([]);

    // load tasks & event data
    const loadData = async () => {
        try {
            // get current user
            const user = await getStoredUser();
            setCurrentUser(user);

            // get the event the current user is actually in
            const currentEventResponse = await eventAPI.getCurrentEvent();
            let eventId = null;

            if (currentEventResponse.success && currentEventResponse.event) {
                eventId = currentEventResponse.event.event_id;
                setActiveEventId(eventId);
            }

            // get all professionals and filter to those in the same event (the "team")
            const professionalsResponse = await authAPI.getProfessionals();
            let eventMembers = [];

            if (professionalsResponse.success && professionalsResponse.professionals) {
                const eventIdStr = eventId ? String(eventId) : '';
                eventMembers = professionalsResponse.professionals.filter(p =>
                    eventIdStr && p != null && String(p.current_event_id) === eventIdStr
                );
            }

            setProfessionals(eventMembers);

            // load tasks with freshly fetched eventId and user (state may not have updated yet)
            await loadTasks(eventId, user);
        } catch (error) {
            console.error('Error loading data:', error);
            Alert.alert("Error", "Failed to load data.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadTasks = async (overrideEventId, overrideUser) => {
        const eventId = overrideEventId ?? activeEventId;
        const user = overrideUser ?? currentUser;
        try {
            if (!user || !eventId) return;

            // get tasks assigned to me for the current event only
            const myTasksResponse = await taskAPI.getTasks({ my_tasks: true, event_id: eventId });
            if (myTasksResponse.success) {
                const transformed = transformTasks(myTasksResponse.tasks);
                setAssignedToMeTasks(transformed.filter(t => t.assigned_to === user.professional_id));
                if (myTasksResponse.pagination && typeof myTasksResponse.pagination.total === 'number') {
                    setAssignedToMeCount(myTasksResponse.pagination.total);
                } else {
                    setAssignedToMeCount(transformed.length);
                }
            }

            // get tasks assigned by me for the current event only
            const createdTasksResponse = await taskAPI.getTasks({ event_id: eventId });
            if (createdTasksResponse.success) {
                const transformed = transformTasks(createdTasksResponse.tasks);
                setAssignedByMeTasks(transformed.filter(t => t.created_by === user.professional_id));
                if (createdTasksResponse.pagination && typeof createdTasksResponse.pagination.total === 'number') {
                    setAssignedByMeCount(createdTasksResponse.pagination.total);
                } else {
                    setAssignedByMeCount(transformed.length);
                }
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    };

    // Refetch whenever this screen gains focus (e.g. opening Tasks from Profile tab)
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    // Function to add a new task
    const handleCreateTask = async (newTask) => {
        if (!activeEventId) {
            Alert.alert("Error", "No active event found.");
            return;
        }

        const assignToStr = (newTask && newTask.assignTo) ? String(newTask.assignTo).trim() : '';
        if (!assignToStr) {
            Alert.alert("Error", "Please enter a name or email for Assign To.");
            return;
        }

        const assignToLower = assignToStr.toLowerCase();

        // find professional ID from name or email (guard against null name/email)
        let assignedProfessional = professionals.find(p => {
            if (!p) return false;
            const nameMatch = p.name && String(p.name).toLowerCase().includes(assignToLower);
            const emailMatch = p.email && String(p.email).toLowerCase().includes(assignToLower);
            return nameMatch || emailMatch;
        });

        console.log('Found locally?', !!assignedProfessional);

        // if not found in local list, try to search through all groups
        if (!assignedProfessional) {
            try {
                // Fetch all groups with members to search
                const searchResponse = await groupAPI.getGroups({ include_members: true });
                
                if (searchResponse && searchResponse.success && searchResponse.groups) {
                    // Search through all group members by name or email
                    for (let i = 0; i < searchResponse.groups.length; i++) {
                        const group = searchResponse.groups[i];
                        if (group.members) {
                            for (let j = 0; j < group.members.length; j++) {
                                const member = group.members[j];
                                if (!member) continue;
                                const emailMatch = member.email && String(member.email).toLowerCase().includes(assignToLower);
                                const nameMatch = member.name && String(member.name).toLowerCase().includes(assignToLower);
                                
                                if (emailMatch || nameMatch) {
                                    assignedProfessional = {
                                        professional_id: member.professional_id,
                                        name: member.name,
                                        email: member.email,
                                        role: member.role,
                                    };
                                    break;
                                }
                            }
                            
                            if (assignedProfessional) {
                                break;
                            }
                        }
                    } 
                }
            } catch (searchError) {
                Alert.alert("Error", "Could not find professional. Please enter a valid name or email (e.g., angie@pennmert.org).");
                return;
            }
        }

        if (!assignedProfessional || !assignedProfessional.professional_id) {
            Alert.alert("Error", "Could not find professional. Please enter a valid name or email (e.g., angie@pennmert.org).");
            return;
        }

        try {
            // notes must be a string or null (backend validates .trim() and max length)
            const rawNotes = newTask.relatedCasualty;
            const notes = (rawNotes != null && rawNotes !== '')
                ? String(rawNotes).trim().substring(0, 2000)
                : null;

            const taskData = {
                event_id: activeEventId,
                assigned_to: assignedProfessional.professional_id,
                task_description: String(newTask.description || newTask.taskTitle || '').trim() || 'Task',
                priority: newTask.priority?.toLowerCase() || 'medium',
            };
            if (notes != null) taskData.notes = notes;

            const response = await taskAPI.createTask(taskData);
            if (response.success) {
                Alert.alert("Success", "Task created successfully!");
                setCreateTaskModalVisible(false);
                setActiveTab('assignedByMe');
                await loadTasks();
            } else {
                Alert.alert("Error", response.message || "Failed to create task.");
            }
        } catch (error) {
            console.error('Error creating task:', error);
            const message = (error && typeof error.message === 'string' && !error.message.includes('__DEV__'))
                ? error.message
                : 'Failed to create task. Please try again.';
            Alert.alert("Error", message);
        }
    };

    const getPriorityColor = (priority) => {
        // display format is Low, Medium, High
        // backend format is low, medium, high, critical
        const p = priority?.toLowerCase();
        switch (p) {
            case 'low': return '#00C853'; // Green
            case 'medium': return '#E6B900'; // Yellow
            case 'high': return '#DC3545'; // Red
            case 'critical': return '#8B0000'; // Dark Red
            default: return '#808080';
        }
    };

    const renderTaskCard = (task) => (
        <View style={styles.taskCard} key={task.id || task.task_id}>
            <View style={styles.taskCardHeader}>
                <View style={styles.taskTitleContainer}>
                    <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(task.priority || task.priorityDisplay) }]} />
                    <Text style={styles.taskTitle}>{task.title || task.task_description}</Text>
                </View>
                {activeTab === 'assignedByMe' && (
                    <TouchableOpacity onPress={() => Alert.alert("Action", "Edit/Delete task feature goes here")}>
                        <Feather name="more-vertical" size={20} color="#808080" />
                    </TouchableOpacity>
                )}
            </View>
            <Text style={styles.taskDescription}>{task.description || task.task_description}</Text> 
            <View style={styles.taskAssigneeRow}>
                {activeTab === 'assignedByMe' && (
                    <Text style={styles.taskAssignee}>
                        To: {task.assignTo || task.assigned_to_name || task.assigned_to}
                    </Text>
                )}
                {activeTab === 'assignedToMe' && (
                    <Text style={styles.taskAssignee}>
                        From: {task.created_by_name || 'Commander'}
                    </Text>
                )}
                {task.notes ? (
                    <Text style={styles.taskCasualty}>Notes: {task.notes}</Text>
                ) : (
                    <Text style={styles.taskCasualty}>No Notes</Text>
                )}
            </View>

            <View style={styles.taskFooter}>
                <View style={styles.taskStatusContainer}>
                    <Feather name="clock" size={14} color="#808080" />
                    <Text style={styles.taskStatus}>
                        {task.statusDisplay || task.status || 'Pending'}
                    </Text>
                </View>
                <Text style={styles.taskDate}>
                    {task.date || (task.created_at ? new Date(task.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }) : '')}
                </Text>
            </View>
        </View>
    );

    const currentTasks = activeTab === 'assignedToMe' ? assignedToMeTasks : assignedByMeTasks;
    const taskCount = currentTasks.length;

    const onRefresh = () => {
        setRefreshing(true);
        loadTasks();
    };

    React.useLayoutEffect(() => {
        navigation.setOptions({
            header: () => (
                <View style={{
                    backgroundColor: '#011F5B', 
                    paddingTop: 52,
                    paddingBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 15,
                }}>
                    {/* Back Button */}
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="arrow-left" size={24} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', marginLeft: 8, fontSize: 16 }}>Back</Text>
                    </TouchableOpacity>
                    
                    {/* New Task Button (Interacts with state here) */}
                    <TouchableOpacity 
                        onPress={() => setCreateTaskModalVisible(true)} // <--- INTERACTION HERE
                        style={{
                            backgroundColor: '#1E90FF',
                            borderRadius: 20,
                            paddingHorizontal: 15,
                            paddingVertical: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}
                    >
                        <Feather name="plus" size={20} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', marginLeft: 5, fontSize: 15, fontWeight: '600' }}>New Task</Text>
                    </TouchableOpacity>
                </View>
            ),
        });
    }, [navigation, setCreateTaskModalVisible]);

    if (loading && !refreshing) {
        return (
            <View style={[styles.fullScreen, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#011F5B" />
            </View>
        );
    }

    return (
        <View style={styles.fullScreen}>

            {/* Title */}
            <Text style={styles.pageTitle}>Task Management</Text>

            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'assignedToMe' && styles.activeTabButton]}
                    onPress={() => setActiveTab('assignedToMe')}
                >
                    <Text style={[styles.tabButtonText, activeTab === 'assignedToMe' && styles.activeTabButtonText]}>
                        Assigned to Me ({assignedToMeCount})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'assignedByMe' && styles.activeTabButton]}
                    onPress={() => setActiveTab('assignedByMe')}
                >
                    <Text style={[styles.tabButtonText, activeTab === 'assignedByMe' && styles.activeTabButtonText]}>
                        Assigned by Me ({assignedByMeCount})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Task List / No tasks found */}
            <ScrollView 
                contentContainerStyle={styles.taskListContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {taskCount === 0 ? (
                    <View style={styles.noTasksContainer}>
                        <Feather name="clock" size={60} color="#C0C0C0" />
                        <Text style={styles.noTasksText}>No tasks found</Text>
                    </View>
                ) : (
                    currentTasks.map(renderTaskCard)
                )}
            </ScrollView>

            {/* Create Task Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isCreateTaskModalVisible}
                onRequestClose={() => setCreateTaskModalVisible(false)}
            >
                <CreateTaskModal
                    onClose={() => setCreateTaskModalVisible(false)}
                    onCreateTask={handleCreateTask}
                    professionals={professionals}
                />
            </Modal>
        </View>
    );
};

export default TaskScreen;