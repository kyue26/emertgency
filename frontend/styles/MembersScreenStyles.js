import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F1FA",
    paddingHorizontal: 20,
    paddingTop: 40,
  },

  titleBox: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#011F5B",
    textAlign: "center",
    textShadowColor: "#999",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
    borderBottomWidth: 2,
    borderBottomColor: "#011F5B",
    paddingBottom: 4,
  },

  /* search bar */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#011F5B",
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 20,
    justifyContent: "space-between",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    marginHorizontal: 10,
    fontSize: 16,
  },

  /* cards */
  card: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBox: {
    width: 45,
    height: 45,
    borderRadius: 8,
    backgroundColor: "#F1F1F1",
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  info: {
    fontSize: 13,
    color: "#333",
    marginVertical: 2,
  },
  statusTag: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  distance: {
    fontSize: 12,
    color: "#555",
    marginTop: 3,
  },
});
