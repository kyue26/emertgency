import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  titleBlue: {
    color: "#011F5B", // Penn blue
    fontWeight: "900",
    fontSize: 52,
  },
  titleRed: {
    color: "#990000", // Penn red
    fontWeight: "900",
    fontSize: 52,
  },
  tagline: {
    marginTop: 16,
    textAlign: "center",
    color: "#333",
    fontSize: 16,
    maxWidth: 300,
  },
  contextBox: {
    marginTop: 40,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    width: "90%",
  },
  contextHeader: {
    fontSize: 18,
    fontWeight: "700",
    color: "#011F5B",
    marginBottom: 8,
  },
  contextText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#333",
  },
});
