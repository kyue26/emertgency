// styles/CommanderTodoScreenStyles.js
import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F1FA",
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  header: { marginBottom: 20 },
  mass: {
    color: "#2B6EA3",
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 4,
  },
  camp: {
    fontSize: 20,
    fontWeight: "900",
    color: "#011F5B",
    marginBottom: 4,
  },
  sub: { fontSize: 14, color: "#011F5B" },

  sectionHigh: {
    marginTop: 10,
    fontWeight: "800",
    color: "#9E3A3A",
    backgroundColor: "#F8D7DA",
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionLow: {
    marginTop: 20,
    fontWeight: "800",
    color: "#155724",
    backgroundColor: "#DFF6DD",
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
    borderRadius: 8,
    marginBottom: 8,
  },

  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  cardTitle: { fontWeight: "800", fontSize: 16, marginBottom: 4 },
  cardDetail: { fontSize: 14, color: "#333" },

  signoutBtn: {
    alignSelf: "center",
    marginTop: 30,
    backgroundColor: "#011F5B",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  signoutText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});