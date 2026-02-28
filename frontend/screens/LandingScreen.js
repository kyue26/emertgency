import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import landingStyles from "../styles/LandingScreenStyles";
import { authAPI } from "../services/api";
import commanderApi from "../services/commanderApi";

// 'member' | 'commander' | null (null = show role selection)
export default function LandingScreen({ onAuthSuccess }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async () => {
    setError("");
    
    if (!email || !password) {
      setError("Please fill in all required fields");
      return;
    }

    if (isSignUp) {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      
      // validate name: between 2 - 100 characters
      if (!trimmedName) {
        setError("Please enter your name");
        return;
      }
      if (trimmedName.length < 2) {
        setError("Name must be at least 2 characters");
        return;
      }
      if (trimmedName.length > 100) {
        setError("Name must be less than 100 characters");
        return;
      }
      
      // validate email: must be a valid email address
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setError("Please enter a valid email address");
        return;
      }
      
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (password.length < 12) {
        setError("Password must be at least 12 characters long");
        return;
      }
    }

    setLoading(true);
    try {
      let response;
      if (selectedRole === "commander") {
        if (isSignUp) {
          setError("Commander sign-up is not available here. Please log in.");
          setLoading(false);
          return;
        }
        response = await commanderApi.login(email.trim(), password);
        if (response && response.token) {
          onAuthSuccess("commander");
          return;
        }
        response = { success: false };
      } else {
        if (isSignUp) {
          response = await authAPI.register(
            name.trim(),
            email.trim(),
            password,
            phoneNumber ? phoneNumber.trim() : undefined,
            undefined
          );
        } else {
          response = await authAPI.login(email.trim(), password);
        }
      }

      if (response.success) {
        onAuthSuccess(selectedRole || "member");
      } else {
        if (isSignUp) {
          // Format backend error messages for signup
          let errorMessage = response.message || "Registration failed";
          
          if (response.errors && Array.isArray(response.errors) && response.errors.length > 0) {
            const errorMessages = response.errors
              .map(err => {
                const msg = err.msg || err.message;
                return msg && msg.trim() !== '' && 
                       msg !== 'Invalid value' && 
                       !msg.toLowerCase().includes('invalid value') 
                  ? msg 
                  : null;
              })
              .filter(msg => msg !== null);
            
            if (errorMessages.length > 0) {
              errorMessage = errorMessages.join('\n');
            }
          }
          
          setError(errorMessage);
        } else {
          // Simple error message for login
          setError("Invalid credentials");
        }
      }
    } catch (error) {
      console.error("Auth error:", error);
      
      // Extract error message from HTTP error response
      let errorMessage = "An error occurred. Please try again.";
      
      if (error.response) {
        // HTTP error with response data
        const errorData = error.response;
        
        if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
          // Extract meaningful error messages from errors array
          const errorMessages = errorData.errors
            .map(err => {
              const msg = err.msg || err.message;
              return msg && msg.trim() !== '' && 
                     msg !== 'Invalid value' && 
                     !msg.toLowerCase().includes('invalid value') 
                ? msg 
                : null;
            })
            .filter(msg => msg !== null);
          
          if (errorMessages.length > 0) {
            errorMessage = errorMessages.join('\n');
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      // Network failure: show helpful hint for Commander (device can't reach localhost)
      const isNetworkError = (error.message || "").includes("Network request failed") || (error.message || "").includes("Failed to fetch");
      if (!isSignUp && isNetworkError && selectedRole === "commander") {
        errorMessage = "Can't reach commander server. On a device, set EXPO_PUBLIC_COMMANDER_API_URL=http://YOUR_IP:5010/api in frontend/.env and restart Expo.";
      } else if (!isSignUp && isNetworkError) {
        errorMessage = "Can't reach server. On a device, set EXPO_PUBLIC_API_URL (and restart Expo).";
      } else if (!isSignUp && !errorMessage) {
        errorMessage = "Invalid credentials";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Role selection
  if (selectedRole === null) {
    return (
      <View style={styles.container}>
        <View style={landingStyles.logoSection}>
          <View style={[landingStyles.brand, { flexDirection: "row" }]}>
            <Text style={[styles.logoText, landingStyles.e]}>e</Text>
            <Text style={[styles.logoText, landingStyles.mert]}>MERT</Text>
            <Text style={[styles.logoText, landingStyles.gency]}>gency</Text>
          </View>
        </View>
        <Text style={styles.rolePrompt}>Continue as</Text>
        <TouchableOpacity
          style={styles.roleButton}
          onPress={() => setSelectedRole("commander")}
          activeOpacity={0.8}
        >
          <Feather name="shield" size={28} color="#fff" />
          <Text style={styles.roleButtonText}>Commander</Text>
          <Text style={styles.roleButtonSubtext}>Command center & drills</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.roleButton}
          onPress={() => setSelectedRole("member")}
          activeOpacity={0.8}
        >
          <Feather name="users" size={28} color="#fff" />
          <Text style={styles.roleButtonText}>Member</Text>
          <Text style={styles.roleButtonSubtext}>Field & team flow</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableOpacity
        style={styles.backToRole}
        onPress={() => {
          setSelectedRole(null);
          setError("");
        }}
      >
        <Feather name="arrow-left" size={22} color="#011F5B" />
        <Text style={styles.backToRoleText}>Back to role selection</Text>
      </TouchableOpacity>

      <View style={landingStyles.logoSection}>
        <View style={[landingStyles.brand, { flexDirection: "row" }]}>
          <Text style={[styles.logoText, landingStyles.e]}>e</Text>
          <Text style={[styles.logoText, landingStyles.mert]}>MERT</Text>
          <Text style={[styles.logoText, landingStyles.gency]}>gency</Text>
        </View>
        <Text style={styles.roleLabel}>
          {selectedRole === "commander" ? "Commander" : "Member"} sign in
        </Text>
        {selectedRole === "commander" && (
          <Text style={styles.demoHint}>Demo: commander@test.com / commander123</Text>
        )}
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.inputContainer}>
        {isSignUp && (
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor="#D9E1F2"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError("");
          }}
          autoCapitalize="words"
        />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#D9E1F2"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError("");
          }}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Phone Number (Optional)"
            placeholderTextColor="#D9E1F2"
            value={phoneNumber}
            onChangeText={(text) => {
              setPhoneNumber(text);
              setError("");
            }}
            keyboardType="phone-pad"
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#D9E1F2"
          secureTextEntry
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError("");
          }}
        />
        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#D9E1F2"
            secureTextEntry
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setError("");
            }}
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

      {/* Toggle Between Login / Signup (Members only; Commander is login-only) */}
      {selectedRole === "member" && (
        <TouchableOpacity onPress={() => {
          setIsSignUp(!isSignUp);
          setError("");
        }}>
          <Text style={styles.switchText}>
            {isSignUp
              ? "Already have an account? Log in"
              : "Don't have an account? Sign up"}
          </Text>
        </TouchableOpacity>
      )}
      </ScrollView>
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
  errorContainer: {
    width: "100%",
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFE5E5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF6B6B",
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 14,
    textAlign: "center",
  },
  rolePrompt: {
    color: "#011F5B",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
  },
  roleButton: {
    width: "100%",
    backgroundColor: "#011F5B",
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  roleButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  roleButtonSubtext: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    marginTop: 4,
  },
  backToRole: {
    position: "absolute",
    top: 52,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  backToRoleText: { color: "#011F5B", fontSize: 15, marginLeft: 6, fontWeight: "500" },
  roleLabel: {
    color: "#011F5B",
    fontSize: 14,
    marginTop: 4,
    opacity: 0.9,
  },
  demoHint: {
    color: "#011F5B",
    fontSize: 12,
    marginTop: 6,
    opacity: 0.8,
  },
  formScroll: { flex: 1, width: "100%" },
  formScrollContent: { paddingBottom: 40 },
});