import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { AuthContext } from '../context/AuthContext';

const SettingsScreen = () => {
    const { userRole, handleLogout, handleSwitchInterface } = useContext(AuthContext);
    const [switching, setSwitching] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const targetLabel = userRole === 'commander' ? 'MERT' : 'Commander';

    const onSwitchInterface = async () => {
        if (!handleSwitchInterface || switching) return;
        setSwitching(true);
        try {
            const switched = await handleSwitchInterface();
            if (!switched) {
                Alert.alert(
                    'Sign-in Required',
                    `No active ${targetLabel} session found. Please sign in to ${targetLabel} once, then you can switch without logging in again.`
                );
            }
        } catch (error) {
            Alert.alert('Switch Failed', 'Unable to switch interface right now. Please try again.');
        } finally {
            setSwitching(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 300);
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>
                Current interface: {userRole === 'commander' ? 'Commander' : 'MERT Member'}
            </Text>

            <TouchableOpacity
                style={[styles.button, styles.switchButton, switching && styles.buttonDisabled]}
                onPress={onSwitchInterface}
                activeOpacity={0.8}
                disabled={switching}
            >
                {switching ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Switch to {targetLabel} Interface</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.button, styles.logoutButton]}
                onPress={() => handleLogout?.()}
                activeOpacity={0.8}
            >
                <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FB',
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 24,
        flexGrow: 1,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#011F5B',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#4A5A76',
        marginBottom: 24,
    },
    button: {
        width: '100%',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 12,
    },
    switchButton: {
        backgroundColor: '#011F5B',
    },
    logoutButton: {
        backgroundColor: '#C62828',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    buttonDisabled: {
        opacity: 0.65,
    },
});

export default SettingsScreen;
