import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import landingStyles from "../styles/LandingScreenStyles";
import { useAuth } from '../context/AuthContext';

export default function LandingScreen({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { login, register } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        // Frontend validation for required fields
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();
        
        // Validate name
        if (!trimmedName) {
          setError("Name is required");
          setLoading(false);
          return;
        }
        if (trimmedName.length < 2) {
          setError("Name must be at least 2 characters");
          setLoading(false);
          return;
        }
        if (trimmedName.length > 100) {
          setError("Name must be less than 100 characters");
          setLoading(false);
          return;
        }
        
        // Validate email
        if (!trimmedEmail) {
          setError("Email is required");
          setLoading(false);
          return;
        }
        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          setError("Please enter a valid email address");
          setLoading(false);
          return;
        }
        
        // Validate password match
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }
        
        // Validate password is not empty (backend will validate complexity)
        if (!password) {
          setError("Password is required");
          setLoading(false);
          return;
        }

        const signupData = {
          name: trimmedName,
          email: trimmedEmail,
          password,
        };

        const result = await register(signupData);

        if (result.success) {
          onAuthSuccess();
        } else {
          // Format backend error messages
          // Prioritize errors array over message if both exist
          let errorMessage = "Registration failed";
          
          if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
            // Filter out empty, invalid, or generic error messages
            const errorMessages = result.errors
              .map(err => {
                const msg = err.msg || err.message;
                // Only return meaningful error messages
                return msg && msg.trim() !== '' && 
                       msg !== 'Invalid value' && 
                       !msg.toLowerCase().includes('invalid value') 
                  ? msg 
                  : null;
              })
              .filter(msg => msg !== null);
            
            if (errorMessages.length > 0) {
              errorMessage = errorMessages.join('\n');
            } else if (result.message) {
              errorMessage = result.message;
            }
          } else if (result.message) {
            errorMessage = result.message;
          }
          
          setError(errorMessage);
        }
      } else {
        // login
        const result = await login(email.trim(), password);
        if (result.success) {
          onAuthSuccess();
        } else {
          setError(result.message || "Login failed");
        }
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error("Auth error:", err);
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

      {/* Error Message */}
      {error ? (
        <View style={styles.errorContainer}>
          {error.includes('\n') ? (
            // Multiple errors - split by newline
            error.split('\n').map((err, index) => (
              <Text key={index} style={styles.errorText}>
                {err}
              </Text>
            ))
          ) : (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </View>
      ) : null}

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
        />
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
        style={[styles.button, loading ? styles.disabledButton : null]}
        onPress={handleAuth}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>
          {isSignUp ? "Create Account" : "Log In"}
        </Text>
      </TouchableOpacity>

      {/* Toggle Between Login / Signup */}
      <TouchableOpacity onPress={() => {
        setIsSignUp(!isSignUp);
        setError(""); // Clear error when switching between login/signup
      }}>
        <Text style={styles.switchText}>
          {isSignUp
            ? "Already have an account? Log in"
            : "Don't have an account? Sign up"}
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
  disabledButton: {
    opacity: 0.5,
  },
  errorContainer: {
    backgroundColor: "#DC3545",
    padding: 15,
    borderRadius: 14,
    marginBottom: 20,
  },
  errorText: { color: "#fff", fontSize: 16, fontWeight: "500" },
});