// styles/LandingScreenStyles.js
import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#BFD4F1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  redStar: {
    width: 120,
    height: 120,
    backgroundColor: "#A94444",
    transform: [{ rotate: "20deg" }],
    borderRadius: 8,
  },
  shield: {
    position: "absolute",
    top: 45,
    color: "#fff",
    fontWeight: "800",
    fontSize: 24,
  },
  brand: {
    fontSize: 40,
    fontWeight: "900",
    marginBottom: 40,
  },
  e: { color: "#011F5B" },
  mert: { color: "#9E3A3A" },
  gency: { color: "#011F5B" },

  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#011F5B",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  toggleText: {
    color: "#011F5B",
    textAlign: "center",
    fontWeight: "600",
  },
});