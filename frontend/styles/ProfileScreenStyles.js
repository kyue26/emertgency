import { StyleSheet, Platform } from "react-native";

// Define the main colors used in the design
const COLORS = {
    primary: '#011F5B', // Dark Blue
    secondary: '#D8E2F2', // Light Blue/Gray Background
    white: '#FFFFFF',
    red: '#DC3545', // Danger/End Shift Red
    green: '#00C853', // Success/On Duty Green
    lightYellow: '#FFFBE6', // For Pending tasks background
    darkYellow: '#E6B900', // For Pending tasks text
    lightBlue: '#E6F3FF', // For Active tasks background
    darkBlue: '#007AFF', // For Active tasks text
    lightGray: '#F0F0F0', // For Total tasks background
    darkGray: '#808080', // For Total tasks text
};

export default StyleSheet.create({
    container: {
        alignItems: "center",
        backgroundColor: COLORS.secondary,
        paddingTop: 0, 
        paddingHorizontal: 20,
        paddingBottom: 20, // Ensure enough padding at the bottom for scrolling
    },

    // --- Profile Card Styles ---
    profileCard: {
        backgroundColor: COLORS.white,
        borderRadius: 10,
        width: '100%',
        paddingVertical: 30,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginTop: 10, // Added some top margin to differentiate from header
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    avatarContainer: {
        width: 100, // Slightly larger avatar
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15, // More space below avatar
        borderWidth: 1,
        borderColor: '#E0E0E0', // Lighter border
    },
    name: {
        fontSize: 22, // Larger name font
        fontWeight: '700',
        color: COLORS.primary,
        marginBottom: 6,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 15, // Slightly larger title font
        color: COLORS.primary,
        marginLeft: 8, // More space for icon
        fontWeight: '500',
    },
    email: {
        fontSize: 15, // Slightly larger email font
        color: COLORS.primary,
        marginLeft: 8, // More space for icon
        fontWeight: '500',
    },

    // --- My Tasks Card Styles ---
    tasksCard: {
        backgroundColor: COLORS.white,
        borderRadius: 10,
        width: '100%',
        padding: 15,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    tasksHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start', // Align icon and text to the left
        marginBottom: 20, // Space between header and stats
    },
    tasksHeader: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.primary,
        marginLeft: 10, // Space between icon and text
        flex: 1, // Allows the text to take up available space
    },
    tasksArrow: {
        // Aligns the arrow to the right
        alignSelf: 'flex-end',
    },
    taskStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between', // Distributes items evenly
        width: '100%',
    },
    taskStat: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        paddingVertical: 15,
        width: '32%', // Adjust width to fit 3 items with some spacing
    },
    // Specific styles for Pending, Active, Total to match Figma
    taskStatPending: {
        backgroundColor: COLORS.lightYellow,
    },
    pendingNumber: {
        color: COLORS.darkYellow,
    },
    pendingLabel: {
        color: COLORS.darkYellow,
    },
    taskStatActive: {
        backgroundColor: COLORS.lightBlue,
    },
    activeNumber: {
        color: COLORS.darkBlue,
    },
    activeLabel: {
        color: COLORS.darkBlue,
    },
    taskStatTotal: {
        backgroundColor: COLORS.lightGray,
    },
    totalNumber: {
        color: COLORS.darkGray,
    },
    totalLabel: {
        color: COLORS.darkGray,
    },
    taskStatNumber: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 5,
    },
    taskStatLabel: {
        fontSize: 13,
    },

    // --- Shift Status Card Styles ---
    shiftStatusCard: {
        backgroundColor: COLORS.white,
        borderRadius: 10,
        width: '100%',
        padding: 15,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    shiftDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        alignItems: 'center',
    },
    noBorderBottom: {
        borderBottomWidth: 0, // For the Shift Status row, as per Figma
    },
    shiftDetailLabel: {
        fontSize: 15,
        color: COLORS.primary,
    },
    shiftDetailValue: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.primary,
    },
    shiftStatusValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    shiftStatusText: {
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 5,
        color: COLORS.primary,
    },
    
    // Shift Buttons
    shiftActionButton: {
        marginTop: 15,
        padding: 12,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    endShiftButton: {
        backgroundColor: COLORS.red, // Red for "Check Out - End Shift"
    },
    startShiftButton: {
        backgroundColor: COLORS.green, // Green for "Check In - Start New Shift"
    },
    shiftActionButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },

    // --- Today's Activity Card Styles ---
    activityCard: {
        backgroundColor: COLORS.white,
        borderRadius: 10,
        width: '100%',
        padding: 15,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    activityHeader: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.primary,
        marginBottom: 10,
    },
    activityStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    activityStatBox: {
        backgroundColor: '#F0F0F0', // Light gray background for the stat boxes
        borderRadius: 8,
        paddingVertical: 15,
        alignItems: 'center',
        width: '45%',
    },
    activityStatNumber: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.primary,
    },
    activityStatLabel: {
        fontSize: 12,
        color: COLORS.primary,
    },

    // --- Logout and Reminder Styles ---
    logoutButton: {
        backgroundColor: COLORS.white,
        padding: 12,
        borderRadius: 8,
        width: '100%',
        marginBottom: 15,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.red,
    },
    logoutButtonText: {
        color: COLORS.red,
        fontSize: 16,
        fontWeight: '700',
    },

    reminderBox: {
        backgroundColor: '#D8E2F2',
        borderRadius: 8,
        padding: 15,
        width: '100%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    reminderText: {
        fontSize: 14,
        color: COLORS.primary,
        textAlign: 'center',
    },
});