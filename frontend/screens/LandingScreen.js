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

export default function LandingScreen({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleAuth = () => {
    // Placeholder for future authentication logic
    // When successful, this triggers the main app
    onAuthSuccess();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Title */}
      <Text style={styles.logoText}>eMERTgency</Text>

      {/* Input Fields */}
      <View style={styles.inputContainer}>
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
      <TouchableOpacity style={styles.button} onPress={handleAuth}>
        <Text style={styles.buttonText}>
          {isSignUp ? "Create Account" : "Log In"}
        </Text>
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
    color: "#011F5B",
    textAlign: "center",
    marginBottom: 50,
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
});