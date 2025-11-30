import React, { useState } from 'react';
import  { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import MembersScreen from './screens/MembersScreen';
import SettingsScreen from './screens/SettingsScreen';
import LandingScreen from "./screens/LandingScreen.js";
// import CommanderTodoScreen from "./screens/CommanderTodoScreen";
import AddPersonScreen from './screens/AddPersonScreen.js';
import CasualtyListScreen from './screens/CasualtyListScreen.js';
import CasualtyDetailScreen from './screens/CasualtyDetailScreen';

const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
// const CommanderTodoStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const MembersStack = createNativeStackNavigator();
const AddPersonStack = createNativeStackNavigator();
const CasualtyListStack = createNativeStackNavigator();
// i need to override react native's header in order to increase size of app
// change fonts, bg colors of header etc here
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
        fontFamily: 'Inter_700Bold',   
        fontSize: 20,
        color: '#FFFFFF',
      }}
    >
      eMERTgency
    </Text>
    <Text
      style={{
        fontFamily: 'Inter_400Regular',
        fontSize: 20,
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
        screenOptions={{
          header: () => <CustomHeader />,
        }}
      >
        <ProfileStack.Screen name="Profile" component={ProfileScreen} />
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
      </CasualtyListStack.Navigator>
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
      <Tab.Screen name="CasualtyListNav" component={CasualtyListStackScreen} /> 
      <Tab.Screen name="AddNav" component={AddPersonStackScreen} />
      <Tab.Screen name="MembersNav" component={MembersStackScreen} />
      {/* <Tab.Screen name="CommanderTodoNav" component={CommanderTodoStackScreen} /> */}
      <Tab.Scren name="GuideNav" component={GuideStackScreen} />
      <Tab.Screen name="ProfileNav" component={ProfileStackScreen} />
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