import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import landingStyles from "../styles/LandingScreenStyles";
import { authAPI } from "../services/api";

export default function LandingScreen({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    if (isSignUp) {
      if (password !== confirmPassword) {
        Alert.alert("Error", "Passwords do not match");
        return;
      }
      if (!name) {
        Alert.alert("Error", "Please enter your name");
        return;
      }
      if (password.length < 12) {
        Alert.alert("Error", "Password must be at least 12 characters long");
        return;
      }
    }

    setLoading(true);
    try {
      let response;
      if (isSignUp) {
        response = await authAPI.register(
          name,
          email,
          password,
          phoneNumber || undefined,
          undefined // role, defaults to 'MERT Member'
        );
      } else {
        response = await authAPI.login(email, password);
      }

      if (response.success) {
        Alert.alert("Success", isSignUp ? "Account created successfully!" : "Login successful!");
        onAuthSuccess();
      } else {
        Alert.alert("Error", response.message || "Authentication failed");
      }
    } catch (error) {
      console.error("Auth error:", error);
      Alert.alert("Error", error.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Title */}
      <View style={landingStyles.logoSection}>
        <View style={[landingStyles.brand, { flexDirection: 'row' }]}>
          <Text style={[styles.logoText, landingStyles.e]}>e</Text>
          <Text style={[styles.logoText, landingStyles.mert]}>MERT</Text>
          <Text style={[styles.logoText, landingStyles.gency]}>gency</Text>
        </View>
      </View>

      {/* Input Fields */}
      <View style={styles.inputContainer}>
        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="#D9E1F2"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#D9E1F2"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Phone Number (Optional)"
            placeholderTextColor="#D9E1F2"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#D9E1F2"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#D9E1F2"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        )}
      </View>

      {/* Auth Button */}
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleAuth}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {isSignUp ? "Create Account" : "Log In"}
          </Text>
        )}
      </TouchableOpacity>

      {/* Toggle Between Login / Signup */}
      <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
        <Text style={styles.switchText}>
          {isSignUp
            ? "Already have an account? Log in"
            : "Don’t have an account? Sign up"}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#B5C8E8", // soft blue background
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  logoText: {
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "#999",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 30,
  },
  input: {
    backgroundColor: "#011F5B",
    color: "#fff",
    fontSize: 16,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  button: {
    backgroundColor: "#011F5B",
    borderRadius: 14,
    paddingVertical: 14,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  switchText: {
    color: "#011F5B",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});