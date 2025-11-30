// styles/TaskScreenStyles.js
import { StyleSheet, Platform } from 'react-native';

const COLORS = {
    primary: '#011F5B', // Dark Blue
    secondary: '#D8E2F2', // Light Blue/Gray Background
    white: '#FFFFFF',
    red: '#DC3545', // High Priority Red
    green: '#00C853', // Low Priority Green
    yellow: '#E6B900', // Medium Priority Yellow
    lightBlueButton: '#1E90FF', // Brighter blue for +New Task
    lightGray: '#F0F0F0',
    mediumGray: '#C0C0C0',
    darkGray: '#808080',
};

export default StyleSheet.create({
    fullScreen: {
        flex: 1,
        backgroundColor: COLORS.secondary,
        paddingTop: Platform.OS === 'android' ? 25 : 0, // Adjust for status bar on Android
    },
    // --- Header and Navigation Styles ---
    header: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 15,
        height: 60, 
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButtonText: {
        color: COLORS.white,
        marginLeft: 8,
        fontSize: 16,
    },
    newTaskButton: {
        backgroundColor: COLORS.lightBlueButton,
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    newTaskButtonText: {
        color: COLORS.white,
        marginLeft: 5,
        fontSize: 15,
        fontWeight: '600',
    },
    pageTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.primary,
        paddingHorizontal: 20,
        marginTop: 20,
        marginBottom: 20,
    },
    tabContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: COLORS.white,
        marginHorizontal: 20,
        borderRadius: 25,
        padding: 5,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 20,
        alignItems: 'center',
    },
    activeTabButton: {
        backgroundColor: COLORS.primary,
    },
    tabButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
    },
    activeTabButtonText: {
        color: COLORS.white,
    },

    // --- Task List and Card Styles ---
    taskListContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20, 
    },
    noTasksContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
        backgroundColor: COLORS.white,
        borderRadius: 10,
        marginTop: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    noTasksText: {
        marginTop: 15,
        fontSize: 16,
        color: COLORS.darkGray,
    },
    taskCard: {
        backgroundColor: COLORS.white,
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    taskCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    taskTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    priorityDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    taskTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
        flexShrink: 1, 
    },
    taskDescription: {
        fontSize: 14,
        color: COLORS.darkGray,
        marginBottom: 10,
        marginLeft: 18, 
    },
    taskAssigneeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingLeft: 18, 
    },
    taskAssignee: {
        fontSize: 13,
        fontWeight: '500',
        color: COLORS.primary,
    },
    taskCasualty: {
        fontSize: 13,
        color: COLORS.darkGray,
    },
    taskFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: COLORS.lightGray,
        paddingTop: 10,
        marginTop: 5,
    },
    taskStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    taskStatus: {
        fontSize: 13,
        color: COLORS.darkGray,
        marginLeft: 5,
        fontWeight: '600',
    },
    taskDate: {
        fontSize: 13,
        color: COLORS.darkGray,
    },
});