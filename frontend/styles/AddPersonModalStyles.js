import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#D8E2F2",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 80,
  },
  titleBox: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#011F5B",
    textAlign: "center",
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    color: "#011F5B",
    marginBottom: "20",
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
    color: "#011F5B",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#011F5B",
    marginBottom: 16,
  },
  image: {
    width: 300,  
    height: 180, 
    borderWidth: 2,
    borderColor: "#000",
    borderRadius: 10,
  },
  codeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  circle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  countText: {
    fontSize: 22,
    fontWeight: "700",
  },
  helpButton: {
    position: "absolute",
    top: 80,         
    right: 30,
    backgroundColor: "#F8D7DA",
    borderRadius: 30, 
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
});
