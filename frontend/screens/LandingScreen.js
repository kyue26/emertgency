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
      if (isSignUp) {
        response = await authAPI.register(
          name.trim(),
          email.trim(),
          password,
          phoneNumber ? phoneNumber.trim() : undefined,
          undefined // role, defaults to 'MERT Member'
        );
      } else {
        response = await authAPI.login(email.trim(), password);
      }

      if (response.success) {
        onAuthSuccess();
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
      
      if (isSignUp) {
        setError(errorMessage);
      } else {
        setError("Invalid credentials");
      }
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

      {/* Error Message Display */}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
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

      {/* Toggle Between Login / Signup */}
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
});