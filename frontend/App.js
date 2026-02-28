import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import MembersScreen from './screens/MembersScreen';
import SettingsScreen from './screens/SettingsScreen';
import LandingScreen from "./screens/LandingScreen.js";
import TaskScreen from './screens/TaskScreen';
import AddPersonScreen from './screens/AddPersonScreen.js';
import CasualtyListScreen from './screens/CasualtyListScreen.js';
import CasualtyDetailScreen from './screens/CasualtyDetailScreen';
import CommanderNavigator from './navigation/CommanderNavigator';
import { getStoredToken } from './services/api';
import { getCommanderToken } from './services/commanderApi';
import { applyGlobalFont } from "./styles/FontPatch";
import {
  useFonts,
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import GuideScreen from './screens/GuideScreen';
import { AuthContext } from './context/AuthContext';

const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
// const CommanderTodoStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const MembersStack = createNativeStackNavigator();
const AddPersonStack = createNativeStackNavigator();
const CasualtyListStack = createNativeStackNavigator();
const GuideStack = createNativeStackNavigator();
// i need to override react native's header in order to increase size of app
// change fonts, bg colors of header etc here

applyGlobalFont();

const CustomHeader = () => (
  <View
    style={{
      height: 120,              
      backgroundColor: '#011F5B',
      paddingTop: 52,
      justifyContent: 'center',
    }}
  >
    <AppHeaderTitle />
  </View>
);

const AppHeaderTitle = () => (
  <View style={{ alignItems: 'center' }}>
    <Text
      style={{
        fontFamily: 'Poppins_500Medium',   
        fontSize: 20,
        color: '#FFFFFF',
      }}
    >
      eMERTgency
    </Text>
    <Text
      style={{
        fontFamily: 'Poppins_300Light',
        fontSize: 14,
        color: '#FFFFFFB2'
      }}
    >
      Mass Casualty Management
    </Text>
  </View>
);

function HomeStackScreen() {
  return (
    <HomeStack.Navigator
      screenOptions={{
        header: () => <CustomHeader />,
      }}
    >
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen
        name="CasualtyDetail"
        component={CasualtyDetailScreen}
      />
      <HomeStack.Screen name="List" component={CasualtyListScreen} />
    </HomeStack.Navigator>
  );
}


function ProfileStackScreen() {
  return (
      <ProfileStack.Navigator 
        initialRouteName="ProfileScreen"
        screenOptions={{
            // Default header for the stack. We'll override TaskScreen's header.
            header: () => <CustomHeader />,
        }}
      >
        <ProfileStack.Screen
          name="ProfileScreen"
          component={ProfileScreen}
          options={{
            // Use the default CustomHeader defined above
          }} 
        />
        <ProfileStack.Screen
          name="TaskScreen"
          component={TaskScreen}
          options={({ navigation }) => ({
            // This replaces the CustomHeader with a standard RN header, but customized
            header: () => (
                <View style={{
                    backgroundColor: '#011F5B', 
                    paddingTop: 52,
                    paddingBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 15,
                }}>
                    {/* Back Button */}
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="arrow-left" size={24} color="#FFFFFF" />
                        <Text style={{ fontFamily: 'Poppins_400Regular', color: '#FFFFFF', marginLeft: 8, fontSize: 16 }}>Back</Text>
                    </TouchableOpacity>
                    
                    {/* New Task Button (The + New Task design from your TaskScreen) */}
                    {/* We need to pass the modal visibility control down, but for now, we'll keep the button visually here */}
                    <TouchableOpacity 
                        onPress={() => { /* Navigation logic to open modal is handled in TaskScreen */ }} 
                        style={{
                            backgroundColor: '#1E90FF', // A slightly brighter blue
                            borderRadius: 20,
                            paddingHorizontal: 15,
                            paddingVertical: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}
                    >
                        <Feather name="plus" size={20} color="#FFFFFF" />
                        <Text style={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', marginLeft: 5, fontSize: 15 }}>New Task</Text>
                    </TouchableOpacity>
                </View>
            ),
          })}
        />
      </ProfileStack.Navigator>
  );
}

function AddPersonStackScreen() {
  return (
    <AddPersonStack.Navigator 
      screenOptions={{
        header: () => <CustomHeader />,
      }}
    >
      <AddPersonStack.Screen name="Add" component={AddPersonScreen} />
    </AddPersonStack.Navigator>
  )
}

function MembersStackScreen() {
  return (
      <MembersStack.Navigator 
        screenOptions={{
          header: () => <CustomHeader />,
        }}
      >
        <MembersStack.Screen name="Members" component={MembersScreen} />
        <MembersStack.Screen name="Settings" component={SettingsScreen} />
      </MembersStack.Navigator>
  );
}

function GuideStackScreen() {
  return (
      <GuideStack.Navigator 
        screenOptions={{
          header: () => <CustomHeader />,
        }}
      >
        <GuideStack.Screen name="Members" component={GuideScreen} />
      </GuideStack.Navigator>
  );
}

// function CommanderTodoStackScreen() {
//   return (
//       <CommanderTodoStack.Navigator 
//         screenOptions={{
//           header: () => <CustomHeader />,
//         }}
//       >
//         <CommanderTodoStack.Screen name="CommanderTodo" component={CommanderTodoScreen} />
//       </CommanderTodoStack.Navigator>
//   );
// }

function CasualtyListStackScreen() {
  return (
      <CasualtyListStack.Navigator 
        screenOptions={{
          header: () => <CustomHeader />,
        }}
      >
        <CasualtyListStack.Screen name="CasualtyList" component={CasualtyListScreen} />
        <CasualtyListStack.Screen
          name="CasualtyDetail"
          component={CasualtyDetailScreen}
        />
      </CasualtyListStack.Navigator>
  );
}

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true, 
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarStyle: {
          backgroundColor: '#011F5B',
          borderTopWidth: 0,
          height: 75,
          paddingBottom: 12,
          paddingTop: 12,
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#B5C8E8',
      }}
    >
      <Tab.Screen 
        name="HomeNav" 
        component={HomeStackScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size || 22} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="CasualtyListNav" 
        component={CasualtyListStackScreen}
        options={{
          tabBarLabel: 'List',
          tabBarIcon: ({ color, size }) => (
            <Feather name="list" size={size || 22} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="AddNav" 
        component={AddPersonStackScreen}
        options={{
          tabBarLabel: 'Add',
          tabBarIcon: ({ color, size }) => (
            <Feather name="plus-circle" size={size || 26} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="MembersNav" 
        component={MembersStackScreen}
        options={{
          tabBarLabel: 'Team',
          tabBarIcon: ({ color, size }) => (
            <Feather name="users" size={size || 22} color={color} />
          ),
        }}
      />
      {/* <Tab.Screen name="CommanderTodoNav" component={CommanderTodoStackScreen} /> */}
      <Tab.Screen 
        name="GuideNav" 
        component={GuideStackScreen}
        options={{
          tabBarLabel: 'Guide',
          tabBarIcon: ({ color, size }) => (
            <Feather name="book" size={size || 22} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="ProfileNav" 
        component={ProfileStackScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size || 22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'member' | 'commander'
  const [isLoading, setIsLoading] = useState(true);
  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Check for stored auth on mount: member token -> member flow, commander token -> commander flow
  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const [memberToken, commanderToken] = await Promise.all([
          getStoredToken(),
          getCommanderToken(),
        ]);
        if (memberToken) {
          setIsAuthenticated(true);
          setUserRole('member');
        } else if (commanderToken) {
          setIsAuthenticated(true);
          setUserRole('commander');
        } else {
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setIsAuthenticated(false);
        setUserRole(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleAuthSuccess = (role) => {
    setIsAuthenticated(true);
    setUserRole(role || 'member');
  };

  const handleLogout = async () => {
    try {
      if (userRole === 'commander') {
        const commanderApi = require('./services/commanderApi').default;
        await commanderApi.logout();
      } else {
        const { authAPI } = require('./services/api');
        await authAPI.logout();
      }
      setIsAuthenticated(false);
      setUserRole(null);
    } catch (error) {
      console.error('Logout error:', error);
      setIsAuthenticated(false);
      setUserRole(null);
    }
  };

  if (!fontsLoaded || isLoading) {
    return null; // or a loading screen
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthContext.Provider value={{ isAuthenticated, userRole, setUserRole, handleLogout }}>
        <NavigationContainer>
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <AuthStack.Screen name="Landing">
              {(props) => (
                <LandingScreen {...props} onAuthSuccess={handleAuthSuccess} />
              )}
            </AuthStack.Screen>
          ) : userRole === 'commander' ? (
            <AuthStack.Screen name="CommanderApp">
              {(props) => <CommanderNavigator {...props} onLogout={handleLogout} />}
            </AuthStack.Screen>
          ) : (
            <AuthStack.Screen name="MainApp" component={MainTabNavigator} />
          )}
        </AuthStack.Navigator>
        </NavigationContainer>
      </AuthContext.Provider>
    </GestureHandlerRootView>
  );
}