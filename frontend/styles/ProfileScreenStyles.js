import { StyleSheet, Platform } from "react-native";

export default StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#E8F1FA", 
    paddingVertical: 50,
    paddingHorizontal: 20,
  },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
    borderWidth: 3,
    borderColor: "#011F5B", 
  },

  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000",
  },
  edit: {
    color: "#000",
    fontSize: 14,
    marginBottom: 25,
  },

  usernameBox: {
    backgroundColor: "#011F5B",
    borderRadius: 20,
    paddingHorizontal: 25,
    paddingVertical: 8,
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  usernameText: {
    color: "#fff",
    fontWeight: "500",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "80%",
    marginBottom: 30,
  },
  stat: { alignItems: "center" },
  statNumber: {
    fontWeight: "700",
    fontSize: 16,
  },
  statLabel: {
    color: "#000",
    fontSize: 13,
  },

  sectionHeader: {
    fontSize: 18,
    fontWeight: "700",
    alignSelf: "flex-start",
    marginTop: 10,
    marginBottom: 10,
    color: "#011F5B",
  },

  card: {
    backgroundColor: "#990000",
    borderRadius: 15,
    padding: 15,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },

  cardName: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 17,
  },
  cardDetail: {
    color: "#fff",
    fontSize: 13,
    marginTop: 2,
  },
  cardMore: {
    color: "#fff",
    marginTop: 4,
    fontSize: 13,
  },

  circle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
  },
});
