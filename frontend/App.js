import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import MembersScreen from './screens/MembersScreen';
import SettingsScreen from './screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const MembersStack = createNativeStackNavigator();

function HomeStackScreen() {
  return (
      <HomeStack.Navigator>
        <HomeStack.Screen name="Home" component={HomeScreen} />
      </HomeStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
      <ProfileStack.Navigator>
        <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      </ProfileStack.Navigator>
  );
}

function MembersStackScreen() {
  return (
      <MembersStack.Navigator>
        <MembersStack.Screen name="Members" component={MembersScreen} />
        <MembersStack.Screen name="Settings" component={SettingsScreen} />
      </MembersStack.Navigator>
  );
}

function App() {
  return (
        <NavigationContainer>
            <Tab.Navigator>
            <Tab.Screen name="HomeNav" component={HomeStackScreen} />
            <Tab.Screen name="ProfileNav" component={ProfileStackScreen} />
            <Tab.Screen name="MembersNav" component={MembersStackScreen} />
          </Tab.Navigator>
        </NavigationContainer>
  );
}

export default App;