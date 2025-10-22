import React from "react";
import { View, Text, TouchableOpacity, Modal, Image } from "react-native";
import styles from "../styles/FlowChartModalStyles";


{/* right now purely hard coded, eventually need to turn these into selectable options... */}
const FlowChartModal = ({ visible, onClose }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <Image
        source={require("../assets/flow_chart.png")}
        style={styles.image}
        resizeMode="cover"
      />
      <TouchableOpacity onPress={onClose}>
        <Text style={{ color: "#000", textAlign: "center", marginBottom: "40" }}>Enter</Text>
      </TouchableOpacity>
      
    </Modal>
  );
};

export default FlowChartModal;