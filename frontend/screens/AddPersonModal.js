import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, Image } from "react-native";
import styles from "../styles/AddPersonModalStyles";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import FlowChartModal from "./FlowChartModal";

const mockCamps = [
  {
    id: "1",
    eventID: "3",
    capacity: "67",
  },
  {
    id: "2",
    eventID: "3",
    capacity: "69",
  },
  {
    id: "3",
    eventID: "3",
    capacity: "12",
  },
  {
    id: "1",
    eventID: "2",
    capacity: "50",
  },
]

const currEventID = "3";


const codeData = [
  { color: "#DFF6DD", label: "green", text: "#155724"},
  { color: "#FFF3CD", label: "yellow", text: "#856404"},
  { color: "#F8D7DA", label: "red", text: "#721C24"},
  { color: "#000000", label: "black", text: "#000000"},
];

{/* right now purely hard coded, eventually need to turn these into selectable options... */}
const AddPersonModal = ({ visible, onClose }) => {
  const [flowChartModal, setFlowChartModal] = useState(false);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/*tap for flow chart */}
        <TouchableOpacity
          style={styles.helpButton}
          onPress={() => setFlowChartModal(true)}
        >
          <MaterialCommunityIcons name="help" size={24} color="#721C24" />
        </TouchableOpacity>
        <FlowChartModal visible={flowChartModal} onClose={() => setFlowChartModal(false)} />
        <View style={styles.titleBox}>
          <Text style={styles.title}>Add a Person</Text> 
        </View>
        {/* person location */}
        <View>
          <Text style={styles.header}>Location:</Text>
          <View style={{alignItems: "center"}}>
            {/*TODO: add actual location google maps integration*/}
            <Image
              source={require("../assets/location.webp")}
              style={styles.image}
              resizeMode="cover"
            />

            {/*add current location checkmark */}
          </View>
        </View>
        {/*person priority tag*/}
        <View>
          <Text style={styles.header}>Priority Tag:</Text>
            <View style={styles.codeContainer}>
              {codeData.map((item, index) => (
                <View key={index} style={{ alignItems: "center", marginHorizontal: 10 }}>
                  <View
                    style={[
                      styles.circle,
                      { backgroundColor: item.color, justifyContent: "center", alignItems: "center" },
                    ]}
                  >
                    <Text></Text>
                  </View>

                  <Text style={[styles.countText, {color: item.text}]}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
        </View>
        <View>
          <Text style={styles.header}>MERT Camp:</Text>
          <View style={styles.codeContainer}>
            {mockCamps
              .filter((camp) => camp.eventID === currEventID)
              .map((camp) => (
                <View
                  key={camp.id}
                  style={{ alignItems: "center", marginHorizontal: 10 }}
                >
                  <MaterialCommunityIcons
                    name="home-outline"      
                    size={40}
                    color="#000"     
                  />
                  <Text style={[styles.countText, { color: "#000" }]}>
                    {camp.id}
                  </Text>
                </View>
              ))}
          </View>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: "#000", textAlign: "center", marginBottom: "40" }}>Enter</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

export default AddPersonModal;