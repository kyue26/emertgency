// styles/CreateTaskModalStyles.js
import { StyleSheet } from 'react-native';

const COLORS = {
    primary: '#011F5B', // Dark Blue
    white: '#FFFFFF',
    red: '#DC3545', 
    darkGray: '#808080',
    borderGray: '#E0E0E0',
    lightGray: '#F0F0F0',
};

export default StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)', // Dim background
    },
    modalView: {
        backgroundColor: COLORS.white,
        borderRadius: 20,
        width: '90%',
        maxHeight: '80%', 
        overflow: 'hidden', 
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    scrollViewContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10, 
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.primary,
    },
    closeButton: {
        padding: 5,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.primary,
        marginBottom: 8,
        marginTop: 15,
    },
    required: {
        color: COLORS.red,
    },
    input: {
        borderWidth: 1,
        borderColor: COLORS.borderGray,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 15,
        color: COLORS.primary,
        backgroundColor: COLORS.lightGray,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top', 
    },
    priorityContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        marginBottom: 10,
    },
    priorityButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: COLORS.borderGray,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginHorizontal: 5,
        backgroundColor: COLORS.white,
    },
    selectedPriorityButton: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    priorityButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
    selectedPriorityButtonText: {
        color: COLORS.white,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        borderTopWidth: 1,
        borderTopColor: COLORS.borderGray,
        paddingVertical: 15,
        paddingHorizontal: 20,
    },
    cancelButton: {
        backgroundColor: COLORS.white,
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.borderGray,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.darkGray,
    },
    createButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 8,
    },
    createButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.white,
    },
});