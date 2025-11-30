// screens/TaskScreen.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import styles from '../styles/TaskScreenStyles'; // Styles for main screen and task cards
import modalStyles from '../styles/CreateTaskModalStyles'; // Styles for the modal form

// *** Task Modal Component (Defined Locally to avoid new folder) ***
const CreateTaskModal = ({ onClose, onCreateTask }) => {
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
                        placeholder="Name of assignee"
                        value={assignTo}
                        onChangeText={setAssignTo}
                    />

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

    // Function to add a new task
    const handleCreateTask = (newTask) => {
        const taskWithId = { 
            ...newTask, 
            id: Date.now().toString(), 
            status: 'Pending',
            date: new Date().toLocaleString('en-US', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) 
        };
        setAssignedByMeTasks(prevTasks => [taskWithId, ...prevTasks]);
        setCreateTaskModalVisible(false);
        setActiveTab('assignedByMe'); // Switch to 'Assigned by Me' tab after creating
        Alert.alert("Success", "Task created successfully!");
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'Low': return '#00C853'; // Green
            case 'Medium': return '#E6B900'; // Yellow
            case 'High': return '#DC3545'; // Red
            default: return '#808080';
        }
    };

    const renderTaskCard = (task) => (
        <View style={styles.taskCard} key={task.id}>
            <View style={styles.taskCardHeader}>
                <View style={styles.taskTitleContainer}>
                    <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(task.priority) }]} />
                    <Text style={styles.taskTitle}>{task.title}</Text>
                </View>
                {activeTab === 'assignedByMe' && (
                    <TouchableOpacity onPress={() => Alert.alert("Action", "Edit/Delete task feature goes here")}>
                        <Feather name="more-vertical" size={20} color="#808080" />
                    </TouchableOpacity>
                )}
            </View>
            <Text style={styles.taskDescription}>{task.description}</Text> 
            <View style={styles.taskAssigneeRow}>
                {activeTab === 'assignedByMe' && <Text style={styles.taskAssignee}>To: {task.assignTo}</Text>}
                {activeTab === 'assignedToMe' && <Text style={styles.taskAssignee}>From: UserCommander</Text>}
                {task.relatedCasualty ? (
                    <Text style={styles.taskCasualty}>Casualty: {task.relatedCasualty}</Text>
                ) : (
                    <Text style={styles.taskCasualty}>No Casualty</Text>
                )}
            </View>

            <View style={styles.taskFooter}>
                <View style={styles.taskStatusContainer}>
                    <Feather name="clock" size={14} color="#808080" />
                    <Text style={styles.taskStatus}>{task.status}</Text>
                </View>
                <Text style={styles.taskDate}>{task.date}</Text>
            </View>
        </View>
    );

    const currentTasks = activeTab === 'assignedToMe' ? assignedToMeTasks : assignedByMeTasks;
    const taskCount = currentTasks.length;

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
    }, [navigation]);

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
                        Assigned to Me ({assignedToMeTasks.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'assignedByMe' && styles.activeTabButton]}
                    onPress={() => setActiveTab('assignedByMe')}
                >
                    <Text style={[styles.tabButtonText, activeTab === 'assignedByMe' && styles.activeTabButtonText]}>
                        Assigned by Me ({assignedByMeTasks.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Task List / No tasks found */}
            <ScrollView contentContainerStyle={styles.taskListContainer}>
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
                />
            </Modal>
        </View>
    );
};

export default TaskScreen;