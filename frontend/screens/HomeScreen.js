import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal } from "react-native";
import styles from "../styles/HomeScreenStyles";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AddPersonModal from "./AddPersonModal";


// we filter out and find all camps corresponding to each mass casualty event
// we filter through all casualties to group into respective camps
// after finding all participants, display corresponding color depending on their group

// aggregate all mert camps of casualty event, display number on the top

const currEventID = "3";

const mockEvent = [
  {
    id: "3",
    name: "Spring Drill",
    location: "UPenn",
    time: "7:00 A",
    groupIDs: ["1", "2", "3"]
  },
];

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

const mockInjured = [
  {
    id: "1",
    eventID: "3",
    campID: "1",
    color: "green",
    flowChart: "breathing",
    hospital: "Penn Presbyterian Medical Center",
    other: "minor abrasions on arm"
  },
  {
    id: "2",
    eventID: "3",
    campID: "2",
    color: "yellow",
    flowChart: "airway obstruction",
    hospital: "Hospital of the University of Pennsylvania",
    other: "lightheaded, monitored for shock"
  },
  {
    id: "3",
    eventID: "3",
    campID: "3",
    color: "red",
    flowChart: "shock",
    hospital: "Penn Medicine Trauma Unit",
    other: "fractured leg, active bleeding"
  },
  {
    id: "4",
    eventID: "3",
    campID: "1",
    color: "green",
    flowChart: "walking wounded",
    hospital: "Children’s Hospital of Philadelphia",
    other: "scrapes and bruises only"
  },
  {
    id: "5",
    eventID: "3",
    campID: "2",
    color: "yellow",
    flowChart: "bleeding control",
    hospital: "Penn Presbyterian Medical Center",
    other: "minor head wound, conscious"
  },
  {
    id: "6",
    eventID: "3",
    campID: "3",
    color: "red",
    flowChart: "airway management",
    hospital: "Hospital of the University of Pennsylvania",
    other: "collapsed lung, intubated"
  },
  {
    id: "7",
    eventID: "4",
    campID: "2",
    color: "black",
    flowChart: "no pulse",
    hospital: "Penn Medicine Trauma Unit",
    other: "no vital signs, DNR confirmed"
  },
  {
    id: "8",
    eventID: "3",
    campID: "1",
    color: "green",
    flowChart: "breathing",
    hospital: "Penn Presbyterian Medical Center",
    other: "light bruising, released after observation"
  },
  {
    id: "9",
    eventID: "3",
    campID: "3",
    color: "yellow",
    flowChart: "minor shock",
    hospital: "Children’s Hospital of Philadelphia",
    other: "mild dehydration, IV fluids started"
  },
  {
    id: "10",
    eventID: "2",
    campID: "1",
    color: "black",
    flowChart: "no breathing",
    hospital: "Hospital of the University of Pennsylvania",
    other: "unresponsive, pronounced on scene"
  }
]

const getCurrentEvent = () => {
  return currCasualtyID;
}

const colorMap = {
  green: "#DFF6DD",
  yellow: "#FFF3CD",
  red: "#F8D7DA",
  black: "#000000",
};

// darker
const colorMap2 = {
  green: "#155724",
  yellow: "#856404",
  red: "#721C24",
  black: "#000000",
};

const getInjuredByCamp = (campId) => {
  // return the member list by camp
  const filteredMembers = mockInjured.filter(item => item.campID === campId && item.eventID === currEventID);
  const result = filteredMembers.map(item => ({
    id: item.id,
    color: item.color
  }));
  return result;
}

// TODO: aggregate code data based on existing injuries per group
const codeData = [
  { color: "#DFF6DD", label: "green", text: "#155724", count: 3 },
  { color: "#FFF3CD", label: "yellow", text: "#856404", count: 3 },
  { color: "#F8D7DA", label: "red", text: "#721C24", count: 2 },
  { color: "#000000", label: "black", text: "#ffffff", count: 0 },
];

const CampCard = ({ camp }) => {
  const injuredPeople = getInjuredByCamp(camp.id);
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between"}}>
        <Text style={styles.campName}>MERT Camp #{camp.id}</Text>
        <Text>{injuredPeople.length}/{camp.capacity}</Text>
      </View>

      <View style={styles.injuredRow}>
        {injuredPeople.map((person) => (
          <View style={{ position: "relative" }}>
            <MaterialCommunityIcons
              name="account"
              size={30}
              color={colorMap[person.color] || "#ccc"}
              style={{ position: "absolute", left: 0, top: 0 }}
            />
            {/* TODO: figure out coloring later, perhaps middle color? */}
            <MaterialCommunityIcons
              name="account"
              size={30}
              color={colorMap[person.color] || "#ccc"}
            />
          </View>
        ))}

      </View>

    </View>
  )
};


const HomeScreen = () => {
  const [addPersonModal, setAddPersonModal] = useState(false);
  return (
    // TODO: may need to change mockEvent[0].name to be current event id.name but next time
    <View style={styles.container}>
      <View style={styles.titleBox}>
        <Text style={styles.title}>{mockEvent[0].name}</Text> 
      </View>

      {/* code circle section */}
      <View style={{marginBottom: "20"}}>
        <Text style={styles.header}>Total Casualties</Text>
        <View style={styles.codeContainer}>
          {codeData.map((item, index) => (
            <View
              key={index}
              style={[styles.circle, {backgroundColor: item.color }]}
            >
              <Text
                style={[
                  styles.countText,
                  { color: item.text }, 
                ]}
              >
                {item.count}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* mert camps */}
      <ScrollView>
        {mockCamps
          .filter((camp) => camp.eventID === currEventID)
          .map((camp) => (
            <CampCard key={camp.id} camp={camp} />
          ))}
      </ScrollView>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setAddPersonModal(true)}
      >
        <MaterialCommunityIcons name="plus" size={30} color="#000" />
      </TouchableOpacity>

      {/*add person modal*/}
      <AddPersonModal visible={addPersonModal} onClose={() => setAddPersonModal(false)} />
    </View>
  );
};



export default HomeScreen;
