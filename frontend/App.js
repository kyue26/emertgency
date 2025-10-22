import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import MembersScreen from './screens/MembersScreen';
import SettingsScreen from './screens/SettingsScreen';
import LandingScreen from "./screens/LandingScreen.js";
import CommanderTodoScreen from "./screens/CommanderTodoScreen";


const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
const CommanderTodoStack = createNativeStackNavigator();
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
function CommanderTodoStackScreen() {
  return (
      <CommanderTodoStack.Navigator>
        <CommanderTodoStack.Screen name="CommanderTodo" component={CommanderTodoScreen} />
      </CommanderTodoStack.Navigator>
  );
}

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="HomeNav" component={HomeStackScreen} />
      <Tab.Screen name="ProfileNav" component={ProfileStackScreen} />
      <Tab.Screen name="MembersNav" component={MembersStackScreen} />
      <Tab.Screen name="CommanderTodoNav" component={CommanderTodoStackScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <NavigationContainer>
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <AuthStack.Screen name="Landing">
            {(props) => (
              <LandingScreen {...props} onAuthSuccess={() => setIsAuthenticated(true)} />
            )}
          </AuthStack.Screen>
        ) : (
    
          <AuthStack.Screen name="MainApp" component={MainTabNavigator} />
        )}
      </AuthStack.Navigator>
    </NavigationContainer>
  );
}