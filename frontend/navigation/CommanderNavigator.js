import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { Feather } from "@expo/vector-icons";
import { colors } from "../styles/CommanderTheme";
import { formatCommanderTitle } from "./commanderScreenConfig";

import CommanderDrawerContent from "./CommanderDrawerContent";
import CommanderDashboardScreen from "../screens/commander/CommanderDashboardScreen";
import CommanderDrillSetupScreen from "../screens/commander/CommanderDrillSetupScreen";
import CommanderChecklistScreen from "../screens/commander/CommanderChecklistScreen";
import CommanderProfileScreen from "../screens/commander/CommanderProfileScreen";
import CommanderUsersScreen from "../screens/commander/CommanderUsersScreen";

const Drawer = createDrawerNavigator();

const CommanderHeader = ({ title, navigation }) => (
  <View style={headerStyles.wrapper}>
    <TouchableOpacity
      onPress={() => navigation.openDrawer()}
      style={headerStyles.menuBtn}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Feather name="menu" size={24} color="#fff" />
    </TouchableOpacity>
    <Text style={headerStyles.title}>{title}</Text>
    <View style={headerStyles.placeholder} />
  </View>
);

const headerStyles = {
  wrapper: {
    backgroundColor: colors.pennBlue,
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuBtn: { padding: 8 },
  title: {
    fontFamily: "Poppins_500Medium",
    fontSize: 18,
    color: "#fff",
  },
  placeholder: { width: 40 },
};

export default function CommanderNavigator({ onLogout }) {
  return (
    <Drawer.Navigator
      initialRouteName="CommanderDashboard"
      drawerContent={(props) => (
        <CommanderDrawerContent {...props} onLogout={onLogout} />
      )}
      screenOptions={({ route, navigation }) => ({
        header: () => (
          <CommanderHeader
            title={formatCommanderTitle(route.name)}
            navigation={navigation}
          />
        ),
        drawerType: "front",
        drawerStyle: {
          width: 280,
          maxWidth: "85%",
          backgroundColor: colors.cardBg,
        },
        drawerContentStyle: {
          backgroundColor: colors.cardBg,
          flex: 1,
        },
        swipeEdgeWidth: 30,
        swipeMinDistance: 10,
      })}
    >
      <Drawer.Screen name="CommanderDashboard" component={CommanderDashboardScreen} />
      <Drawer.Screen name="CommanderDrillSetup" component={CommanderDrillSetupScreen} />
      <Drawer.Screen name="CommanderChecklist" component={CommanderChecklistScreen} />
      <Drawer.Screen name="CommanderProfile" component={CommanderProfileScreen} />
      <Drawer.Screen name="CommanderUsers" component={CommanderUsersScreen} />
    </Drawer.Navigator>
  );
}
